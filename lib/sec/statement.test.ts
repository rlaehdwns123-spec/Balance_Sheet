import { describe, expect, it } from "vitest";
import { ACCOUNT_KEYS, type StandardAccounts } from "@/lib/normalize/accounts";
import type { SecStandard } from "@/lib/normalize/sec";
import { buildSecStatements } from "./statement";

const year = (y: number, values: Partial<StandardAccounts>): StandardAccounts =>
  ({ ...Object.fromEntries(ACCOUNT_KEYS.map((k) => [k, null])), year: y, ...values }) as StandardAccounts;

const std: SecStandard = {
  taxonomy: "us-gaap",
  currency: "USD",
  periods: [
    { fiscalYear: 2025, end: "2025-09-27" },
    { fiscalYear: 2024, end: "2024-09-28" },
  ],
  years: [
    year(2024, { revenue: 391e9, totalAssets: 365e9, totalLiabilities: 308e9 }),
    year(2025, { revenue: 416e9, totalAssets: 359e9, totalLiabilities: 285e9, cash: 35e9 }),
  ],
  sources: new Map([
    [2024, { revenue: { tag: "RevenueFromContractWithCustomerExcludingAssessedTax", label: "Revenue (old label)" } }],
    [
      2025,
      {
        revenue: { tag: "RevenueFromContractWithCustomerExcludingAssessedTax", label: "Revenue from Contract with Customer" },
        totalAssets: { tag: "Assets", label: "Assets" },
        totalLiabilities: { derived: "LiabilitiesAndStockholdersEquity - totalEquity" as const },
      },
    ],
  ]),
};

describe("buildSecStatements", () => {
  const { BS, IS, CF } = buildSecStatements(std);

  it("최신 연도가 첫 열, 기말일을 열 아래에", () => {
    expect(BS.columns).toEqual([
      { key: "2025", label: "2025", sub: "25.09.27" },
      { key: "2024", label: "2024", sub: "24.09.28" },
    ]);
  });

  it("표준 순서, 모든 연도가 빈 계정은 뺀다", () => {
    expect(BS.rows.map((r) => r.key)).toEqual(["cash", "totalAssets", "totalLiabilities"]);
    expect(BS.rows[0].values).toEqual([35e9, null]); // 일부 연도만 비면 칸만 비운다
  });

  it("계정명은 최신 연도의 SEC label, 한글 표준 계정명을 함께", () => {
    expect(IS.rows[0]).toMatchObject({ label: "Revenue from Contract with Customer", labelKo: "매출액", tier: "subtotal" });
    expect(BS.rows.find((r) => r.key === "totalLiabilities")?.label).toBe("Liabilities (Liabilities and Equity − Equity)");
    // 값은 있는데 출처 기록이 없으면 한글 계정명
    expect(BS.rows[0].label).toBe("현금및현금성자산");
  });

  it("공통형 기준: 손익계산서 매출액, 재무상태표 자산총계, 현금흐름표는 없음", () => {
    expect(IS.base).toEqual([416e9, 391e9]);
    expect(BS.base).toEqual([359e9, 365e9]);
    expect(CF.base).toBeNull();
  });
});

describe("buildSecStatements — 지배주주 행 중복", () => {
  const src = (tag: string) => ({ tag, label: tag });
  const base: SecStandard = {
    ...std,
    years: [year(2025, { netIncome: 112e9, netIncomeOwners: 112e9, totalEquity: 74e9, equityOwners: 74e9 })],
    periods: [{ fiscalYear: 2025, end: "2025-09-27" }],
  };

  it("상위 행과 같은 태그면 지배주주 행을 뺀다", () => {
    const { IS, BS } = buildSecStatements({
      ...base,
      sources: new Map([[2025, { netIncome: src("NetIncomeLoss"), netIncomeOwners: src("NetIncomeLoss"), totalEquity: src("StockholdersEquity"), equityOwners: src("StockholdersEquity") }]]),
    });
    expect(IS.rows.map((r) => r.key)).toEqual(["netIncome"]);
    expect(BS.rows.map((r) => r.key)).toEqual(["totalEquity"]);
  });

  it("태그가 다르면(비지배지분 포함 자본총계 등) 둘 다 보여 준다", () => {
    const { BS } = buildSecStatements({
      ...base,
      sources: new Map([[2025, { totalEquity: src("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"), equityOwners: src("StockholdersEquity") }]]),
    });
    expect(BS.rows.map((r) => r.key)).toEqual(["equityOwners", "totalEquity"]);
  });
});
