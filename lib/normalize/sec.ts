import { annualContext, annualTagValues, reportingCurrency, type AnnualContext, type FiscalPeriod, type Taxonomy } from "@/lib/sec/annual";
import type { SecCompanyFacts } from "@/lib/sec/types";
import { ACCOUNT_KEYS, ACCOUNT_MAP, type AccountKey, type StandardAccounts } from "./accounts";

export { reportingCurrency };

/**
 * us-gaap 표준 계정 매핑 — PRD.md "v1.2 표준 계정 매핑" 절과 동일하게 유지할 것.
 * 태그는 우선순위 순, 연도마다 따로 찾는다(회사가 태그를 바꾸는 경우: 애플 매출 Revenues → RevenueFromContract…).
 * PRD 목록에 없는 계정은 비율 계산에 쓰는 것만 보충했다.
 */
const US_GAAP: Record<AccountKey, string[]> = {
  revenue: [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
  ],
  costOfSales: ["CostOfRevenue", "CostOfGoodsAndServicesSold"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  // us-gaap의 NetIncomeLoss는 지배주주 귀속분이라 지배주주순이익에도 쓴다
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  netIncomeOwners: ["NetIncomeLoss"],
  // 2023년 무렵부터 InterestExpenseNonoperating으로 바꾼 회사가 많다(마이크로소프트)
  interestExpense: ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt"],
  financeCosts: [],
  totalAssets: ["Assets"],
  currentAssets: ["AssetsCurrent"],
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  receivables: ["AccountsReceivableNetCurrent"],
  inventories: ["InventoryNet"],
  totalLiabilities: ["Liabilities"], // 없으면 부채와자본총계 − 자본총계 (아래 deriveLiabilities)
  currentLiabilities: ["LiabilitiesCurrent"],
  payables: ["AccountsPayableCurrent"],
  shortTermBorrowings: ["ShortTermBorrowings", "CommercialPaper"],
  currentPortionOfLongTermDebt: ["LongTermDebtCurrent"],
  longTermBorrowings: ["LongTermDebtNoncurrent"],
  bonds: [], // 미국 회사는 사채를 장기부채(LongTermDebt)에 합쳐 공시
  issuedCapital: ["CommonStockValue"],
  retainedEarnings: ["RetainedEarningsAccumulatedDeficit"],
  totalEquity: ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", "StockholdersEquity"],
  equityOwners: ["StockholdersEquity"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  investingCashFlow: ["NetCashProvidedByUsedInInvestingActivities"],
  financingCashFlow: ["NetCashProvidedByUsedInFinancingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"],
};

/**
 * ifrs-full 매핑: DART 매핑의 account_id에서 "ifrs-full_" 접두사를 뺀 태그명을 재사용.
 * DART 전용 ID(dart_…)만 있는 계정은 그에 해당하는 ifrs-full 태그를 보충한다.
 */
const IFRS_EXTRA: Partial<Record<AccountKey, string[]>> = {
  operatingIncome: ["ProfitLossFromOperatingActivities"], // DART는 dart_OperatingIncomeLoss
};

const IFRS: Record<AccountKey, string[]> = Object.fromEntries(
  ACCOUNT_KEYS.map((key) => [
    key,
    [
      ...ACCOUNT_MAP[key].ids.filter((id) => id.startsWith("ifrs-full_")).map((id) => id.slice("ifrs-full_".length)),
      ...(IFRS_EXTRA[key] ?? []),
    ],
  ]),
) as Record<AccountKey, string[]>;

export const SEC_TAG_MAP: Record<Taxonomy, Record<AccountKey, string[]>> = { "us-gaap": US_GAAP, "ifrs-full": IFRS };

/** 표준 계정 값의 출처 (재무제표 탭에서 SEC label 원문을 보여 주는 데 쓴다) */
export type SecSource = { tag: string; label: string } | { derived: "LiabilitiesAndStockholdersEquity - totalEquity" };

export type SecStandard = {
  taxonomy: Taxonomy;
  /** 보고 통화 (USD, TWD …). 금액은 이 통화 기준 원 단위 값 */
  currency: string;
  /** 연도 오름차순 */
  years: StandardAccounts[];
  /** 회계연도별 기말일 (최신순) */
  periods: FiscalPeriod[];
  /** 연도 → 계정 → 출처. 값을 못 찾은 계정은 없음 */
  sources: Map<number, Partial<Record<AccountKey, SecSource>>>;
};

/**
 * companyfacts → 연도별 표준 계정 (기존 DART 정규화와 같은 형태라 lib/ratios, lib/analysis를 그대로 쓴다).
 * 비율의 평균잔액·증가율을 위해 기본 6개 회계연도(화면 5년 + 1년)를 만든다.
 * 연간 재무 데이터가 없으면 null.
 */
export function normalizeSec(cf: SecCompanyFacts, count = 6): SecStandard | null {
  const ctx = annualContext(cf, count);
  if (!ctx) return null;
  const map = SEC_TAG_MAP[ctx.taxonomy];
  const concepts = cf.facts[ctx.taxonomy] ?? {};

  const years = new Map<number, StandardAccounts>();
  const sources = new Map<number, Partial<Record<AccountKey, SecSource>>>();
  for (const { fiscalYear } of ctx.periods) {
    years.set(fiscalYear, Object.fromEntries([["year", fiscalYear], ...ACCOUNT_KEYS.map((k) => [k, null])]) as StandardAccounts);
    sources.set(fiscalYear, {});
  }

  for (const key of ACCOUNT_KEYS) {
    // 태그별 값을 미리 뽑아 두고 연도마다 우선순위 순으로 첫 값을 고른다
    const byTag = map[key].map((tag) => ({ tag, values: annualTagValues(cf, ctx, tag) }));
    for (const [year, acc] of years) {
      const hit = byTag.find((t) => t.values.has(year));
      if (!hit) continue;
      acc[key] = hit.values.get(year)!.val;
      sources.get(year)![key] = { tag: hit.tag, label: concepts[hit.tag].label ?? humanizeTag(hit.tag) };
    }
  }

  if (ctx.taxonomy === "us-gaap") deriveLiabilities(cf, ctx, years, sources);

  return {
    taxonomy: ctx.taxonomy,
    currency: ctx.currency,
    periods: ctx.periods,
    years: [...years.values()].sort((a, b) => a.year - b.year),
    sources,
  };
}

/**
 * label이 없는 태그(ifrs-full)의 표시명: 태그 이름을 단어로 나눈다.
 * "ProfitLossFromOperatingActivities" → "Profit loss from operating activities"
 */
export function humanizeTag(tag: string): string {
  const words = tag.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").split(" ");
  return words.map((w, i) => (i === 0 || /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
}

/** 부채총계(Liabilities)를 따로 공시하지 않는 회사: 부채와자본총계 − 자본총계 */
function deriveLiabilities(
  cf: SecCompanyFacts,
  ctx: AnnualContext,
  years: Map<number, StandardAccounts>,
  sources: SecStandard["sources"],
) {
  const totals = annualTagValues(cf, ctx, "LiabilitiesAndStockholdersEquity");
  for (const [year, acc] of years) {
    const total = totals.get(year)?.val;
    if (acc.totalLiabilities != null || total == null || acc.totalEquity == null) continue;
    acc.totalLiabilities = total - acc.totalEquity;
    sources.get(year)!.totalLiabilities = { derived: "LiabilitiesAndStockholdersEquity - totalEquity" };
  }
}
