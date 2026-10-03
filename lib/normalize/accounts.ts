import type { AnnualReport, DartAccountRow, SjDiv } from "@/lib/dart/types";
import { parseAmount } from "./parse";

type AccountDef = {
  label: string;
  /** 찾아볼 재무제표 순서. 손익 항목은 IS 우선, IS가 없으면(단일 포괄손익계산서) CIS */
  statements: SjDiv[];
  /** 표준 계정ID (우선 매칭) */
  ids: string[];
  /** 계정ID가 "-표준계정코드 미사용-" 등일 때 쓰는 계정명 대체 매칭 (공백 무시 완전일치) */
  names: string[];
};

const INCOME: SjDiv[] = ["IS", "CIS"];

/** 표준 계정 매핑표 — PRD.md "표준 계정 매핑" 절과 동일하게 유지할 것 */
export const ACCOUNT_MAP = {
  // 손익
  revenue: {
    label: "매출액",
    statements: INCOME,
    ids: ["ifrs-full_Revenue"],
    names: ["매출액", "수익(매출액)", "매출", "영업수익", "매출액(영업수익)"],
  },
  costOfSales: { label: "매출원가", statements: INCOME, ids: ["ifrs-full_CostOfSales"], names: ["매출원가"] },
  grossProfit: {
    label: "매출총이익",
    statements: INCOME,
    ids: ["ifrs-full_GrossProfit"],
    names: ["매출총이익", "매출총이익(손실)"],
  },
  operatingIncome: {
    label: "영업이익",
    statements: INCOME,
    ids: ["dart_OperatingIncomeLoss"],
    names: ["영업이익", "영업이익(손실)", "영업손익", "영업손실"],
  },
  netIncome: {
    label: "당기순이익",
    statements: INCOME,
    ids: ["ifrs-full_ProfitLoss"],
    // 분기·반기 보고서는 "분기순이익"·"반기순이익"
    names: [
      "당기순이익",
      "당기순이익(손실)",
      "당기순손익",
      "연결당기순이익",
      "당기순손실",
      "분기순이익",
      "분기순이익(손실)",
      "반기순이익",
      "반기순이익(손실)",
    ],
  },
  netIncomeOwners: {
    label: "지배주주순이익",
    statements: INCOME,
    ids: ["ifrs-full_ProfitLossAttributableToOwnersOfParent"],
    // "지배기업 소유주지분"은 총포괄이익 귀속분과 이름이 같아 대체 매칭에서 제외
    names: ["지배기업의소유주에게귀속되는당기순이익", "지배기업소유주지분순이익"],
  },
  interestExpense: { label: "이자비용", statements: INCOME, ids: ["ifrs-full_InterestExpense"], names: ["이자비용"] },
  financeCosts: {
    label: "금융비용",
    statements: INCOME,
    ids: ["ifrs-full_FinanceCosts"],
    names: ["금융비용", "금융원가", "재무비용", "재무원가"],
  },
  // 재무상태
  totalAssets: { label: "자산총계", statements: ["BS"], ids: ["ifrs-full_Assets"], names: ["자산총계"] },
  currentAssets: { label: "유동자산", statements: ["BS"], ids: ["ifrs-full_CurrentAssets"], names: ["유동자산"] },
  cash: {
    label: "현금및현금성자산",
    statements: ["BS"],
    ids: ["ifrs-full_CashAndCashEquivalents"],
    names: ["현금및현금성자산"],
  },
  receivables: {
    label: "매출채권",
    statements: ["BS"],
    ids: ["ifrs-full_CurrentTradeReceivables", "ifrs-full_TradeAndOtherCurrentReceivables", "ifrs-full_TradeReceivables"],
    names: ["매출채권", "매출채권및기타채권", "매출채권및기타유동채권", "매출채권및기타채권(유동)"],
  },
  inventories: { label: "재고자산", statements: ["BS"], ids: ["ifrs-full_Inventories"], names: ["재고자산"] },
  totalLiabilities: { label: "부채총계", statements: ["BS"], ids: ["ifrs-full_Liabilities"], names: ["부채총계"] },
  currentLiabilities: {
    label: "유동부채",
    statements: ["BS"],
    ids: ["ifrs-full_CurrentLiabilities"],
    names: ["유동부채"],
  },
  payables: {
    label: "매입채무",
    statements: ["BS"],
    ids: [
      "ifrs-full_TradeAndOtherCurrentPayablesToTradeSuppliers",
      "ifrs-full_CurrentTradePayables",
      "ifrs-full_TradeAndOtherCurrentPayables",
    ],
    names: ["매입채무", "매입채무및기타채무", "매입채무및기타유동채무", "매입채무및기타채무(유동)"],
  },
  shortTermBorrowings: {
    label: "단기차입금",
    statements: ["BS"],
    // 단기차입금과 유동성장기부채를 한 줄("차입금")로 공시하는 회사는 합친 값이 여기 들어간다
    ids: [
      "ifrs-full_ShorttermBorrowings",
      "dart_ShortTermBorrowings",
      "dart_CurrentLoansReceived",
      "ifrs-full_CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings",
    ],
    names: ["단기차입금", "단기차입부채"],
  },
  currentPortionOfLongTermDebt: {
    label: "유동성장기부채",
    statements: ["BS"],
    ids: ["ifrs-full_CurrentPortionOfLongtermBorrowings"],
    names: ["유동성장기부채", "유동성장기차입금", "유동성장기차입금및사채"],
  },
  longTermBorrowings: {
    label: "장기차입금",
    statements: ["BS"],
    ids: ["ifrs-full_NoncurrentPortionOfNoncurrentLoansReceived", "ifrs-full_LongtermBorrowings", "dart_LongTermBorrowingsGross"],
    names: ["장기차입금", "장기차입부채"],
  },
  bonds: {
    label: "사채",
    statements: ["BS"],
    ids: ["ifrs-full_NoncurrentPortionOfNoncurrentBondsIssued", "ifrs-full_BondsIssued", "dart_BondsIssued"],
    names: ["사채", "비유동사채"],
  },
  issuedCapital: { label: "자본금", statements: ["BS"], ids: ["ifrs-full_IssuedCapital"], names: ["자본금"] },
  retainedEarnings: {
    label: "이익잉여금",
    statements: ["BS"],
    ids: ["ifrs-full_RetainedEarnings"],
    names: ["이익잉여금", "이익잉여금(결손금)", "결손금", "미처분이익잉여금(미처리결손금)"],
  },
  totalEquity: { label: "자본총계", statements: ["BS"], ids: ["ifrs-full_Equity"], names: ["자본총계"] },
  equityOwners: {
    label: "지배주주지분",
    statements: ["BS"],
    ids: ["ifrs-full_EquityAttributableToOwnersOfParent"],
    names: ["지배기업소유주지분", "지배기업의소유주에게귀속되는자본", "지배기업소유지분"],
  },
  // 현금흐름
  operatingCashFlow: {
    label: "영업활동현금흐름",
    statements: ["CF"],
    ids: ["ifrs-full_CashFlowsFromUsedInOperatingActivities"],
    names: ["영업활동현금흐름", "영업활동으로인한현금흐름"],
  },
  investingCashFlow: {
    label: "투자활동현금흐름",
    statements: ["CF"],
    ids: ["ifrs-full_CashFlowsFromUsedInInvestingActivities"],
    names: ["투자활동현금흐름", "투자활동으로인한현금흐름"],
  },
  financingCashFlow: {
    label: "재무활동현금흐름",
    statements: ["CF"],
    ids: ["ifrs-full_CashFlowsFromUsedInFinancingActivities"],
    names: ["재무활동현금흐름", "재무활동으로인한현금흐름"],
  },
  // 유출을 양수로 적는 회사와 음수로 적는 회사가 섞여 있어 쓰는 쪽에서 절댓값을 쓴다
  capex: {
    label: "유형자산의 취득",
    statements: ["CF"],
    ids: [
      "ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities",
      "ifrs-full_PurchaseOfPropertyPlantAndEquipment",
    ],
    names: ["유형자산의취득", "유형자산취득", "유형자산의증가"],
  },
} satisfies Record<string, AccountDef>;

export type AccountKey = keyof typeof ACCOUNT_MAP;
export const ACCOUNT_KEYS = Object.keys(ACCOUNT_MAP) as AccountKey[];

/** 연도별 표준 계정. 값이 없으면 null (금액 단위: 원) */
export type StandardAccounts = { year: number } & Record<AccountKey, number | null>;

/** 사업보고서 한 건 안의 기간 컬럼 → 해당 보고서 사업연도로부터의 차이 */
const PERIODS = [
  { field: "thstrm_amount", offset: 0 },
  { field: "frmtrm_amount", offset: 1 },
  { field: "bfefrmtrm_amount", offset: 2 },
] as const;

const squash = (s: string) => s.replace(/\s+/g, "");

/** 계정 정의에 맞는 행 찾기: 재무제표 우선순위 → 계정ID → 계정명 순 */
export function findRow(rows: DartAccountRow[], def: AccountDef): DartAccountRow | undefined {
  const names = def.names.map(squash);
  for (const sj of def.statements) {
    // 자본변동표 구성요소 행 등 세부 행(account_detail)은 제외
    const candidates = rows
      .filter((r) => r.sj_div === sj && (!r.account_detail || r.account_detail === "-"))
      .sort((a, b) => Number(a.ord) - Number(b.ord));
    const hit =
      candidates.find((r) => def.ids.includes(r.account_id)) ??
      candidates.find((r) => names.includes(squash(r.account_nm)));
    if (hit) return hit;
  }
  return undefined;
}

const emptyYear = (year: number): StandardAccounts =>
  Object.fromEntries([["year", year], ...ACCOUNT_KEYS.map((k) => [k, null])]) as StandardAccounts;

/** 사업보고서 한 건 → 당기·전기·전전기 3개년 표준 계정 (연도 오름차순) */
export function normalizeReport(report: AnnualReport): StandardAccounts[] {
  const years = PERIODS.map(({ offset }) => emptyYear(report.bsnsYear - offset));
  for (const key of ACCOUNT_KEYS) {
    const row = findRow(report.rows, ACCOUNT_MAP[key]);
    if (!row) continue;
    PERIODS.forEach(({ field }, i) => {
      years[i][key] = parseAmount(row[field]);
    });
  }
  return years.reverse();
}

/**
 * 여러 사업보고서 → 연도별 표준 계정 (연도 오름차순, 최근 count개 연도).
 * 같은 연도가 여러 보고서에 있으면 최신 보고서(재작성 반영) 값을 우선하고, 거기 없는 항목만 이전 보고서로 채운다.
 */
export function buildStandardYears(reports: AnnualReport[], count = 5): StandardAccounts[] {
  const byYear = new Map<number, StandardAccounts>();
  const newestFirst = [...reports].sort((a, b) => b.bsnsYear - a.bsnsYear);

  for (const report of newestFirst) {
    for (const acc of normalizeReport(report)) {
      const existing = byYear.get(acc.year);
      if (!existing) {
        byYear.set(acc.year, acc);
        continue;
      }
      for (const key of ACCOUNT_KEYS) existing[key] ??= acc[key];
    }
  }

  // 모든 항목이 비어 있는 연도(보고서에 전전기 컬럼이 없는 경우 등)는 제외
  const years = [...byYear.values()].filter((y) => ACCOUNT_KEYS.some((k) => y[k] !== null));
  return years.sort((a, b) => a.year - b.year).slice(-count);
}
