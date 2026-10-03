import "server-only";
import { unstable_cache } from "next/cache";
import { DartError, isDartError } from "./errors";
import type { MultiAccountRow } from "@/lib/benchmark";
import { interimCandidates, QUARTER_OF, type InterimRef } from "@/lib/interim";
import { quartersBack, reportKey, requiredReports, type QuarterRef, type QuarterReportSet } from "@/lib/quarterly";
import type {
  AnnualReport,
  AuditOpinionRow,
  DartAccountRow,
  DartCompany,
  DisclosureRow,
  DividendRow,
  FsDiv,
  InterimReport,
  ReportCode,
} from "./types";

const BASE_URL = "https://opendart.fss.or.kr/api";
const REVALIDATE_SECONDS = 86400;

/**
 * DART GET 호출. DART는 에러도 HTTP 200 + status 코드로 주므로 status를 검사해 DartError로 바꾼다.
 * fetch 자체는 캐시하지 않고, 아래 unstable_cache가 성공한 결과만 하루 캐시한다
 * (020 요청 제한 같은 에러 응답이 캐시되지 않도록, 그리고 캐시 키에 API 키가 들어가지 않도록).
 */
async function dartGet<T extends { status: string; message: string }>(
  endpoint: string,
  params: Record<string, string>,
): Promise<T> {
  const key = process.env.DART_API_KEY;
  if (!key) throw new DartError("NO_KEY", "DART_API_KEY가 설정되지 않았습니다.");

  const url = `${BASE_URL}/${endpoint}?${new URLSearchParams({ crtfc_key: key, ...params })}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new DartError(`HTTP_${res.status}`, `DART 서버 응답 오류 (HTTP ${res.status})`);

  const body = (await res.json()) as T;
  if (body.status !== "000") throw new DartError(body.status, body.message);
  return body;
}

/** 기업개황 */
export const getCompany = unstable_cache(
  async (corpCode: string): Promise<DartCompany> => {
    const { status: _s, message: _m, ...company } = await dartGet<DartCompany & { status: string; message: string }>(
      "company.json",
      { corp_code: corpCode },
    );
    return company;
  },
  ["dart-company"],
  { revalidate: REVALIDATE_SECONDS },
);

/** 단일회사 전체 재무제표 (fnlttSinglAcntAll) */
export const getSinglAcntAll = unstable_cache(
  async (corpCode: string, bsnsYear: number, reprtCode: ReportCode, fsDiv: FsDiv): Promise<DartAccountRow[]> => {
    const body = await dartGet<{ status: string; message: string; list: DartAccountRow[] }>("fnlttSinglAcntAll.json", {
      corp_code: corpCode,
      bsns_year: String(bsnsYear),
      reprt_code: reprtCode,
      fs_div: fsDiv,
    });
    return body.list;
  },
  ["dart-fnltt-singl-acnt-all"],
  { revalidate: REVALIDATE_SECONDS },
);

/**
 * 다중회사 주요계정 (fnlttMultiAcnt) — 사업보고서 기준, 한 번에 최대 100개사.
 * 해당 연도 보고서가 한 곳도 없으면(013) 빈 목록.
 */
export const getMultiAccounts = unstable_cache(
  async (corpCodes: string[], bsnsYear: number): Promise<MultiAccountRow[]> => {
    if (corpCodes.length > 100) throw new Error("fnlttMultiAcnt는 한 번에 100개사까지");
    try {
      const body = await dartGet<{ status: string; message: string; list: MultiAccountRow[] }>("fnlttMultiAcnt.json", {
        corp_code: corpCodes.join(","),
        bsns_year: String(bsnsYear),
        reprt_code: "11011",
      });
      return body.list;
    } catch (err) {
      if (isDartError(err, "NO_DATA")) return [];
      throw err;
    }
  },
  ["dart-fnltt-multi-acnt"],
  { revalidate: REVALIDATE_SECONDS },
);

/**
 * 5개년치 사업보고서 원본을 최소 호출로 가져온다.
 * 사업보고서 1건에 당기·전기·전전기 3개년이 들어 있으므로 최근 연도 Y와 Y-3 두 건이면
 * Y-5 ~ Y 가 채워진다. 겹치는 연도는 정규화 단계에서 최신 보고서 값을 우선한다.
 *
 * Y는 작년부터 시도하고, 아직 공시 전(013)이면 재작년으로 한 번 내려간다.
 * Y-3 보고서가 없으면(상장 초기 등) 있는 만큼만 반환한다.
 */
export async function getRecentAnnualReports(
  corpCode: string,
  fsDiv: FsDiv,
  now: Date = new Date(),
): Promise<AnnualReport[]> {
  const fetchYear = async (bsnsYear: number): Promise<AnnualReport> => ({
    bsnsYear,
    rows: await getSinglAcntAll(corpCode, bsnsYear, "11011", fsDiv),
  });

  let latest: AnnualReport;
  try {
    latest = await fetchYear(now.getFullYear() - 1);
  } catch (err) {
    if (!isDartError(err, "NO_DATA")) throw err;
    latest = await fetchYear(now.getFullYear() - 2);
  }

  try {
    return [latest, await fetchYear(latest.bsnsYear - 3)];
  } catch (err) {
    if (!isDartError(err, "NO_DATA")) throw err;
    return [latest];
  }
}

/**
 * 분기·반기 보고서 한 건. ref를 주면 그 보고서, 없으면 최신 보고서를 찾는다
 * (분기가 끝난 보고서부터 공시 전(013)이면 한 단계씩 앞으로, 최대 4건 시도).
 */
export async function getInterimReport(
  corpCode: string,
  fsDiv: FsDiv,
  ref: InterimRef | null,
  now: Date = new Date(),
): Promise<InterimReport> {
  const candidates = ref ? [ref] : interimCandidates(now);
  for (const [i, { year, code }] of candidates.entries()) {
    try {
      return { bsnsYear: year, reprtCode: code, rows: await getSinglAcntAll(corpCode, year, code, fsDiv) };
    } catch (err) {
      if (!isDartError(err, "NO_DATA") || i === candidates.length - 1) throw err;
    }
  }
  throw new DartError("013", "조회된 데이타가 없습니다.");
}

/** DART 응답이 013(데이터 없음)이면 빈 목록 */
async function listOrEmpty<T>(endpoint: string, params: Record<string, string>): Promise<T[]> {
  try {
    const body = await dartGet<{ status: string; message: string; list?: T[] }>(endpoint, params);
    return body.list ?? [];
  } catch (err) {
    if (isDartError(err, "NO_DATA")) return [];
    throw err;
  }
}

/** 배당에 관한 사항 (사업보고서, 당기·전기·전전기) */
export const getDividends = unstable_cache(
  async (corpCode: string, bsnsYear: number): Promise<DividendRow[]> =>
    listOrEmpty<DividendRow>("alotMatter.json", { corp_code: corpCode, bsns_year: String(bsnsYear), reprt_code: "11011" }),
  ["dart-alot-matter"],
  { revalidate: REVALIDATE_SECONDS },
);

/** 회계감사인의 명칭 및 감사의견 (사업보고서, 당기·전기·전전기) */
export const getAuditOpinions = unstable_cache(
  async (corpCode: string, bsnsYear: number): Promise<AuditOpinionRow[]> =>
    listOrEmpty<AuditOpinionRow>("accnutAdtorNmNdAdtOpinion.json", {
      corp_code: corpCode,
      bsns_year: String(bsnsYear),
      reprt_code: "11011",
    }),
  ["dart-accnut-adtor-opinion"],
  { revalidate: REVALIDATE_SECONDS },
);

/**
 * 가장 최근 사업보고서 기준 자료: 작년부터 시도하고 비어 있으면(미공시) 재작년.
 * 재무제표와 별개 API라 사업보고서가 있어도 항목이 비어 있을 수 있다.
 */
export async function latestAnnual<T>(
  fetcher: (bsnsYear: number) => Promise<T[]>,
  now: Date = new Date(),
): Promise<{ year: number; rows: T[] } | null> {
  for (const year of [now.getFullYear() - 1, now.getFullYear() - 2]) {
    const rows = await fetcher(year);
    if (rows.length) return { year, rows };
  }
  return null;
}

export type DisclosurePage = { rows: DisclosureRow[]; pageNo: number; totalPage: number; totalCount: number };

/** 공시검색 (list). 기간은 YYYYMMDD, 유형(pblntf_ty)은 없으면 전체 */
export const getDisclosures = unstable_cache(
  async (corpCode: string, bgnDe: string, endDe: string, type: string | null, pageNo: number): Promise<DisclosurePage> => {
    try {
      const body = await dartGet<{
        status: string;
        message: string;
        list: DisclosureRow[];
        page_no: number;
        total_page: number;
        total_count: number;
      }>("list.json", {
        corp_code: corpCode,
        bgn_de: bgnDe,
        end_de: endDe,
        ...(type ? { pblntf_ty: type } : {}),
        page_no: String(pageNo),
        page_count: "20",
      });
      return { rows: body.list, pageNo: body.page_no, totalPage: body.total_page, totalCount: body.total_count };
    } catch (err) {
      if (isDartError(err, "NO_DATA")) return { rows: [], pageNo: 1, totalPage: 0, totalCount: 0 };
      throw err;
    }
  },
  ["dart-list"],
  { revalidate: REVALIDATE_SECONDS },
);

/**
 * 최근 12개 분기 실적에 필요한 보고서들.
 * 최신 분기는 최신 분기·반기 보고서와 최신 사업보고서(4분기) 중 늦은 쪽. 없는 보고서(013)는 빼고 반환한다.
 */
export async function getQuarterlyReports(
  corpCode: string,
  fsDiv: FsDiv,
  count = 12,
  now: Date = new Date(),
): Promise<{ quarters: QuarterRef[]; reports: QuarterReportSet }> {
  const orNull = <T>(p: Promise<T>) =>
    p.catch((err) => {
      if (isDartError(err, "NO_DATA")) return null;
      throw err;
    });

  const [interim, annual] = await Promise.all([
    orNull(getInterimReport(corpCode, fsDiv, null, now)),
    latestAnnual(async (year) => (await orNull(getSinglAcntAll(corpCode, year, "11011", fsDiv))) ?? [], now),
  ]);
  const candidates: QuarterRef[] = [];
  if (interim) candidates.push({ year: interim.bsnsYear, q: QUARTER_OF[interim.reprtCode] });
  if (annual) candidates.push({ year: annual.year, q: 4 });
  if (!candidates.length) throw new DartError("013", "조회된 데이타가 없습니다.");
  const latest = candidates.reduce((a, b) => (b.year * 4 + b.q > a.year * 4 + a.q ? b : a));

  const quarters = quartersBack(latest, count);
  const reports: QuarterReportSet = new Map();
  if (interim) reports.set(reportKey(interim.bsnsYear, interim.reprtCode), interim.rows);
  if (annual) reports.set(reportKey(annual.year, "11011"), annual.rows);
  const missing = requiredReports(quarters).filter(({ year, code }) => !reports.has(reportKey(year, code)));
  const fetched = await Promise.all(missing.map(({ year, code }) => orNull(getSinglAcntAll(corpCode, year, code, fsDiv))));
  missing.forEach(({ year, code }, i) => {
    const rows = fetched[i];
    if (rows) reports.set(reportKey(year, code), rows);
  });
  return { quarters, reports };
}
