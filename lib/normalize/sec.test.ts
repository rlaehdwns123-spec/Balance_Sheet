import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/analysis";
import { riskChecks } from "@/lib/analysis/risk";
import { computeRatios } from "@/lib/ratios";
import type { SecCompanyFacts, SecFact } from "@/lib/sec/types";
import { humanizeTag, normalizeSec, reportingCurrency, SEC_TAG_MAP } from "./sec";

/** 12월 결산 회사의 연도별 기간 */
const period = (year: number) => ({ start: `${year}-01-01`, end: `${year}-12-31` });

/** 회계연도 → 값으로 태그 하나 만들기. 기간 값(flow)이면 start를 붙인다 */
function concept(label: string, byYear: Record<number, number>, opts: { flow?: boolean; unit?: string; form?: string } = {}) {
  const { flow = false, unit = "USD", form = "10-K" } = opts;
  const values: SecFact[] = Object.entries(byYear).map(([y, val]) => ({
    ...(flow ? period(Number(y)) : { end: `${y}-12-31` }),
    val,
    form,
    filed: `${Number(y) + 1}-02-15`,
  }));
  return { label, units: { [unit]: values } };
}

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const series = (base: number, step: number) => Object.fromEntries(YEARS.map((y, i) => [y, base + step * i]));

describe("normalizeSec — us-gaap", () => {
  // 2020~2022는 Revenues, 2023부터 RevenueFromContract…로 태그를 바꾼 회사.
  // 2023 보고서가 비교 수치로 2022년도 새 태그 값을 함께 싣는다 → 2022는 우선순위가 높은 Revenues가 이긴다
  const cf: SecCompanyFacts = {
    cik: 1,
    entityName: "Tag Switcher Inc.",
    facts: {
      "us-gaap": {
        Revenues: concept("Revenues", { 2020: 100, 2021: 110, 2022: 120 }, { flow: true }),
        RevenueFromContractWithCustomerExcludingAssessedTax: concept(
          "Revenue from Contract with Customer",
          { 2022: 121, 2023: 130, 2024: 140, 2025: 150 },
          { flow: true },
        ),
        OperatingIncomeLoss: concept("Operating Income (Loss)", series(20, 2), { flow: true }),
        NetIncomeLoss: concept("Net Income (Loss) Attributable to Parent", series(15, 1), { flow: true }),
        Assets: concept("Assets", series(500, 20)),
        // 부채총계 태그 없음 — 부채와자본총계 − 자본총계
        LiabilitiesAndStockholdersEquity: concept("Liabilities and Equity", series(500, 20)),
        StockholdersEquity: concept("Stockholders' Equity Attributable to Parent", series(300, 10)),
        InterestExpense: concept("Interest Expense", { 2020: 5, 2021: 5, 2022: 5 }, { flow: true }),
        InterestExpenseNonoperating: concept("Interest Expense, Nonoperating", { 2023: 6, 2024: 6, 2025: 6 }, { flow: true }),
      },
    },
  };
  const result = normalizeSec(cf)!;
  const year = (y: number) => result.years.find((a) => a.year === y)!;

  it("최근 6개 회계연도, 연도 오름차순", () => {
    expect(result.taxonomy).toBe("us-gaap");
    expect(result.currency).toBe("USD");
    expect(result.years.map((a) => a.year)).toEqual(YEARS);
  });

  it("연도에 따라 매출 태그가 바뀌어도 해마다 값을 찾고, 출처 태그를 남긴다", () => {
    expect(result.years.map((a) => a.revenue)).toEqual([100, 110, 120, 130, 140, 150]);
    expect(result.sources.get(2021)?.revenue).toEqual({ tag: "Revenues", label: "Revenues" });
    expect(result.sources.get(2022)?.revenue).toMatchObject({ tag: "Revenues" });
    expect(result.sources.get(2024)?.revenue).toMatchObject({ tag: "RevenueFromContractWithCustomerExcludingAssessedTax" });
  });

  it("이자비용 태그 변경(InterestExpense → InterestExpenseNonoperating)도 연도별로 따라간다", () => {
    expect(result.years.map((a) => a.interestExpense)).toEqual([5, 5, 5, 6, 6, 6]);
  });

  it("부채총계 태그가 없으면 부채와자본총계 − 자본총계", () => {
    expect(year(2025).totalEquity).toBe(350);
    expect(year(2025).totalLiabilities).toBe(600 - 350);
    expect(result.sources.get(2025)?.totalLiabilities).toEqual({ derived: "LiabilitiesAndStockholdersEquity - totalEquity" });
  });

  it("못 찾은 계정은 null", () => {
    expect(year(2025).inventories).toBeNull();
    expect(year(2025).bonds).toBeNull();
    expect(result.sources.get(2025)?.inventories).toBeUndefined();
  });

  it("Liabilities가 있으면 그대로 쓴다", () => {
    const withLiab = structuredClone(cf);
    withLiab.facts["us-gaap"].Liabilities = concept("Liabilities", series(190, 1));
    expect(normalizeSec(withLiab)!.years.at(-1)!.totalLiabilities).toBe(195);
  });

  it("lib/ratios, lib/analysis가 그대로 동작한다", () => {
    const ratios = computeRatios(result.years).at(-1)!.values;
    expect(ratios.operatingMargin).toBeCloseTo(30 / 150);
    expect(ratios.debtRatio).toBeCloseTo(250 / 350);
    expect(ratios.revenueGrowth).toBeCloseTo(150 / 140 - 1);
    expect(ratios.interestCoverage).toBeCloseTo(30 / 6);

    const analysis = analyze(result.years);
    expect(analysis).toBeTruthy();
    const checks = riskChecks(result.years, null);
    expect(checks.find((c) => c.key === "operatingLoss")?.status).toBe("clear");
  });
});

describe("normalizeSec — IFRS로 보고하는 20-F 회사", () => {
  // TSMC처럼 ifrs-full, 대만달러 본 값 + 최근 연도 일부 미국달러 환산값
  const twd = { unit: "TWD", form: "20-F" };
  const cf: SecCompanyFacts = {
    cik: 2,
    entityName: "Foreign Private Issuer Ltd.",
    facts: {
      "ifrs-full": {
        Revenue: concept("Revenue", { 2023: 2000, 2024: 2900 }, { ...twd, flow: true }),
        ProfitLossFromOperatingActivities: concept("Profit (loss) from operating activities", { 2023: 900, 2024: 1300 }, {
          ...twd,
          flow: true,
        }),
        ProfitLoss: concept("Profit (loss)", { 2023: 840, 2024: 1170 }, { ...twd, flow: true }),
        ProfitLossAttributableToOwnersOfParent: concept("Profit attributable to owners", { 2023: 838, 2024: 1173 }, {
          ...twd,
          flow: true,
        }),
        Assets: {
          label: "Assets",
          units: {
            TWD: [
              { end: "2023-12-31", val: 5500, form: "20-F", filed: "2024-04-18" },
              { end: "2024-12-31", val: 6700, form: "20-F", filed: "2025-04-17" },
            ],
            USD: [{ end: "2024-12-31", val: 204, form: "20-F", filed: "2025-04-17" }],
          },
        },
        Liabilities: concept("Liabilities", { 2023: 1800, 2024: 2100 }, twd),
        Equity: concept("Equity", { 2023: 3700, 2024: 4600 }, twd),
        CashFlowsFromUsedInOperatingActivities: concept("Cash flows from operating activities", { 2023: 1240, 2024: 1830 }, {
          ...twd,
          flow: true,
        }),
      },
      // IFRS 회사도 dei 등 다른 분류체계는 있다
      "us-gaap": {},
    },
  };
  const result = normalizeSec(cf)!;
  const latest = result.years.at(-1)!;

  it("ifrs-full 분류체계와 보고 통화(TWD)를 고른다", () => {
    expect(result.taxonomy).toBe("ifrs-full");
    expect(result.currency).toBe("TWD");
    expect(reportingCurrency(cf)).toBe("TWD");
  });

  it("DART 매핑의 ifrs-full 태그와 보충한 영업이익 태그로 값을 찾는다", () => {
    expect(latest).toMatchObject({
      year: 2024,
      revenue: 2900,
      operatingIncome: 1300,
      netIncome: 1170,
      netIncomeOwners: 1173,
      totalAssets: 6700, // USD 환산값(204)이 아니라 보고 통화 값
      totalLiabilities: 2100,
      totalEquity: 4600,
      operatingCashFlow: 1830,
    });
  });

  it("ifrs-full 태그명은 DART account_id에서 접두사를 뺀 것", () => {
    expect(SEC_TAG_MAP["ifrs-full"].revenue).toEqual(["Revenue"]);
    expect(SEC_TAG_MAP["ifrs-full"].receivables).toEqual([
      "CurrentTradeReceivables",
      "TradeAndOtherCurrentReceivables",
      "TradeReceivables",
    ]);
    expect(SEC_TAG_MAP["ifrs-full"].operatingIncome).toEqual(["ProfitLossFromOperatingActivities"]);
  });
});

describe("normalizeSec — 데이터 없음", () => {
  it("자산총계가 없으면 null", () => {
    expect(normalizeSec({ cik: 3, entityName: "Shell Co.", facts: { "us-gaap": {} } })).toBeNull();
  });
});

describe("humanizeTag", () => {
  it("label이 없는 ifrs-full 태그를 읽을 수 있는 이름으로", () => {
    expect(humanizeTag("ProfitLossFromOperatingActivities")).toBe("Profit loss from operating activities");
    expect(humanizeTag("Assets")).toBe("Assets");
    expect(humanizeTag("CashAndCashEquivalents")).toBe("Cash and cash equivalents");
  });

  it("출처 label이 null이면 태그 이름으로 채운다", () => {
    const cf: SecCompanyFacts = {
      cik: 4,
      entityName: "IFRS Co.",
      facts: {
        "ifrs-full": {
          Assets: { label: null, units: { EUR: [{ end: "2024-12-31", val: 10, form: "20-F", filed: "2025-03-01" }] } },
          Revenue: { label: null, units: { EUR: [{ ...period(2024), val: 5, form: "20-F", filed: "2025-03-01" }] } },
        },
      },
    };
    expect(normalizeSec(cf)!.sources.get(2024)?.revenue).toEqual({ tag: "Revenue", label: "Revenue" });
  });
});
