import "server-only";
import { unstable_cache } from "next/cache";
import { DartError, isDartError } from "./errors";
import type { MultiAccountRow } from "@/lib/benchmark";
import type { AnnualReport, DartAccountRow, DartCompany, FsDiv, ReportCode } from "./types";

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
