import { describe, expect, it } from "vitest";
import type { DartAccountRow, ReportCode } from "@/lib/dart/types";
import { buildQuarterly, quartersBack, reportKey, requiredReports, type QuarterReportSet } from "./quarterly";

const row = (sj: DartAccountRow["sj_div"], id: string, nm: string, thstrm: number, add?: number): DartAccountRow => ({
  rcept_no: "",
  reprt_code: "",
  bsns_year: "",
  corp_code: "",
  sj_div: sj,
  sj_nm: "",
  account_id: id,
  account_nm: nm,
  account_detail: "-",
  thstrm_nm: "",
  thstrm_amount: String(thstrm),
  thstrm_add_amount: add == null ? undefined : String(add),
  ord: "1",
  currency: "KRW",
});

/**
 * DART 분기 보고서 형식: 손익 thstrm = 3개월, thstrm_add = 누적 / 현금흐름 thstrm = 누적.
 * 분기 매출 100·120·130·150 (연 500), 영업CF 누적 30·70·100·160, 유형자산 취득은 회사처럼 음수로 적힘
 */
function report(rev3m: number, revCum: number, ocfCum: number, capexCum: number): DartAccountRow[] {
  return [
    row("IS", "ifrs-full_Revenue", "매출액", rev3m, revCum),
    row("IS", "dart_OperatingIncomeLoss", "영업이익", rev3m / 10, revCum / 10),
    row("IS", "-표준계정코드 미사용-", "분기순이익", rev3m / 20, revCum / 20),
    row("CF", "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", ocfCum),
    row("CF", "ifrs-full_PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "유형자산의 취득", capexCum),
  ];
}

const set = (entries: [number, ReportCode, DartAccountRow[]][]): QuarterReportSet =>
  new Map(entries.map(([y, c, rows]) => [reportKey(y, c), rows]));

const YEAR_2025: [number, ReportCode, DartAccountRow[]][] = [
  [2025, "11013", report(100, 100, 30, -10)],
  [2025, "11012", report(120, 220, 70, -25)],
  [2025, "11014", report(130, 350, 100, -40)],
  // 사업보고서: 연간 값이 thstrm
  [2025, "11011", report(500, 500, 160, -60)],
];

describe("quartersBack", () => {
  it("최신 분기에서 거꾸로, 오래된 것부터", () => {
    expect(quartersBack({ year: 2026, q: 2 }, 4)).toEqual([
      { year: 2025, q: 3 },
      { year: 2025, q: 4 },
      { year: 2026, q: 1 },
      { year: 2026, q: 2 },
    ]);
    expect(quartersBack({ year: 2026, q: 2 }, 12)[0]).toEqual({ year: 2023, q: 3 });
  });
});

describe("requiredReports", () => {
  it("현금흐름 차감을 위해 직전 분기 보고서까지", () => {
    const keys = requiredReports([{ year: 2025, q: 4 }]).map((r) => reportKey(r.year, r.code));
    expect(keys.sort()).toEqual(["2025-11011", "2025-11014"]);
    const first = requiredReports([{ year: 2025, q: 2 }]).map((r) => r.code);
    expect(first.sort()).toEqual(["11012", "11013"]);
  });
});

describe("buildQuarterly", () => {
  const quarters = quartersBack({ year: 2025, q: 4 }, 4);
  const points = buildQuarterly(set(YEAR_2025), quarters);

  it("손익은 3개월 값, 4분기 = 연간 − 3분기 누적", () => {
    expect(points.map((p) => p.revenue)).toEqual([100, 120, 130, 150]);
    expect(points.map((p) => p.operatingIncome)).toEqual([10, 12, 13, 15]);
    expect(points.map((p) => p.netIncome)).toEqual([5, 6, 6.5, 7.5]); // "분기순이익" 계정명도 매칭
    expect(points.map((p) => p.label)).toEqual(["25.1Q", "25.2Q", "25.3Q", "25.4Q"]);
  });

  it("현금흐름은 누적 차감, 유형자산 취득은 부호와 무관하게 양수", () => {
    expect(points.map((p) => p.operatingCashFlow)).toEqual([30, 40, 30, 60]);
    expect(points.map((p) => p.capex)).toEqual([10, 15, 15, 20]);
    expect(points.map((p) => p.fcf)).toEqual([20, 25, 15, 40]);
  });

  it("분기 합계 = 연간", () => {
    expect(points.reduce((s, p) => s + p.revenue!, 0)).toBe(500);
    expect(points.reduce((s, p) => s + p.operatingCashFlow!, 0)).toBe(160);
  });

  it("영업이익률, 전년 동기가 범위 안에 없으면 YoY null", () => {
    expect(points[0].operatingMargin).toBeCloseTo(0.1, 12);
    expect(points.every((p) => p.revenueYoY === null)).toBe(true);
  });

  it("전년 동기 대비 매출 증가율", () => {
    const two = set([...YEAR_2025, [2026, "11013", report(110, 110, 20, -5)]]);
    const pts = buildQuarterly(two, quartersBack({ year: 2026, q: 1 }, 5));
    expect(pts.at(-1)!.revenueYoY).toBeCloseTo(0.1, 12);
  });

  it("3분기 누적 필드가 비면 1~3분기 3개월 값의 합으로 4분기를 낸다", () => {
    const noCum = set(
      YEAR_2025.map(([y, c, rows]) => [y, c, c === "11014" ? rows.map((r) => ({ ...r, thstrm_add_amount: "" })) : rows]),
    );
    expect(buildQuarterly(noCum, [{ year: 2025, q: 4 }])[0].revenue).toBe(150);
  });

  it("직전 보고서가 없으면 현금흐름 분기 값은 null (손익은 그대로)", () => {
    const missing = set(YEAR_2025.filter(([, c]) => c !== "11012"));
    const [q3] = buildQuarterly(missing, [{ year: 2025, q: 3 }]);
    expect(q3.revenue).toBe(130);
    expect(q3.operatingCashFlow).toBeNull();
  });
});
