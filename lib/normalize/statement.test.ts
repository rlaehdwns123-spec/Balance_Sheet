import { describe, expect, it } from "vitest";
import type { AnnualReport, DartAccountRow, SjDiv } from "@/lib/dart/types";
import { buildInterimTable, buildStatementTable, statementYears } from "./statement";

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
    const byLabel = (label: string) => t.rows.find((r) => r.label === label)!;
    expect(byLabel("자산총계")).toMatchObject({ tier: "total", section: "assets" });
    expect(byLabel("유동자산")).toMatchObject({ tier: "subtotal", section: "assets" });
    expect(byLabel("미수금")).toMatchObject({ tier: "item", section: "assets" });
    expect(byLabel("단기차입금")).toMatchObject({ tier: "item", section: "liabilities" });
    // ord상 자산 구간에 끼어 있던 자본 항목도 자본 범주로
    expect(byLabel("기타자본항목").section).toBe("equity");
    expect(byLabel("부채와자본총계")).toMatchObject({ tier: "total", section: "summary" });
  });

  it("기존 양식 손익계산서를 IFRS 18 범주(영업·투자·재무)로 나눈다", () => {
    // 2025년 이후 DART처럼 ord가 뒤섞인 기존(K-IFRS) 양식
    const t = buildStatementTable(
      [
        report(2025, [
          row("IS", 1, "dart_OperatingIncomeLoss", "영업이익", ["30"]),
          row("IS", 2, "dart_OtherGains", "기타수익", ["5"]),
          row("IS", 3, "ifrs-full_FinanceCosts", "금융비용", ["4"]),
          row("IS", 4, "ifrs-full_FinanceIncome", "금융수익", ["3"]),
          row("IS", 5, "ifrs-full_ShareOfProfitLossOfAssociatesAndJointVenturesAccountedForUsingEquityMethod", "지분법이익", ["2"]),
          row("IS", 6, "ifrs-full_ProfitLossBeforeTax", "법인세비용차감전순이익", ["36"]),
          row("IS", 7, "ifrs-full_ProfitLoss", "당기순이익", ["28"]),
          row("IS", 8, "ifrs-full_Revenue", "매출액", ["100"]),
        ]),
      ],
      "IS",
      [2025],
    );
    expect(t.format).toBe("kifrs");
    expect(t.rows.map((r) => [r.label, r.section, r.tier])).toEqual([
      ["매출액", "operating", "subtotal"],
      ["영업이익", "operating", "total"],
      ["기타수익", "operating", "item"],
      ["지분법이익", "investing", "item"],
      ["금융수익", "investing", "item"],
      ["금융비용", "financing", "item"],
      ["법인세비용차감전순이익", "summary", "subtotal"],
      ["당기순이익", "summary", "total"],
    ]);
  });

  it("IFRS 18 양식이면 기타 영업손익을 영업이익 앞에, '재무 및 법인세 전 이익'을 투자 범주 끝에 둔다", () => {
    const ifrs18 = report(2027, [
      row("IS", 1, "ifrs-full_Revenue", "매출액", ["100"]),
      row("IS", 2, "dart_OperatingIncomeLoss", "영업이익", ["35"]),
      row("IS", 3, NONE, "기타영업수익", ["5"]),
      row("IS", 4, NONE, "투자수익", ["3"]),
      row("IS", 5, NONE, "재무 및 법인세 전 이익", ["38"]),
      row("IS", 6, NONE, "이자비용", ["4"]),
      row("IS", 7, "ifrs-full_ProfitLossBeforeTax", "법인세비용차감전순이익", ["34"]),
    ]);
    const t = buildStatementTable([ifrs18], "IS", [2027]);
    expect(t.format).toBe("ifrs18");
    expect(t.rows.map((r) => [r.label, r.section])).toEqual([
      ["매출액", "operating"],
      ["기타영업수익", "operating"],
      ["영업이익", "operating"],
      ["투자수익", "investing"],
      ["재무 및 법인세 전 이익", "investing"],
      ["이자비용", "financing"],
      ["법인세비용차감전순이익", "summary"],
    ]);
    expect(t.rows.find((r) => r.label === "재무 및 법인세 전 이익")?.tier).toBe("subtotal");
  });

  it("새 양식과 기존 양식 보고서가 섞이면 mixed", () => {
    const older = report(2025, [row("IS", 1, "ifrs-full_Revenue", "매출액", ["90", "80", "70"])]);
    const newer = report(2028, [
      row("IS", 1, "ifrs-full_Revenue", "매출액", ["120", "110", "100"]),
      row("IS", 2, NONE, "재무및법인세전이익", ["20", "18", "16"]),
    ]);
    const t = buildStatementTable([older, newer], "IS", statementYears([older, newer]));
    expect(t.format).toBe("mixed");
    expect(t.rows[0].values).toEqual([120, 110, 100, 90, 80]);
  });

  it("현금흐름표는 활동별 범주, 현금 증감·기말현금은 요약", () => {
    const t = buildStatementTable(
      [
        report(2025, [
          row("CF", 1, "dart_CashAndCashEquivalentsAtEndOfPeriodCf", "기말현금및현금성자산", ["50"]),
          row("CF", 2, "ifrs-full_CashFlowsFromUsedInFinancingActivities", "재무활동현금흐름", ["-5"]),
          row("CF", 3, NONE, "배당금의 지급", ["5"]),
          row("CF", 4, "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", ["20"]),
        ]),
      ],
      "CF",
      [2025],
    );
    expect(t.rows.map((r) => [r.label, r.section, r.tier])).toEqual([
      ["영업활동현금흐름", "operating", "subtotal"],
      ["재무활동현금흐름", "financing", "subtotal"],
      ["배당금의 지급", "financing", "item"],
      ["기말현금및현금성자산", "summary", "total"],
    ]);
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

describe("기존 양식 보기", () => {
  it("IFRS 18 보고서도 기존 순서로, 범주 없이", () => {
    const ifrs18 = report(2027, [
      row("IS", 1, "ifrs-full_Revenue", "매출액", ["100"]),
      row("IS", 2, "dart_OperatingIncomeLoss", "영업이익", ["35"]),
      row("IS", 3, "dart_OtherGains", "기타수익", ["5"]),
      row("IS", 4, "ifrs-full_ProfitLossBeforeTax", "법인세비용차감전순이익", ["34"]),
    ]);
    const t = buildStatementTable([ifrs18], "IS", [2027], { classic: true });
    expect(t.rows.map((r) => r.label)).toEqual(["매출액", "영업이익", "기타수익", "법인세비용차감전순이익"]);
    expect(new Set(t.rows.map((r) => r.section))).toEqual(new Set(["summary"]));
  });
});

describe("buildInterimTable", () => {
  const interimRow = (
    sj: SjDiv,
    ord: number,
    id: string,
    nm: string,
    amounts: Partial<Pick<DartAccountRow, "thstrm_amount" | "thstrm_add_amount" | "frmtrm_amount" | "frmtrm_q_amount" | "frmtrm_add_amount">>,
  ): DartAccountRow => ({ ...row(sj, ord, id, nm, [""]), frmtrm_amount: undefined, bfefrmtrm_amount: undefined, ...amounts });

  const half = {
    bsnsYear: 2026,
    reprtCode: "11012" as const,
    rows: [
      interimRow("BS", 1, "ifrs-full_Assets", "자산총계", { thstrm_amount: "150", frmtrm_amount: "100" }),
      interimRow("IS", 1, "ifrs-full_Revenue", "매출액", {
        thstrm_amount: "60",
        thstrm_add_amount: "110",
        frmtrm_q_amount: "40",
        frmtrm_add_amount: "90",
      }),
      interimRow("IS", 2, "ifrs-full_ProfitLoss", "반기순이익", { thstrm_amount: "6", thstrm_add_amount: "11", frmtrm_q_amount: "4" }),
      interimRow("CF", 1, "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", {
        thstrm_amount: "30",
        frmtrm_q_amount: "20",
      }),
    ],
  };

  it("공통형 기준값은 당기·비교 기간 두 열", () => {
    expect(buildInterimTable(half, "BS").base).toEqual([150, 100]);
    expect(buildInterimTable(half, "IS", { basis: "cum" }).base).toEqual([110, 90]);
  });

  it("재무상태표는 반기말 vs 전기말", () => {
    const t = buildInterimTable(half, "BS");
    expect(t.compare).toBe(true);
    expect(t.columns.map((c) => c.label)).toEqual(["2026.06", "2025.12"]);
    expect(t.rows[0].values).toEqual([150, 100]);
  });

  it("손익계산서는 3개월 또는 누적을 전년 동기와", () => {
    const q = buildInterimTable(half, "IS", { basis: "q" });
    expect(q.columns.map((c) => c.label)).toEqual(["2026 2Q", "2025 2Q"]);
    expect(q.rows[0].values).toEqual([60, 40]);

    const cum = buildInterimTable(half, "IS", { basis: "cum" });
    expect(cum.columns.map((c) => c.label)).toEqual(["2026 1~2Q", "2025 1~2Q"]);
    expect(cum.rows.map((r) => r.values)).toEqual([
      [110, 90],
      [11, null],
    ]);
    // "반기순이익"도 당기순이익 앵커로 인식
    expect(cum.rows[1].tier).toBe("total");
  });

  it("현금흐름표는 누적, 전년 동기는 frmtrm_q 필드", () => {
    const t = buildInterimTable(half, "CF");
    expect(t.columns[0].sub).toBe("누적");
    expect(t.rows[0].values).toEqual([30, 20]);
  });
});

describe("공통형 기준값 (base)", () => {
  it("손익계산서는 매출액, 재무상태표는 자산총계, 현금흐름표는 없음", () => {
    const r = report(2025, [
      row("IS", 1, "ifrs-full_Revenue", "매출액", ["200", "100"]),
      row("IS", 2, "dart_OperatingIncomeLoss", "영업이익", ["20", "10"]),
      row("BS", 1, "ifrs-full_CurrentAssets", "유동자산", ["40", "30"]),
      row("BS", 2, "ifrs-full_Assets", "자산총계", ["100", "80"]),
      row("CF", 1, "ifrs-full_CashFlowsFromUsedInOperatingActivities", "영업활동현금흐름", ["5", "4"]),
    ]);
    expect(buildStatementTable([r], "IS", [2025, 2024, 2023]).base).toEqual([200, 100, null]);
    expect(buildStatementTable([r], "BS", [2025, 2024, 2023]).base).toEqual([100, 80, null]);
    expect(buildStatementTable([r], "CF", [2025, 2024, 2023]).base).toBeNull();
  });

  it("기준 행이 없으면 null", () => {
    const r = report(2025, [row("IS", 1, "dart_OperatingIncomeLoss", "영업이익", ["20"])]);
    expect(buildStatementTable([r], "IS", [2025]).base).toBeNull();
  });
});
