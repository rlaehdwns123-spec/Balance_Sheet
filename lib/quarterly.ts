import type { DartAccountRow, ReportCode } from "@/lib/dart/types";
import { ACCOUNT_MAP, findRow, type AccountKey } from "@/lib/normalize/accounts";
import { parseAmount } from "@/lib/normalize/parse";

/**
 * 분기 실적 — PRD.md "분기 실적" 절과 동일하게 유지할 것.
 *
 * DART 분기·반기 보고서(fnlttSinglAcntAll) 응답에서
 * - 손익: thstrm_amount = 해당 분기 3개월, thstrm_add_amount = 연초부터 누적
 * - 현금흐름: thstrm_amount = 연초부터 누적 (3개월 값 없음)
 * 그래서 손익 4분기 = 연간 − 3분기 누적, 현금흐름 분기 값 = 이번 누적 − 직전 누적.
 */

export type Quarter = 1 | 2 | 3 | 4;
export type QuarterRef = { year: number; q: Quarter };

/** 분기 → 보고서 코드 (4분기는 사업보고서) */
export const REPORT_OF: Record<Quarter, ReportCode> = { 1: "11013", 2: "11012", 3: "11014", 4: "11011" };

/** 사업연도·보고서 코드별 원본 행. 없는 보고서는 넣지 않는다 */
export type QuarterReportSet = Map<string, DartAccountRow[]>;
export const reportKey = (year: number, code: ReportCode) => `${year}-${code}`;

export type QuarterPoint = QuarterRef & {
  label: string;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  /** 영업이익 ÷ 매출액 */
  operatingMargin: number | null;
  operatingCashFlow: number | null;
  /** 유형자산의 취득 (양수) */
  capex: number | null;
  /** 영업활동현금흐름 − 유형자산의 취득 */
  fcf: number | null;
  /** 매출액 전년 동기 대비 */
  revenueYoY: number | null;
};

const FLOW_KEYS = ["revenue", "operatingIncome", "netIncome"] as const satisfies AccountKey[];
const CF_KEYS = ["operatingCashFlow", "capex"] as const satisfies AccountKey[];

export const quarterLabel = ({ year, q }: QuarterRef) => `${String(year).slice(2)}.${q}Q`;

/** ref에서 거꾸로 count개 분기 (오래된 것부터) */
export function quartersBack(latest: QuarterRef, count: number): QuarterRef[] {
  const out: QuarterRef[] = [];
  let { year, q } = latest;
  for (let i = 0; i < count; i++) {
    out.unshift({ year, q });
    if (q === 1) {
      q = 4;
      year -= 1;
    } else q = (q - 1) as Quarter;
  }
  return out;
}

/**
 * 분기 목록을 계산하는 데 필요한 보고서들.
 * 2분기 현금흐름은 1분기 누적, 3분기는 반기 누적, 4분기는 3분기 누적이 있어야 차감할 수 있다.
 */
export function requiredReports(quarters: QuarterRef[]): { year: number; code: ReportCode }[] {
  const keys = new Map<string, { year: number; code: ReportCode }>();
  const need = (year: number, q: Quarter) => keys.set(reportKey(year, REPORT_OF[q]), { year, code: REPORT_OF[q] });
  for (const { year, q } of quarters) {
    need(year, q);
    if (q > 1) need(year, (q - 1) as Quarter);
  }
  return [...keys.values()];
}

function amount(rows: DartAccountRow[] | undefined, key: AccountKey, field: "thstrm_amount" | "thstrm_add_amount") {
  if (!rows) return null;
  const row = findRow(rows, ACCOUNT_MAP[key]);
  return row ? parseAmount(row[field]) : null;
}

/** 손익 3개월 값 */
function flowOf(reports: QuarterReportSet, { year, q }: QuarterRef, key: AccountKey): number | null {
  if (q < 4) return amount(reports.get(reportKey(year, REPORT_OF[q])), key, "thstrm_amount");
  const annual = amount(reports.get(reportKey(year, "11011")), key, "thstrm_amount");
  const cumulative9 = cumulativeFlow(reports, year, 3, key);
  return annual == null || cumulative9 == null ? null : annual - cumulative9;
}

/** 손익 연초부터 q분기까지 누적 (누적 필드가 비면 분기 3개월 값 합) */
function cumulativeFlow(reports: QuarterReportSet, year: number, q: 1 | 2 | 3, key: AccountKey): number | null {
  const rows = reports.get(reportKey(year, REPORT_OF[q]));
  // 1분기는 3개월 = 누적
  const direct = amount(rows, key, q === 1 ? "thstrm_amount" : "thstrm_add_amount");
  if (direct != null) return direct;
  if (q === 1) return null;
  const parts = ([1, 2, 3] as const).filter((x) => x <= q).map((x) => flowOf(reports, { year, q: x }, key));
  return parts.every((v) => v != null) ? parts.reduce((s, v) => s! + v!, 0) : null;
}

/** 현금흐름 분기 값 = 이번 누적 − 직전 분기 누적 */
function cashOf(reports: QuarterReportSet, { year, q }: QuarterRef, key: AccountKey): number | null {
  const abs = key === "capex";
  const cum = (qq: Quarter) => {
    const v = amount(reports.get(reportKey(year, REPORT_OF[qq])), key, "thstrm_amount");
    return v != null && abs ? Math.abs(v) : v;
  };
  const current = cum(q);
  if (q === 1 || current == null) return current;
  const before = cum((q - 1) as Quarter);
  return before == null ? null : current - before;
}

/** 원본 보고서 → 분기 실적 (quarters 순서 그대로) */
export function buildQuarterly(reports: QuarterReportSet, quarters: QuarterRef[]): QuarterPoint[] {
  const points = quarters.map((ref) => {
    const flow = Object.fromEntries(FLOW_KEYS.map((k) => [k, flowOf(reports, ref, k)])) as Record<
      (typeof FLOW_KEYS)[number],
      number | null
    >;
    const cash = Object.fromEntries(CF_KEYS.map((k) => [k, cashOf(reports, ref, k)])) as Record<
      (typeof CF_KEYS)[number],
      number | null
    >;
    return {
      ...ref,
      label: quarterLabel(ref),
      ...flow,
      operatingMargin:
        flow.operatingIncome != null && flow.revenue != null && flow.revenue > 0 ? flow.operatingIncome / flow.revenue : null,
      ...cash,
      fcf: cash.operatingCashFlow != null && cash.capex != null ? cash.operatingCashFlow - cash.capex : null,
      revenueYoY: null as number | null,
    };
  });
  for (const p of points) {
    const lastYear = points.find((x) => x.year === p.year - 1 && x.q === p.q);
    if (lastYear?.revenue != null && lastYear.revenue > 0 && p.revenue != null) p.revenueYoY = p.revenue / lastYear.revenue - 1;
  }
  return points;
}
