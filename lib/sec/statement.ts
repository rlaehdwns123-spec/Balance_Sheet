import { ACCOUNT_MAP, type AccountKey } from "@/lib/normalize/accounts";
import type { SecStandard } from "@/lib/normalize/sec";
import type { RowTier, Section, StatementKind, StatementRow, StatementTable } from "@/lib/normalize/statement";

/**
 * 미국 기업 재무제표 탭 — PRD.md "v1.2 화면 규칙": 표준 계정을 표준 순서로, 계정명은 SEC label 원문.
 * companyfacts에는 보고서의 표시 순서가 없어 표준 계정만 고정된 순서로 보여 준다.
 */
type RowDef = { key: AccountKey; tier: RowTier; level: number; section: Section };

const row = (key: AccountKey, section: Section, tier: RowTier = "item", level = 0): RowDef => ({ key, tier, level, section });

const LAYOUT: Record<StatementKind, RowDef[]> = {
  BS: [
    row("currentAssets", "assets", "subtotal"),
    row("cash", "assets", "item", 1),
    row("receivables", "assets", "item", 1),
    row("inventories", "assets", "item", 1),
    row("totalAssets", "assets", "total"),
    row("currentLiabilities", "liabilities", "subtotal"),
    row("payables", "liabilities", "item", 1),
    row("shortTermBorrowings", "liabilities", "item", 1),
    row("currentPortionOfLongTermDebt", "liabilities", "item", 1),
    row("longTermBorrowings", "liabilities"),
    row("bonds", "liabilities"),
    row("totalLiabilities", "liabilities", "total"),
    row("equityOwners", "equity", "subtotal"),
    row("issuedCapital", "equity", "item", 1),
    row("retainedEarnings", "equity", "item", 1),
    row("totalEquity", "equity", "total"),
  ],
  // 미국 회계기준은 IFRS 18 범주가 없어 손익계산서는 범주 없이(summary) 위계만
  IS: [
    row("revenue", "summary", "subtotal"),
    row("costOfSales", "summary", "item", 1),
    row("grossProfit", "summary", "subtotal"),
    row("operatingIncome", "summary", "subtotal"),
    row("interestExpense", "summary", "item", 1),
    row("financeCosts", "summary", "item", 1),
    row("netIncome", "summary", "total"),
    row("netIncomeOwners", "summary", "item", 1),
  ],
  CF: [
    row("operatingCashFlow", "operating", "subtotal"),
    row("capex", "investing", "item", 1),
    row("investingCashFlow", "investing", "subtotal"),
    row("financingCashFlow", "financing", "subtotal"),
  ],
};

/**
 * 지배주주 기준 행이 상위 행과 같은 태그면(us-gaap에서 자본총계·당기순이익이 지배주주 귀속분뿐인 회사) 같은 줄이 두 번 나오므로 뺀다
 */
const SAME_AS: Partial<Record<AccountKey, AccountKey>> = { netIncomeOwners: "netIncome", equityOwners: "totalEquity" };

const DERIVED_LABEL = "Liabilities (Liabilities and Equity − Equity)";

/** 공통형 기준: 손익계산서 매출액, 재무상태표 자산총계 */
const BASE_KEY: Partial<Record<StatementKind, AccountKey>> = { IS: "revenue", BS: "totalAssets" };

/** 기말일 "2025-09-27" → "25.09.27" */
const shortDate = (end: string) => end.slice(2).replace(/-/g, ".");

/**
 * 표준 계정 → 화면용 재무제표 표 (최신 연도가 첫 열).
 * 모든 연도가 비어 있는 계정은 빼고, 일부 연도만 비면 그 칸은 "–".
 */
export function buildSecStatements(
  std: SecStandard,
  count = 5,
): Record<StatementKind, StatementTable> {
  const years = std.years.slice(-count).reverse();
  const ends = new Map(std.periods.map((p) => [p.fiscalYear, p.end]));
  const columns = years.map((y) => {
    const end = ends.get(y.year);
    return { key: String(y.year), label: String(y.year), ...(end ? { sub: shortDate(end) } : {}) };
  });

  const labelOf = (key: AccountKey) => {
    for (const y of years) {
      const src = std.sources.get(y.year)?.[key];
      if (src) return "tag" in src ? src.label : DERIVED_LABEL;
    }
    return ACCOUNT_MAP[key].label;
  };

  const build = (kind: StatementKind): StatementTable => {
    const rows: StatementRow[] = LAYOUT[kind]
      .map((def) => ({
        key: def.key,
        label: labelOf(def.key),
        labelKo: ACCOUNT_MAP[def.key].label,
        level: def.level,
        tier: def.tier,
        section: def.section,
        perShare: false,
        values: years.map((y) => y[def.key]),
      }))
      .filter((r) => r.values.some((v) => v != null))
      .filter((r) => {
        const parent = SAME_AS[r.key as AccountKey];
        if (!parent) return true;
        const tagOf = (year: number, key: AccountKey) => {
          const src = std.sources.get(year)?.[key];
          return src && "tag" in src ? src.tag : null;
        };
        return !years.every((y) => y[r.key as AccountKey] == null || tagOf(y.year, r.key as AccountKey) === tagOf(y.year, parent));
      });
    const baseKey = BASE_KEY[kind];
    const base = baseKey ? years.map((y) => y[baseKey]) : null;
    return {
      kind,
      columns,
      compare: false,
      source: kind,
      format: "kifrs",
      rows,
      base: base?.some((v) => v != null) ? base : null,
    };
  };

  return { BS: build("BS"), IS: build("IS"), CF: build("CF") };
}
