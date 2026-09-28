import { describe, expect, it } from "vitest";
import type { AnnualReport, DartAccountRow, SjDiv } from "@/lib/dart/types";
import { buildStandardYears, normalizeReport } from "./accounts";

let ord = 0;
function row(
  sj_div: SjDiv,
  account_id: string,
  account_nm: string,
  [thstrm, frmtrm, bfefrmtrm]: [string, string?, string?],
  account_detail = "-",
): DartAccountRow {
  return {
    rcept_no: "20260310000001",
    reprt_code: "11011",
    bsns_year: "2025",
    corp_code: "00000001",
    sj_div,
    sj_nm: "",
    account_id,
    account_nm,
    account_detail,
    thstrm_nm: "",
    thstrm_amount: thstrm,
    frmtrm_amount: frmtrm,
    bfefrmtrm_amount: bfefrmtrm,
    ord: String(++ord),
    currency: "KRW",
  };
}

const report = (bsnsYear: number, rows: DartAccountRow[]): AnnualReport => ({ bsnsYear, rows });

describe("normalizeReport", () => {
  it("당기·전기·전전기를 연도별로 펼치고 금액을 파싱한다", () => {
    const years = normalizeReport(
      report(2025, [
        row("IS", "ifrs-full_Revenue", "매출액", ["3,000", "2,000", "1,000"]),
        row("IS", "dart_OperatingIncomeLoss", "영업이익", ["300", "-200", "(100)"]),
        row("BS", "ifrs-full_Assets", "자산총계", ["9,000", "8,000", ""]),
      ]),
    );

    expect(years.map((y) => y.year)).toEqual([2023, 2024, 2025]);
    expect(years.map((y) => y.revenue)).toEqual([1000, 2000, 3000]);
    expect(years.map((y) => y.operatingIncome)).toEqual([-100, -200, 300]);
    expect(years.map((y) => y.totalAssets)).toEqual([null, 8000, 9000]);
    expect(years[2].netIncome).toBeNull();
  });

  it("IS 없이 CIS만 있으면 CIS에서 손익 항목을 가져온다", () => {
    const [, , y2025] = normalizeReport(
      report(2025, [
        row("CIS", "ifrs-full_Revenue", "수익(매출액)", ["500", "400", "300"]),
        row("CIS", "dart_OperatingIncomeLoss", "영업이익(손실)", ["50", "40", "30"]),
        row("CIS", "ifrs-full_ProfitLoss", "당기순이익(손실)", ["20", "10", "5"]),
        row("CIS", "ifrs-full_ComprehensiveIncome", "총포괄손익", ["25", "15", "6"]),
      ]),
    );

    expect(y2025).toMatchObject({ year: 2025, revenue: 500, operatingIncome: 50, netIncome: 20 });
  });

  it("IS와 CIS가 모두 있으면 IS를 우선한다", () => {
    const [, , y2025] = normalizeReport(
      report(2025, [
        row("CIS", "ifrs-full_ProfitLoss", "당기순이익", ["999"]),
        row("IS", "ifrs-full_ProfitLoss", "당기순이익", ["100"]),
      ]),
    );
    expect(y2025.netIncome).toBe(100);
  });

  it("표준계정코드가 없으면 계정명(공백 무시)으로 찾는다", () => {
    const [, , y2025] = normalizeReport(
      report(2025, [
        row("IS", "-표준계정코드 미사용-", "영업 이익", ["70"]),
        row("CF", "-표준계정코드 미사용-", "영업활동으로 인한 현금흐름", ["80"]),
      ]),
    );
    expect(y2025.operatingIncome).toBe(70);
    expect(y2025.operatingCashFlow).toBe(80);
  });

  it("자본변동표·세부 구성요소 행은 무시한다", () => {
    const [, , y2025] = normalizeReport(
      report(2025, [
        row("SCE", "ifrs-full_Equity", "자본총계", ["1"], "자본 [구성요소]|이익잉여금 [구성요소]"),
        row("BS", "ifrs-full_Equity", "자본총계", ["1,000"]),
      ]),
    );
    expect(y2025.totalEquity).toBe(1000);
  });
});

describe("buildStandardYears", () => {
  const latest = report(2025, [
    row("IS", "ifrs-full_Revenue", "매출액", ["300", "250", "200"]),
    row("IS", "dart_OperatingIncomeLoss", "영업이익", ["30", "25", ""]),
  ]);
  const older = report(2022, [
    row("IS", "ifrs-full_Revenue", "매출액", ["199", "150", "100"]),
    row("IS", "dart_OperatingIncomeLoss", "영업이익", ["19", "15", "10"]),
  ]);

  it("두 보고서로 최근 5개년을 만들고, 겹치는 연도는 최신 보고서를 우선한다", () => {
    const years = buildStandardYears([older, latest], 5);
    expect(years.map((y) => y.year)).toEqual([2021, 2022, 2023, 2024, 2025]);
    // 2023은 최신 보고서의 전전기(200)로, 2022는 이전 보고서 당기(199)
    expect(years.map((y) => y.revenue)).toEqual([150, 199, 200, 250, 300]);
  });

  it("최신 보고서에 비어 있는 항목만 이전 보고서로 채운다", () => {
    const years = buildStandardYears([latest, report(2023, [row("IS", "dart_OperatingIncomeLoss", "영업이익", ["20"])])]);
    const y2023 = years.find((y) => y.year === 2023)!;
    expect(y2023.revenue).toBe(200);
    expect(y2023.operatingIncome).toBe(20);
  });

  it("보고서가 하나뿐이면 있는 연도만 반환한다", () => {
    expect(buildStandardYears([latest]).map((y) => y.year)).toEqual([2023, 2024, 2025]);
  });

  it("모든 값이 빈 연도는 제외한다", () => {
    const years = buildStandardYears([report(2025, [row("IS", "ifrs-full_Revenue", "매출액", ["10", "", ""])])]);
    expect(years.map((y) => y.year)).toEqual([2025]);
  });
});
