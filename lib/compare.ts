import type { DartErrorKind } from "@/lib/dart/errors";
import type { Market } from "@/lib/market";
import type { AccountKey } from "@/lib/normalize";
import type { RatioUnit } from "@/lib/ratios";
import type { SecErrorKind } from "@/lib/sec/errors";

export const MAX_COMPARE = 3;

/** corpCode는 한국 8자리 고유번호 또는 미국 10자리 CIK, stockCode는 종목코드 또는 티커 */
export type CompareCorp = { corpCode: string; name: string; stockCode: string; market: Market };

/** 서버 → 클라이언트로 넘기는 회사별 비교 데이터. 실패한 회사는 years가 비고 error가 있음 */
export type CompareCompany = CompareCorp & {
  years: { year: number; values: Record<string, number | null> }[];
  /** 금액의 통화 (한국 KRW, 미국 기업은 보고 통화). 실패하면 null */
  currency: string | null;
  /** 결산월이 12월이 아니면 그 달 (미국 기업 9월 결산 등), 12월이거나 모르면 null */
  fiscalEndMonth: number | null;
  /** 연도 → 회계연도 기말일 "2026-01-31" (미국 기업만, 연도 표기가 회사 회계연도라 실제 기간을 밝힌다) */
  ends: Record<number, string>;
  error: { kind: DartErrorKind | SecErrorKind; status: string; message: string } | null;
};

/**
 * 금액을 나란히 비교할 수 있는지: 불러온 회사들의 통화가 하나면 그 통화, 여럿이면 mixed.
 * 환율 환산은 하지 않으므로 통화가 섞이면 금액 표·차트를 숨기고 비율만 비교한다.
 */
export function compareCurrency(companies: Pick<CompareCompany, "currency">[]): { currencies: string[]; mixed: boolean } {
  const currencies = [...new Set(companies.flatMap((c) => (c.currency ? [c.currency] : [])))];
  return { currencies, mixed: currencies.length > 1 };
}

/** ?corps=a,b,c → 8자리 고유번호(한국)·10자리 CIK(미국)만, 중복 제거, 최대 3개 (순서 유지) */
export function parseCorpList(raw: string | string[] | undefined | null): string[] {
  const joined = Array.isArray(raw) ? raw.join(",") : (raw ?? "");
  const codes = joined
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^(\d{8}|\d{10})$/.test(s));
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
