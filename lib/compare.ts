import type { DartErrorKind } from "@/lib/dart/errors";
import type { AccountKey } from "@/lib/normalize";
import type { RatioUnit } from "@/lib/ratios";

export const MAX_COMPARE = 3;

export type CompareCorp = { corpCode: string; name: string; stockCode: string };

/** 서버 → 클라이언트로 넘기는 회사별 비교 데이터. 실패한 회사는 years가 비고 error가 있음 */
export type CompareCompany = CompareCorp & {
  years: { year: number; values: Record<string, number | null> }[];
  error: { kind: DartErrorKind; status: string; message: string } | null;
};

/** ?corps=a,b,c → 8자리 고유번호만, 중복 제거, 최대 3개 (순서 유지) */
export function parseCorpList(raw: string | string[] | undefined | null): string[] {
  const joined = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const codes = joined
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{8}$/.test(s));
  return [...new Set(codes)].slice(0, MAX_COMPARE);
}

export type CompareMetric =
  | { key: AccountKey; label: string; kind: "amount" }
  | { key: string; label: string; kind: "ratio"; unit: RatioUnit };

/** 비교표 항목 — 계정은 표준 계정 키, 비율은 lib/ratios의 키 */
export const COMPARE_ACCOUNTS: CompareMetric[] = [
  { key: "revenue", label: "매출액", kind: "amount" },
  { key: "operatingIncome", label: "영업이익", kind: "amount" },
  { key: "netIncome", label: "당기순이익", kind: "amount" },
  { key: "totalAssets", label: "자산총계", kind: "amount" },
  { key: "totalLiabilities", label: "부채총계", kind: "amount" },
  { key: "totalEquity", label: "자본총계", kind: "amount" },
  { key: "operatingCashFlow", label: "영업활동현금흐름", kind: "amount" },
];

export const COMPARE_RATIOS: CompareMetric[] = [
  { key: "operatingMargin", label: "영업이익률", kind: "ratio", unit: "percent" },
  { key: "netMargin", label: "순이익률", kind: "ratio", unit: "percent" },
  { key: "roe", label: "ROE", kind: "ratio", unit: "percent" },
  { key: "roa", label: "ROA", kind: "ratio", unit: "percent" },
  { key: "debtRatio", label: "부채비율", kind: "ratio", unit: "percent" },
  { key: "currentRatio", label: "유동비율", kind: "ratio", unit: "percent" },
  { key: "revenueGrowth", label: "매출액증가율", kind: "ratio", unit: "percent" },
  { key: "assetTurnover", label: "총자산회전율", kind: "ratio", unit: "times" },
];

/**
 * 최댓값인 회사 인덱스들 (동률이면 모두). 값이 있는 회사가 2곳 미만이면 비교할 게 없어 빈 배열.
 */
export function maxIndices(values: (number | null | undefined)[]): number[] {
  const present = values.flatMap((v, i) => (v == null ? [] : [{ v, i }]));
  if (present.length < 2) return [];
  const max = Math.max(...present.map((p) => p.v));
  return present.filter((p) => p.v === max).map((p) => p.i);
}

/**
 * 기본 기준 연도: 모든 회사에 데이터가 있는 가장 최근 연도, 그런 해가 없으면 전체 중 가장 최근 연도.
 * 결산 시기가 달라 한 회사만 최신 보고서가 있어도 공정하게 비교되도록.
 */
export function pickDefaultYear(yearsByCompany: number[][]): number | null {
  const nonEmpty = yearsByCompany.filter((ys) => ys.length > 0);
  if (nonEmpty.length === 0) return null;
  const common = nonEmpty.reduce((acc, ys) => acc.filter((y) => ys.includes(y)));
  const pool = common.length ? common : nonEmpty.flat();
  return Math.max(...pool);
}
