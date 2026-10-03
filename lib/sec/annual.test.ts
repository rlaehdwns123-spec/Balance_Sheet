import { describe, expect, it } from "vitest";
import {
  annualContext,
  annualTagValues,
  annualValues,
  fiscalPeriods,
  fiscalYearOf,
  isAnnualDuration,
  reportingCurrency,
  trimCompanyFacts,
} from "./annual";
import type { SecCompanyFacts, SecFact } from "./types";

// 애플식 9월 말 결산 (실제 companyfacts 구조를 줄인 것)
const PERIODS = [
  { start: "2024-09-29", end: "2025-09-27" },
  { start: "2023-10-01", end: "2024-09-28" },
  { start: "2022-09-25", end: "2023-09-30" },
];

const fact = (f: Partial<SecFact> & Pick<SecFact, "end" | "val">): SecFact => ({
  form: "10-K",
  fp: "FY",
  filed: "2025-10-31",
  ...f,
});

function companyFacts(usGaap: SecCompanyFacts["facts"]["us-gaap"], extra: SecCompanyFacts["facts"] = {}): SecCompanyFacts {
  return { cik: 320193, entityName: "Test Inc.", facts: { "us-gaap": usGaap, ...extra } };
}

/** 회계연도 기말일을 정해 주는 매출 값 */
const revenue = {
  label: "Revenues",
  units: { USD: PERIODS.map((p, i) => fact({ ...p, val: 100 - i, fy: 2025 })) },
};

describe("fiscalYearOf", () => {
  it("기말일이 속한 해", () => {
    expect(fiscalYearOf("2025-09-27")).toBe(2025);
    expect(fiscalYearOf("2025-01-31")).toBe(2025); // 1월 말 결산(월마트식)
  });
  it("1월 첫 주에 끝나는 52·53주 회계연도는 전년도", () => {
    expect(fiscalYearOf("2021-01-02")).toBe(2020);
  });
});

describe("isAnnualDuration", () => {
  it("52·53주와 12개월은 연간, 분기·9개월은 아님", () => {
    expect(isAnnualDuration("2024-09-29", "2025-09-27")).toBe(true); // 52주
    expect(isAnnualDuration("2022-09-25", "2023-09-30")).toBe(true); // 53주
    expect(isAnnualDuration("2024-01-01", "2024-12-31")).toBe(true);
    expect(isAnnualDuration("2025-06-29", "2025-09-27")).toBe(false);
    expect(isAnnualDuration("2024-12-29", "2025-09-27")).toBe(false);
  });
});

describe("annualValues", () => {
  const periods = fiscalPeriods(companyFacts({ Revenues: revenue }));

  it("비교 수치의 fy가 아니라 end로 연도를 정한다", () => {
    // FY2025 보고서(fy 2025)가 2024·2023 기말 값을 비교 수치로 함께 싣는다
    const assets = {
      label: "Assets",
      units: {
        USD: [
          fact({ end: "2025-09-27", val: 359, fy: 2025 }),
          fact({ end: "2024-09-28", val: 364, fy: 2025 }),
          fact({ end: "2023-09-30", val: 352, fy: 2024, filed: "2024-11-01" }),
        ],
      },
    };
    const v = annualValues(assets, "USD", periods);
    expect([...v.keys()]).toEqual([2025, 2024, 2023]);
    expect(v.get(2024)?.val).toBe(364);
    expect(v.get(2023)?.val).toBe(352);
  });

  it("같은 기간에 값이 여럿이면 filed가 가장 늦은 것 (순서와 무관)", () => {
    const assets = {
      label: "Assets",
      units: {
        USD: [
          fact({ end: "2024-09-28", val: 999, fy: 2025, filed: "2025-10-31" }),
          fact({ end: "2024-09-28", val: 364, fy: 2024, filed: "2024-11-01" }),
          fact({ end: "2024-09-28", val: 100, fy: 2024, filed: "2023-11-03" }),
        ],
      },
    };
    const v = annualValues(assets, "USD", periods);
    expect(v.size).toBe(1);
    expect(v.get(2024)?.val).toBe(999);
  });

  it("정정본(10-K/A)이 나중에 제출됐으면 정정 값을 쓴다", () => {
    const netIncome = {
      label: "NetIncomeLoss",
      units: {
        USD: [
          fact({ ...PERIODS[1], val: 93, form: "10-K", filed: "2024-11-01" }),
          fact({ ...PERIODS[1], val: 90, form: "10-K/A", filed: "2025-01-15" }),
        ],
      },
    };
    const v = annualValues(netIncome, "USD", periods);
    expect(v.get(2024)).toMatchObject({ val: 90, form: "10-K/A" });
  });

  it("20-F·40-F와 그 정정본도 연간 보고서로 인정한다", () => {
    const assets = {
      label: "Assets",
      units: {
        USD: [
          fact({ end: "2025-09-27", val: 1, form: "20-F" }),
          fact({ end: "2024-09-28", val: 2, form: "40-F/A" }),
        ],
      },
    };
    expect(annualValues(assets, "USD", periods).size).toBe(2);
  });

  it("10-Q·8-K 값과 연간 보고서 안의 분기 기간 값은 버린다", () => {
    const netIncome = {
      label: "NetIncomeLoss",
      units: {
        USD: [
          fact({ ...PERIODS[0], val: 112, form: "10-Q" }),
          fact({ ...PERIODS[0], val: 112, form: "8-K" }),
          fact({ start: "2025-06-29", end: "2025-09-27", val: 27 }), // 10-K 안의 4분기
          fact({ ...PERIODS[0], val: 112 }),
        ],
      },
    };
    const v = annualValues(netIncome, "USD", periods);
    expect(v.size).toBe(1);
    expect(v.get(2025)?.val).toBe(112);
  });

  it("회계연도 기말일이 아닌 시점 값은 버린다", () => {
    const assets = { label: "Assets", units: { USD: [fact({ end: "2025-10-20", val: 1 })] } };
    expect(annualValues(assets, "USD", periods).size).toBe(0);
  });

  it("태그가 없거나 단위가 없으면 빈 결과", () => {
    expect(annualValues(undefined, "USD", periods).size).toBe(0);
    expect(annualValues(revenue, "EUR", periods).size).toBe(0);
  });
});

describe("reportingCurrency", () => {
  it("자산총계 값이 가장 많은 통화 (TSMC: TWD 본 값 + 일부 USD 환산)", () => {
    const cf = companyFacts(
      {},
      {
        "ifrs-full": {
          Assets: {
            label: "Assets",
            units: {
              USD: [fact({ end: "2024-12-31", val: 1, form: "20-F" })],
              TWD: [fact({ end: "2024-12-31", val: 2, form: "20-F" }), fact({ end: "2023-12-31", val: 3, form: "20-F" })],
            },
          },
        },
      },
    );
    expect(reportingCurrency(cf)).toBe("TWD");
  });
});

describe("annualContext", () => {
  it("최근 N개 회계연도, IFRS 회사는 ifrs-full", () => {
    const ctx = annualContext(companyFacts({ Revenues: revenue }), 2);
    expect(ctx).toBeNull(); // Assets가 없으면 보고 통화를 못 정한다

    const cf = companyFacts({
      Revenues: revenue,
      Assets: { label: "Assets", units: { USD: [fact({ end: "2025-09-27", val: 359 })] } },
    });
    const ctx2 = annualContext(cf, 2)!;
    expect(ctx2.taxonomy).toBe("us-gaap");
    expect(ctx2.currency).toBe("USD");
    expect(ctx2.periods).toEqual([
      { fiscalYear: 2025, end: "2025-09-27" },
      { fiscalYear: 2024, end: "2024-09-28" },
    ]);
    expect(annualTagValues(cf, ctx2, "Assets").get(2025)?.val).toBe(359);
  });
});

describe("trimCompanyFacts", () => {
  it("연간 보고서·기간 이후 값만 남기고 빈 태그는 뺀다", () => {
    const cf = companyFacts({
      Revenues: revenue,
      Old: { label: "Old", units: { USD: [fact({ end: "2010-12-31", val: 1 })] } },
      Quarterly: { label: "Q", units: { USD: [fact({ end: "2025-06-28", val: 1, form: "10-Q" })] } },
    });
    const trimmed = trimCompanyFacts(cf, "2018-01-01");
    expect(Object.keys(trimmed.facts["us-gaap"])).toEqual(["Revenues"]);
    expect(trimmed.facts["us-gaap"].Revenues.units.USD).toHaveLength(3);
  });
});

describe("fiscalPeriods — 회사가 쓰는 회계연도 표기", () => {
  /** 1월 말 결산: 기간 값 하나를 여러 보고서가 싣는다 (처음 보고서 fy = 회사 표기, 나중 보고서는 비교 수치) */
  const january = (ownFy: number[]) => {
    const ends = ["2026-01-31", "2025-02-01"];
    const starts = ["2025-02-02", "2024-02-04"];
    const values: SecFact[] = ends.flatMap((end, i) => [
      fact({ start: starts[i], end, val: 1, fy: ownFy[i], filed: `${end.slice(0, 4)}-03-12` }),
      // 다음 해 보고서의 비교 수치: 그 보고서의 fy가 붙는다
      fact({ start: starts[i], end, val: 1, fy: ownFy[i] + 1, filed: `${Number(end.slice(0, 4)) + 1}-03-12` }),
    ]);
    return companyFacts({ Revenues: { label: "Revenues", units: { USD: values } } });
  };

  it("시작한 해로 부르는 회사(타깃): 2026년 1월에 끝난 해 = 2025", () => {
    expect(fiscalPeriods(january([2025, 2024]))).toEqual([
      { fiscalYear: 2025, end: "2026-01-31" },
      { fiscalYear: 2024, end: "2025-02-01" },
    ]);
  });

  it("끝난 해로 부르는 회사(월마트·엔비디아): 2026년 1월에 끝난 해 = 2026", () => {
    expect(fiscalPeriods(january([2026, 2025])).map((p) => p.fiscalYear)).toEqual([2026, 2025]);
  });

  it("fy가 없거나 기말일과 동떨어지면 기말일 규칙", () => {
    const odd = companyFacts({
      Revenues: { label: "Revenues", units: { USD: [fact({ ...PERIODS[0], val: 1, fy: 2019 }), fact({ ...PERIODS[1], val: 1, fy: undefined })] } },
    });
    expect(fiscalPeriods(odd).map((p) => p.fiscalYear)).toEqual([2025, 2024]);
  });
});
