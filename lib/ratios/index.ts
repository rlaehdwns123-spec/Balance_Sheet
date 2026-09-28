import type { StandardAccounts } from "@/lib/normalize";

export type RatioCategory = "profitability" | "stability" | "growth" | "activity";
export type RatioUnit = "percent" | "times";

export const CATEGORY_LABEL: Record<RatioCategory, string> = {
  profitability: "수익성",
  stability: "안정성",
  growth: "성장성",
  activity: "활동성",
};

/** 연속된 두 해의 표준 계정. prev는 직전 연도가 없으면 null */
type Pair = { cur: StandardAccounts; prev: StandardAccounts | null };

export type RatioDef = {
  key: string;
  label: string;
  category: RatioCategory;
  unit: RatioUnit;
  /** 툴팁용 계산식 */
  formula: string;
  /** 값이 클수록 좋은 지표인지 (부채비율 등은 false) */
  higherIsBetter: boolean;
  compute: (p: Pair) => number | null;
};

// ── null 안전 계산 헬퍼 ────────────────────────────────────────────

/** a / b. 어느 쪽이든 null이거나 분모가 0 이하(자본잠식 등)면 null */
export function safeDiv(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || b <= 0) return null;
  return a / b;
}

/** 평균잔액 (기초+기말)/2. 한쪽이라도 없으면 null */
export function average(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null;
  return (a + b) / 2;
}

/** 증가율 cur/prev - 1. 전년 값이 0 이하면(적자 → 흑자 등) 의미가 없어 null */
export function growthRate(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || prev <= 0) return null;
  return cur / prev - 1;
}

const avgOf = (p: Pair, key: keyof Omit<StandardAccounts, "year">) => average(p.cur[key], p.prev?.[key]);

/**
 * ROE: 지배주주 기준이 가능하면 지배주주순이익 / 평균 지배주주지분,
 * 아니면(별도재무제표 등 지배·비지배 구분 없음) 당기순이익 / 평균 자본총계.
 */
function roe(p: Pair): number | null {
  const ownersEquity = avgOf(p, "equityOwners");
  if (p.cur.netIncomeOwners != null && ownersEquity != null) return safeDiv(p.cur.netIncomeOwners, ownersEquity);
  return safeDiv(p.cur.netIncome, avgOf(p, "totalEquity"));
}

/** 비율 정의 — PRD.md "재무비율 정의" 절과 동일하게 유지할 것 */
export const RATIOS: RatioDef[] = [
  // 수익성
  {
    key: "grossMargin",
    label: "매출총이익률",
    category: "profitability",
    unit: "percent",
    formula: "매출총이익 ÷ 매출액",
    higherIsBetter: true,
    compute: ({ cur }) => safeDiv(cur.grossProfit, cur.revenue),
  },
  {
    key: "operatingMargin",
    label: "영업이익률",
    category: "profitability",
    unit: "percent",
    formula: "영업이익 ÷ 매출액",
    higherIsBetter: true,
    compute: ({ cur }) => safeDiv(cur.operatingIncome, cur.revenue),
  },
  {
    key: "netMargin",
    label: "순이익률",
    category: "profitability",
    unit: "percent",
    formula: "당기순이익 ÷ 매출액",
    higherIsBetter: true,
    compute: ({ cur }) => safeDiv(cur.netIncome, cur.revenue),
  },
  {
    key: "roe",
    label: "ROE",
    category: "profitability",
    unit: "percent",
    formula: "지배주주순이익 ÷ 평균 지배주주지분\n(구분이 없으면 당기순이익 ÷ 평균 자본총계)",
    higherIsBetter: true,
    compute: roe,
  },
  {
    key: "roa",
    label: "ROA",
    category: "profitability",
    unit: "percent",
    formula: "당기순이익 ÷ 평균 자산총계",
    higherIsBetter: true,
    compute: (p) => safeDiv(p.cur.netIncome, avgOf(p, "totalAssets")),
  },
  // 안정성 (시점 지표라 기말 잔액 기준)
  {
    key: "debtRatio",
    label: "부채비율",
    category: "stability",
    unit: "percent",
    formula: "부채총계 ÷ 자본총계 (기말)",
    higherIsBetter: false,
    compute: ({ cur }) => safeDiv(cur.totalLiabilities, cur.totalEquity),
  },
  {
    key: "currentRatio",
    label: "유동비율",
    category: "stability",
    unit: "percent",
    formula: "유동자산 ÷ 유동부채 (기말)",
    higherIsBetter: true,
    compute: ({ cur }) => safeDiv(cur.currentAssets, cur.currentLiabilities),
  },
  {
    key: "quickRatio",
    label: "당좌비율",
    category: "stability",
    unit: "percent",
    formula: "(유동자산 − 재고자산) ÷ 유동부채 (기말)",
    higherIsBetter: true,
    compute: ({ cur }) =>
      cur.currentAssets == null || cur.inventories == null
        ? null
        : safeDiv(cur.currentAssets - cur.inventories, cur.currentLiabilities),
  },
  {
    key: "equityRatio",
    label: "자기자본비율",
    category: "stability",
    unit: "percent",
    formula: "자본총계 ÷ 자산총계 (기말)",
    higherIsBetter: true,
    compute: ({ cur }) => safeDiv(cur.totalEquity, cur.totalAssets),
  },
  // 성장성 (전년 대비)
  {
    key: "revenueGrowth",
    label: "매출액증가율",
    category: "growth",
    unit: "percent",
    formula: "당기 매출액 ÷ 전기 매출액 − 1",
    higherIsBetter: true,
    compute: ({ cur, prev }) => growthRate(cur.revenue, prev?.revenue),
  },
  {
    key: "operatingIncomeGrowth",
    label: "영업이익증가율",
    category: "growth",
    unit: "percent",
    formula: "당기 영업이익 ÷ 전기 영업이익 − 1\n(전기 적자면 계산하지 않음)",
    higherIsBetter: true,
    compute: ({ cur, prev }) => growthRate(cur.operatingIncome, prev?.operatingIncome),
  },
  {
    key: "netIncomeGrowth",
    label: "순이익증가율",
    category: "growth",
    unit: "percent",
    formula: "당기 순이익 ÷ 전기 순이익 − 1\n(전기 적자면 계산하지 않음)",
    higherIsBetter: true,
    compute: ({ cur, prev }) => growthRate(cur.netIncome, prev?.netIncome),
  },
  {
    key: "assetGrowth",
    label: "총자산증가율",
    category: "growth",
    unit: "percent",
    formula: "기말 자산총계 ÷ 전기말 자산총계 − 1",
    higherIsBetter: true,
    compute: ({ cur, prev }) => growthRate(cur.totalAssets, prev?.totalAssets),
  },
  // 활동성 (평균잔액 기준)
  {
    key: "assetTurnover",
    label: "총자산회전율",
    category: "activity",
    unit: "times",
    formula: "매출액 ÷ 평균 자산총계",
    higherIsBetter: true,
    compute: (p) => safeDiv(p.cur.revenue, avgOf(p, "totalAssets")),
  },
  {
    key: "equityTurnover",
    label: "자기자본회전율",
    category: "activity",
    unit: "times",
    formula: "매출액 ÷ 평균 자본총계",
    higherIsBetter: true,
    compute: (p) => safeDiv(p.cur.revenue, avgOf(p, "totalEquity")),
  },
  {
    key: "inventoryTurnover",
    label: "재고자산회전율",
    category: "activity",
    unit: "times",
    formula: "매출액 ÷ 평균 재고자산",
    higherIsBetter: true,
    compute: (p) => safeDiv(p.cur.revenue, avgOf(p, "inventories")),
  },
];

export type RatioKey = (typeof RATIOS)[number]["key"];

/** 연도별 비율. values[key]는 해당 연도 값 (비율은 소수, 예: 0.131 = 13.1%) */
export type RatioYear = { year: number; values: Record<string, number | null> };

/**
 * 연도별 표준 계정 → 연도별 비율 (입력 연도 오름차순 그대로).
 * 직전 연도는 배열 순서가 아니라 year - 1로 찾으므로 중간 연도가 빠져도 안전.
 * 가장 이른 해는 평균잔액·증가율이 null이 되므로, 화면 표시 연도보다 1년 더 넘겨주는 게 좋다.
 */
export function computeRatios(years: StandardAccounts[]): RatioYear[] {
  const byYear = new Map(years.map((y) => [y.year, y]));
  return [...years]
    .sort((a, b) => a.year - b.year)
    .map((cur) => {
      const pair: Pair = { cur, prev: byYear.get(cur.year - 1) ?? null };
      return { year: cur.year, values: Object.fromEntries(RATIOS.map((r) => [r.key, r.compute(pair)])) };
    });
}
