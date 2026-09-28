import type { AnnualReport, DartAccountRow } from "@/lib/dart/types";
import { parseAmount } from "./parse";

/** 화면용 재무제표 구분. IS는 손익계산서가 없으면 포괄손익계산서(CIS)로 대체 */
export type StatementKind = "BS" | "IS" | "CF";

export type StatementRow = {
  key: string;
  label: string;
  /** 들여쓰기 깊이 (0 = 최상위) */
  level: number;
  /** 소계·합계 강조 */
  emphasis: boolean;
  /** 주당이익 등 원 단위 그대로 표시할 행 */
  perShare: boolean;
  /** years와 같은 순서의 값 (원) */
  values: (number | null)[];
};

export type StatementTable = {
  kind: StatementKind;
  /** 실제로 사용한 DART 재무제표 구분 (IS 탭이 CIS로 대체됐는지 표시용) */
  source: "BS" | "IS" | "CIS" | "CF" | null;
  rows: StatementRow[];
};

/**
 * 앵커 계정: 표준 순서(rank)와 계층을 고정하는 계정.
 * 앵커가 아닌 계정은 ord 순서상 직전 앵커의 구간에 속한다.
 * (2025년 이후 DART 데이터는 ord가 합계 우선·계정ID 알파벳순이라 원래 순서를 그대로 쓸 수 없음)
 */
type Anchor = {
  rank: number;
  level: number;
  emphasis?: boolean;
  /** 이 앵커 뒤에 오는 일반 계정의 들여쓰기 */
  childLevel: number;
  ids: string[];
  names?: RegExp;
};

type Layout = {
  anchors: Anchor[];
  /** 순서와 무관하게 이름으로 구간을 정하는 규칙 (자본 항목 등) */
  override?: (row: DartAccountRow) => { rank: number; level: number } | null;
  /** 특정 계정의 들여쓰기 고정 */
  levelById?: Record<string, number>;
};

const BS_LAYOUT: Layout = {
  anchors: [
    { rank: 100, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_CurrentAssets"], names: /^유동자산$/ },
    { rank: 200, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_NoncurrentAssets"], names: /^비유동자산$/ },
    { rank: 300, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_Assets"], names: /^자산총계$/ },
    { rank: 400, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_CurrentLiabilities"], names: /^유동부채$/ },
    { rank: 500, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_NoncurrentLiabilities"], names: /^비유동부채$/ },
    { rank: 600, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_Liabilities"], names: /^부채총계$/ },
    {
      rank: 700,
      level: 0,
      emphasis: true,
      childLevel: 1,
      ids: ["ifrs-full_EquityAttributableToOwnersOfParent"],
      names: /^지배기업(의)?(소유주|소유)(에게귀속되는자본|지분)$/,
    },
    { rank: 800, level: 0, childLevel: 1, ids: ["ifrs-full_NoncontrollingInterests"], names: /^비지배지분$/ },
    { rank: 900, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_Equity"], names: /^자본총계$/ },
    {
      rank: 1000,
      level: 0,
      emphasis: true,
      childLevel: 1,
      ids: ["ifrs-full_EquityAndLiabilities"],
      names: /^(부채와자본|부채및자본|자본및부채|자본과부채)총계$/,
    },
  ],
  // 자본 항목은 ord상 부모(자본총계)보다 앞에 오는 경우가 있어 이름으로 분류
  override: (row) =>
    /자본|잉여금|자기주식|기타포괄손익누계/.test(row.account_nm) && !/부채|자산|투자|채권/.test(row.account_nm)
      ? { rank: 700, level: 1 }
      : null,
  levelById: { dart_IssuedCapitalOfCommonStock: 2, dart_IssuedCapitalOfPreferredStock: 2 },
};

const IS_LAYOUT: Layout = {
  anchors: [
    { rank: 100, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_Revenue"], names: /^(매출액|수익\(매출액\)|매출|영업수익)$/ },
    { rank: 200, level: 1, childLevel: 1, ids: ["ifrs-full_CostOfSales"], names: /^매출원가$/ },
    { rank: 300, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_GrossProfit"], names: /^매출총이익/ },
    { rank: 400, level: 1, childLevel: 1, ids: ["dart_TotalSellingGeneralAdministrativeExpenses"], names: /^판매비와관리비$/ },
    { rank: 500, level: 0, emphasis: true, childLevel: 1, ids: ["dart_OperatingIncomeLoss"], names: /^영업(이익|손익|손실)/ },
    { rank: 510, level: 1, childLevel: 1, ids: ["dart_OtherGains"], names: /^기타(영업외)?(수익|이익)$/ },
    { rank: 520, level: 1, childLevel: 1, ids: ["dart_OtherLosses"], names: /^기타(영업외)?(비용|손실)$/ },
    {
      rank: 530,
      level: 1,
      childLevel: 1,
      ids: ["ifrs-full_ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod"],
      names: /^지분법/,
    },
    { rank: 540, level: 1, childLevel: 1, ids: ["ifrs-full_FinanceIncome"], names: /^금융수익$/ },
    { rank: 550, level: 1, childLevel: 1, ids: ["ifrs-full_FinanceCosts"], names: /^금융(비용|원가)$/ },
    { rank: 600, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_ProfitLossBeforeTax"], names: /^법인세비용차감전/ },
    { rank: 700, level: 1, childLevel: 1, ids: ["ifrs-full_IncomeTaxExpenseContinuingOperations"], names: /^법인세비용/ },
    { rank: 750, level: 1, childLevel: 1, ids: ["ifrs-full_ProfitLossFromContinuingOperations"], names: /^계속영업/ },
    { rank: 760, level: 1, childLevel: 1, ids: ["ifrs-full_ProfitLossFromDiscontinuedOperations"], names: /^중단영업/ },
    { rank: 800, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_ProfitLoss"], names: /^(연결)?당기순(이익|손익|손실)/ },
    {
      rank: 810,
      level: 1,
      childLevel: 1,
      ids: ["ifrs-full_ProfitLossAttributableToOwnersOfParent"],
      names: /^지배기업.*당기순/,
    },
    {
      rank: 820,
      level: 1,
      childLevel: 1,
      ids: ["ifrs-full_ProfitLossAttributableToNoncontrollingInterests"],
      names: /^비지배지분.*당기순/,
    },
    { rank: 900, level: 1, childLevel: 2, ids: ["ifrs-full_OtherComprehensiveIncome"], names: /^기타포괄(손익|이익)$/ },
    { rank: 1000, level: 0, emphasis: true, childLevel: 1, ids: ["ifrs-full_ComprehensiveIncome"], names: /^총포괄(손익|이익)/ },
    { rank: 1010, level: 1, childLevel: 1, ids: ["ifrs-full_ComprehensiveIncomeAttributableToOwnersOfParent"] },
    { rank: 1020, level: 1, childLevel: 1, ids: ["ifrs-full_ComprehensiveIncomeAttributableToNoncontrollingInterests"] },
    { rank: 1100, level: 1, childLevel: 1, ids: ["ifrs-full_BasicEarningsLossPerShare"], names: /^기본주당/ },
    { rank: 1110, level: 1, childLevel: 1, ids: ["ifrs-full_DilutedEarningsLossPerShare"], names: /^희석주당/ },
  ],
};

const CF_LAYOUT: Layout = {
  anchors: [
    {
      rank: 100,
      level: 0,
      emphasis: true,
      childLevel: 1,
      ids: ["ifrs-full_CashFlowsFromUsedInOperatingActivities"],
      names: /^영업활동.*현금흐름$/,
    },
    {
      rank: 200,
      level: 0,
      emphasis: true,
      childLevel: 1,
      ids: ["ifrs-full_CashFlowsFromUsedInInvestingActivities"],
      names: /^투자활동.*현금흐름$/,
    },
    {
      rank: 300,
      level: 0,
      emphasis: true,
      childLevel: 1,
      ids: ["ifrs-full_CashFlowsFromUsedInFinancingActivities"],
      names: /^재무활동.*현금흐름$/,
    },
    {
      rank: 400,
      level: 0,
      childLevel: 1,
      ids: ["ifrs-full_EffectOfExchangeRateChangesOnCashAndCashEquivalents"],
      names: /환율변동|외화환산/,
    },
    {
      rank: 500,
      level: 0,
      emphasis: true,
      childLevel: 1,
      ids: [
        "ifrs-full_IncreaseDecreaseInCashAndCashEquivalents",
        "ifrs-full_IncreaseDecreaseInCashAndCashEquivalentsBeforeEffectOfExchangeRateChanges",
      ],
      names: /^현금및현금성자산의?(순증감|순증가|증가|감소)/,
    },
    { rank: 600, level: 0, childLevel: 1, ids: ["dart_CashAndCashEquivalentsAtBeginningOfPeriodCf"], names: /^기초.*현금/ },
    {
      rank: 700,
      level: 0,
      emphasis: true,
      childLevel: 1,
      ids: ["dart_CashAndCashEquivalentsAtEndOfPeriodCf"],
      names: /^기말.*현금/,
    },
  ],
};

const LAYOUTS: Record<StatementKind, Layout> = { BS: BS_LAYOUT, IS: IS_LAYOUT, CF: CF_LAYOUT };

const squash = (s: string) => s.replace(/\s+/g, "");
const isStandardId = (id: string) => !!id && !id.startsWith("-");
const isPerShare = (row: DartAccountRow) => /EarningsLossPerShare/.test(row.account_id) || /주당/.test(row.account_nm);

/** 보고서에서 해당 탭에 쓸 행과 실제 재무제표 구분 */
function pickRows(rows: DartAccountRow[], kind: StatementKind): { source: StatementTable["source"]; rows: DartAccountRow[] } {
  const plain = rows.filter((r) => !r.account_detail || r.account_detail === "-");
  const of = (sj: string) => plain.filter((r) => r.sj_div === sj);
  if (kind === "IS") {
    const is = of("IS");
    if (is.length) return { source: "IS", rows: is };
    const cis = of("CIS");
    return { source: cis.length ? "CIS" : null, rows: cis };
  }
  const list = of(kind);
  return { source: list.length ? kind : null, rows: list };
}

function findAnchor(layout: Layout, row: DartAccountRow): Anchor | undefined {
  // 이름 규칙은 배열 순서대로 검사하므로 더 구체적인 앵커(법인세비용차감전)가 앞에 있어야 함
  const name = squash(row.account_nm);
  return layout.anchors.find((a) => a.ids.includes(row.account_id)) ?? layout.anchors.find((a) => a.names?.test(name));
}

type Classified = {
  row: DartAccountRow;
  rank: number;
  level: number;
  emphasis: boolean;
  isAnchor: boolean;
};

/** 한 보고서의 행에 구간(rank)·계층을 붙인다 */
function classify(rows: DartAccountRow[], layout: Layout): Classified[] {
  const sorted = [...rows].sort((a, b) => Number(a.ord) - Number(b.ord));
  let current: { rank: number; childLevel: number } = { rank: 0, childLevel: 1 };

  return sorted.map((row) => {
    const anchor = findAnchor(layout, row);
    if (anchor) {
      current = anchor;
      return { row, rank: anchor.rank, level: anchor.level, emphasis: !!anchor.emphasis, isAnchor: true };
    }
    const forced = layout.override?.(row);
    const rank = forced?.rank ?? current.rank;
    const level = layout.levelById?.[row.account_id] ?? forced?.level ?? current.childLevel;
    return { row, rank, level, emphasis: false, isAnchor: false };
  });
}

type Entry = {
  c: Classified;
  key: string;
  order: [number, number];
  values: Map<number, number | null>;
  /** 이미 값을 채운 보고서 (한 보고서의 행은 한 번만 병합) */
  filledBy: Set<number>;
};

/**
 * 이전 보고서의 행과 합칠 기존 행 찾기.
 * 연도마다 같은 계정의 ID가 바뀌기도 해서(표준ID ↔ 미사용) 이름을 주로 쓴다:
 * 앵커는 같은 앵커끼리, 일반 계정은 같은 구간·같은 이름 → 같은 표준ID → 같은 이름(구간 무관) 순.
 */
function findMatch(entries: Entry[], c: Classified, reportIdx: number): Entry | undefined {
  const open = entries.filter((e) => !e.filledBy.has(reportIdx));
  const name = squash(c.row.account_nm);
  const sameName = (e: Entry) => squash(e.c.row.account_nm) === name;
  if (c.isAnchor) return open.find((e) => e.c.isAnchor && e.c.rank === c.rank) ?? open.find(sameName);

  const plain = open.filter((e) => !e.c.isAnchor);
  return (
    plain.find((e) => e.c.rank === c.rank && sameName(e)) ??
    (isStandardId(c.row.account_id) ? plain.find((e) => e.c.row.account_id === c.row.account_id) : undefined) ??
    open.find(sameName)
  );
}

const PERIOD_FIELDS = ["thstrm_amount", "frmtrm_amount", "bfefrmtrm_amount"] as const;

/** 표시할 연도(내림차순): 최신 보고서 사업연도부터 count개 */
export function statementYears(reports: AnnualReport[], count = 5): number[] {
  const latest = Math.max(...reports.map((r) => r.bsnsYear));
  return Number.isFinite(latest) ? Array.from({ length: count }, (_, i) => latest - i) : [];
}

/**
 * 사업보고서들 → 화면용 재무제표 표.
 * 행 순서·라벨은 최신 보고서 기준, 이전 보고서에만 있는 계정은 해당 구간 끝에 붙인다.
 */
export function buildStatementTable(reports: AnnualReport[], kind: StatementKind, years: number[]): StatementTable {
  const layout = LAYOUTS[kind];
  const newestFirst = [...reports].sort((a, b) => b.bsnsYear - a.bsnsYear);
  const entries: Entry[] = [];
  let source: StatementTable["source"] = null;

  newestFirst.forEach((report, reportIdx) => {
    const picked = pickRows(report.rows, kind);
    source ??= picked.source;
    for (const c of classify(picked.rows, layout)) {
      let entry = findMatch(entries, c, reportIdx);
      if (!entry) {
        const order: [number, number] = [reportIdx, Number(c.row.ord)];
        entry = { c, key: `${report.bsnsYear}-${c.row.ord}-${entries.length}`, order, values: new Map(), filledBy: new Set() };
        entries.push(entry);
      }
      entry.filledBy.add(reportIdx);
      PERIOD_FIELDS.forEach((field, offset) => {
        const year = report.bsnsYear - offset;
        const value = parseAmount(c.row[field]);
        // 최신 보고서 값 우선, 비어 있으면 이전 보고서로 보충
        if (entry.values.get(year) == null) entry.values.set(year, value);
      });
    }
  });

  const rows = [...entries]
    .sort(
      (a, b) =>
        a.c.rank - b.c.rank ||
        Number(b.c.isAnchor) - Number(a.c.isAnchor) ||
        a.order[0] - b.order[0] ||
        a.order[1] - b.order[1],
    )
    .map(({ c, key, values }) => ({
      key,
      label: c.row.account_nm.trim(),
      level: c.level,
      emphasis: c.emphasis,
      perShare: isPerShare(c.row),
      values: years.map((y) => values.get(y) ?? null),
    }))
    .filter((r) => r.values.some((v) => v !== null));

  return { kind, source, rows };
}
