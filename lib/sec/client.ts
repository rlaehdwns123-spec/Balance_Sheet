import "server-only";
import { unstable_cache } from "next/cache";
import { trimCompanyFacts } from "./annual";
import { padCik } from "./corps";
import { SecError } from "./errors";
import { trimFilings } from "./filings";
import type { SecCompanyFacts, SecFiling, SecSubmissions } from "./types";

const BASE_URL = "https://data.sec.gov";
const REVALIDATE_SECONDS = 86400;
/** 캐시에 남길 기말일 범위 — 최근 5개 회계연도에 여유를 둔 8년 */
const KEEP_YEARS = 8;

/**
 * SEC 호출 한도는 초당 10건. 서버 인스턴스 안에서 요청 시작 간격을 125ms(초당 8건)로 벌린다.
 * (인스턴스끼리는 조정하지 못하지만, 회사 화면 하나에 2건이라 여유가 크다)
 */
const MIN_INTERVAL_MS = 125;
let nextSlot = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

/**
 * SEC GET 호출. SEC는 User-Agent에 앱 이름과 연락처가 없으면 403을 준다.
 * fetch 자체는 캐시하지 않고(원본이 Next 캐시 한도 2MB를 넘는 회사가 많다)
 * 아래 unstable_cache가 줄인 결과만 하루 캐시한다. 에러 응답은 캐시되지 않는다.
 */
async function secGet<T>(path: string): Promise<T> {
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) throw new SecError("AUTH", "SEC_USER_AGENT가 설정되지 않았습니다.");

  await throttle();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip, deflate" },
    cache: "no-store",
  });
  if (!res.ok) throw SecError.fromHttp(res.status);
  return (await res.json()) as T;
}

function cikOrThrow(cik: string): string {
  const padded = padCik(cik);
  if (!padded) throw new SecError("BAD_REQUEST", `CIK 형식이 올바르지 않습니다: ${cik}`);
  return padded;
}

type RawSubmissions = Omit<SecSubmissions, "cik" | "filings"> & {
  cik: string;
  filings: { recent: Record<keyof SecFiling, string[]> };
};

/**
 * 기업 정보와 최근 제출 목록 (submissions). 열 단위 배열을 행 목록으로 바꾸고,
 * 주요 보고서 외 서류는 최근 1,000건만 남긴다 (캐시 한도)
 */
export const getSubmissions = unstable_cache(
  async (cik: string): Promise<SecSubmissions> => {
    const padded = cikOrThrow(cik);
    const raw = await secGet<RawSubmissions>(`/submissions/CIK${padded}.json`);
    const r = raw.filings.recent;
    const filings: SecFiling[] = r.accessionNumber.map((accessionNumber, i) => ({
      accessionNumber,
      filingDate: r.filingDate[i],
      reportDate: r.reportDate[i],
      form: r.form[i],
      primaryDocument: r.primaryDocument[i],
      primaryDocDescription: r.primaryDocDescription[i],
    }));
    return {
      cik: padded,
      name: raw.name,
      tickers: raw.tickers,
      exchanges: raw.exchanges,
      sic: raw.sic,
      sicDescription: raw.sicDescription,
      fiscalYearEnd: raw.fiscalYearEnd,
      stateOfIncorporation: raw.stateOfIncorporation,
      website: raw.website,
      filings: trimFilings(filings),
    };
  },
  ["sec-submissions"],
  { revalidate: REVALIDATE_SECONDS },
);

/** XBRL 재무 데이터 (companyfacts) — 연간 보고서 값, 최근 8년만 남긴다 */
export const getCompanyFacts = unstable_cache(
  async (cik: string): Promise<SecCompanyFacts> => {
    const padded = cikOrThrow(cik);
    const raw = await secGet<SecCompanyFacts>(`/api/xbrl/companyfacts/CIK${padded}.json`);
    const minEnd = `${new Date().getFullYear() - KEEP_YEARS}-01-01`;
    return trimCompanyFacts(raw, minEnd);
  },
  ["sec-companyfacts"],
  { revalidate: REVALIDATE_SECONDS },
);
