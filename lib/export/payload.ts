import type { Analysis } from "@/lib/analysis";
import type { RiskCheck } from "@/lib/analysis/risk";
import type { MetricUnit } from "@/lib/format";
import type { StatementTable } from "@/lib/normalize/statement";
import { CATEGORY_LABEL, RATIOS, type RatioYear } from "@/lib/ratios";

/** /api/export 응답 — 클라이언트가 이걸로 엑셀 파일을 만든다 */
export type ExportPayload = {
  company: { corpCode: string; name: string; stockCode: string };
  fs: "CFS" | "OFS";
  /** ISO 시각 */
  generatedAt: string;
  statements: { title: string; years: number[]; rows: ExportStatementRow[] }[];
  ratios: { years: number[]; rows: { category: string; label: string; unit: MetricUnit; formula: string; values: (number | null)[] }[] };
  analysis: Analysis;
  risks: RiskCheck[];
};

export type ExportStatementRow = {
  label: string;
  level: number;
  tier: "total" | "subtotal" | "item";
  perShare: boolean;
  values: (number | null)[];
};

const SECTION_LABEL: Record<string, string> = {
  operating: "영업",
  investing: "투자",
  financing: "재무",
  assets: "자산",
  liabilities: "부채",
  equity: "자본",
  summary: "",
};

/** 화면용 재무제표 표 → 엑셀용 (범주가 바뀌는 곳에 범주 머리행을 넣는다) */
export function statementForExport(title: string, years: number[], table: StatementTable, withSections: boolean) {
  const rows: ExportStatementRow[] = [];
  table.rows.forEach((row, i) => {
    const label = SECTION_LABEL[row.section];
    if (withSections && label && (i === 0 || table.rows[i - 1].section !== row.section))
      rows.push({ label: `[${label}]`, level: 0, tier: "subtotal", perShare: false, values: years.map(() => null) });
    rows.push({ label: row.label, level: row.level, tier: row.tier, perShare: row.perShare, values: row.values });
  });
  return { title, years, rows };
}

export function ratiosForExport(ratioYears: RatioYear[], years: number[]): ExportPayload["ratios"] {
  const byYear = new Map(ratioYears.map((r) => [r.year, r.values]));
  return {
    years,
    rows: RATIOS.map((r) => ({
      category: CATEGORY_LABEL[r.category],
      label: r.label,
      unit: r.unit,
      formula: r.formula.replace(/\n/g, " "),
      values: years.map((y) => byYear.get(y)?.[r.key] ?? null),
    })),
  };
}
