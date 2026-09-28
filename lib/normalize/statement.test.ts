import { describe, expect, it } from "vitest";
import type { AnnualReport, DartAccountRow, SjDiv } from "@/lib/dart/types";
import { buildStatementTable, statementYears } from "./statement";

function row(
  sj_div: SjDiv,
  ord: number,
  account_id: string,
  account_nm: string,
  [thstrm, frmtrm = "", bfefrmtrm = ""]: [string, string?, string?],
): DartAccountRow {
  return {
    rcept_no: "",
    reprt_code: "11011",
    bsns_year: "",
    corp_code: "",
    sj_div,
    sj_nm: "",
    account_id,
    account_nm,
    account_detail: "-",
    thstrm_nm: "",
    thstrm_amount: thstrm,
    frmtrm_amount: frmtrm,
    bfefrmtrm_amount: bfefrmtrm,
    ord: String(ord),
    currency: "KRW",
  };
}
const NONE = "-표준계정코드 미사용-";
const report = (bsnsYear: number, rows: DartAccountRow[]): AnnualReport => ({ bsnsYear, rows });
const labels = (t: { rows: { label: string; level: number }[] }) => t.rows.map((r) => "  ".repeat(r.level) + r.label);

describe("statementYears", () => {
  it("최신 사업연도부터 내림차순 5개년", () => {
    expect(statementYears([report(2022, []), report(2025, [])])).toEqual([2025, 2024, 2023, 2022, 2021]);
  });
});

describe("buildStatementTable", () => {
  it("합계 우선·알파벳순으로 뒤섞인 ord를 표준 순서와 계층으로 바로잡는다", () => {
    // 2025년 이후 DART 형식: 자산총계 → 유동자산 → 하위(알파벳순) … 자본이 부채보다 먼저
    const scrambled = report(2025, [
      row("BS", 1, "ifrs-full_Assets", "자산총계", ["100"]),
      row("BS", 2, "ifrs-full_CurrentAssets", "유동자산", ["60"]),
      row("BS", 3, "dart_ShortTermOtherReceivablesNet", "미수금", ["10"]),
      row("BS", 4, "ifrs-full_CashAndCashEquivalents", "현금및현금성자산", ["50"]),
      row("BS", 5, "ifrs-full_NoncurrentAssets", "비유동자산", ["40"]),
      row("BS", 6, "ifrs-full_PropertyPlantAndEquipment", "유형자산", ["40"]),
      row("BS", 7, "dart_ElementsOfOtherStockholdersEquity", "기타자본항목", ["5"]), // 부모보다 앞에 옴
      row("BS", 8, "ifrs-full_Equity", "자본총계", ["70"]),
      row("BS", 9, "ifrs-full_IssuedCapital", "자본금", ["65"]),
      row("BS", 10, "dart_IssuedCapitalOfCommonStock", "보통주자본금", ["65"]),
      row("BS", 11, "ifrs-full_EquityAndLiabilities", "부채와자본총계", ["100"]),
      row("BS", 12, "ifrs-full_CurrentLiabilities", "유동부채", ["30"]),
      row("BS", 13, NONE, "단기차입금", ["30"]),
      row("BS", 14, "ifrs-full_Liabilities", "부채총계", ["30"]),
    ]);
    const t = buildStatementTable([scrambled], "BS", [2025]);

    expect(labels(t)).toEqual([
      "유동자산",
      "  미수금",
      "  현금및현금성자산",
      "비유동자산",
      "  유형자산",
      "자산총계",
      "유동부채",
      "  단기차입금",
      "부채총계",
      "  기타자본항목",
      "  자본금",
      "    보통주자본금",
      "자본총계",
      "부채와자본총계",
    ]);
    expect(t.rows.find((r) => r.label === "자산총계")?.emphasis).toBe(true);
    expect(t.rows.find((r) => r.label === "미수금")?.emphasis).toBe(false);
  });

  it("손익계산서가 없으면 포괄손익계산서를 쓴다", () => {
    const t = buildStatementTable(
      [
        report(2025, [
          row("CIS", 1, "dart_OperatingIncomeLoss", "영업이익(손실)", ["30"]),
          row("CIS", 2, "ifrs-full_Revenue", "매출액", ["100"]),
          row("CIS", 3, "ifrs-full_BasicEarningsLossPerShare", "기본주당이익(손실)", ["1,234"]),
        ]),
      ],
      "IS",
      [2025],
    );
    expect(t.source).toBe("CIS");
    expect(t.rows.map((r) => r.label)).toEqual(["매출액", "영업이익(손실)", "기본주당이익(손실)"]);
    expect(t.rows[2]).toMatchObject({ perShare: true, values: [1234] });
  });

  it("두 보고서를 5개년으로 합치고, 계정ID가 연도마다 달라도 이름으로 맞춘다", () => {
    const latest = report(2025, [
      row("BS", 1, "ifrs-full_CurrentAssets", "유동자산", ["300", "250", "200"]),
      row("BS", 2, "dart_ShortTermOtherReceivablesNet", "미수금", ["30", "25", "20"]),
    ]);
    const older = report(2022, [
      row("BS", 1, "ifrs-full_CurrentAssets", "유동자산", ["199", "150", "100"]),
      row("BS", 2, NONE, "미수금", ["19", "15", "10"]),
      row("BS", 3, NONE, "단기대여금", ["", "5", "4"]),
    ]);
    const t = buildStatementTable([older, latest], "BS", statementYears([latest, older]));

    expect(t.rows.map((r) => [r.label, r.values])).toEqual([
      ["유동자산", [300, 250, 200, 199, 150]],
      ["미수금", [30, 25, 20, 19, 15]],
      // 이전 보고서에만 있는 계정은 해당 구간 끝에
      ["단기대여금", [null, null, null, null, 5]],
    ]);
  });

  it("같은 이름이 유동·비유동에 모두 있으면 구간별로 따로 맞춘다", () => {
    const mk = (y: number, a: string, b: string) =>
      report(y, [
        row("BS", 1, "ifrs-full_CurrentAssets", "유동자산", [a]),
        row("BS", 2, NONE, "기타금융자산", [a]),
        row("BS", 3, "ifrs-full_NoncurrentAssets", "비유동자산", [b]),
        row("BS", 4, NONE, "기타금융자산", [b]),
      ]);
    const t = buildStatementTable([mk(2025, "1", "2"), mk(2022, "3", "4")], "BS", [2025, 2022]);
    expect(t.rows.map((r) => [r.label, r.values])).toEqual([
      ["유동자산", [1, 3]],
      ["기타금융자산", [1, 3]],
      ["비유동자산", [2, 4]],
      ["기타금융자산", [2, 4]],
    ]);
  });

  it("모든 연도가 빈 행과 자본변동표 세부 행은 제외한다", () => {
    const t = buildStatementTable(
      [
        report(2025, [
          row("CF", 1, "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", ["10"]),
          row("CF", 2, NONE, "빈 계정", ["", "-", ""]),
          { ...row("SCE", 3, "ifrs-full_Equity", "자본총계", ["1"]), account_detail: "이익잉여금 [구성요소]" },
        ]),
      ],
      "CF",
      [2025, 2024, 2023],
    );
    expect(t.rows.map((r) => r.label)).toEqual(["영업활동현금흐름"]);
  });
});
