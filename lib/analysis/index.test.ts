import { describe, expect, it } from "vitest";
import type { RatioBenchmark } from "@/lib/benchmark";
import { ACCOUNT_KEYS, type StandardAccounts } from "@/lib/normalize";
import { analyze, cagr, cashFlowPattern, trailingStreak } from "./index";

function accounts(year: number, values: Partial<StandardAccounts>): StandardAccounts {
  const empty = Object.fromEntries(ACCOUNT_KEYS.map((k) => [k, null]));
  return { ...empty, ...values, year } as StandardAccounts;
}

/** 매출이 매년 10% 늘고 이익률이 오르는 건전한 회사 (6개년, 단위 억 → 원 스케일 무관) */
const HEALTHY = [100, 110, 121, 133.1, 146.41, 161.051].map((revenue, i) =>
  accounts(2020 + i, {
    revenue,
    operatingIncome: revenue * (0.08 + i * 0.01),
    netIncome: revenue * (0.06 + i * 0.01),
    totalAssets: 200 + i * 10,
    totalEquity: 150 + i * 10,
    totalLiabilities: 50,
    currentAssets: 120,
    currentLiabilities: 40,
    operatingCashFlow: revenue * 0.15,
    investingCashFlow: -10,
    financingCashFlow: -5,
  }),
);

const bench = (topPercent: number, value = 0.1): RatioBenchmark => ({ n: 20, p25: 0.05, median: 0.08, p75: 0.12, value, topPercent });

describe("trailingStreak", () => {
  it("끝에서부터 같은 방향 연속 횟수", () => {
    expect(trailingStreak([1, 2, 3, 4])).toEqual({ direction: "up", count: 3 });
    expect(trailingStreak([5, 1, 2])).toEqual({ direction: "up", count: 1 });
    expect(trailingStreak([3, 2, 1])).toEqual({ direction: "down", count: 2 });
  });
  it("null이나 같은 값에서 멈춤", () => {
    expect(trailingStreak([1, null, 2, 3])).toEqual({ direction: "up", count: 1 });
    expect(trailingStreak([1, 2, 2])).toBeNull();
    expect(trailingStreak([1])).toBeNull();
  });
});

describe("cagr", () => {
  it("연평균 증가율", () => {
    expect(cagr(100, 146.41, 4)).toBeCloseTo(0.1, 10);
  });
  it("시작이나 끝이 0 이하면 null", () => {
    expect(cagr(-1, 100, 4)).toBeNull();
    expect(cagr(100, 0, 4)).toBeNull();
    expect(cagr(100, 120, 0)).toBeNull();
  });
});

describe("cashFlowPattern", () => {
  it("부호 조합으로 유형 분류", () => {
    expect(cashFlowPattern(10, -5, -3)?.label).toBe("안정 운영형");
    expect(cashFlowPattern(10, -20, 15)?.label).toBe("성장 투자형");
    expect(cashFlowPattern(-10, -5, 20)?.label).toBe("외부 조달 의존형");
    expect(cashFlowPattern(-1, -1, -1)?.code).toBe("---");
  });
  it("하나라도 없으면 null", () => {
    expect(cashFlowPattern(10, null, -3)).toBeNull();
  });
});

describe("analyze", () => {
  it("표시 연도는 최근 5개년", () => {
    const a = analyze(HEALTHY);
    expect(a.years).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(a.latestYear).toBe(2025);
    expect(a.cash).toHaveLength(5);
  });

  it("건전한 회사는 네 영역 모두 양호", () => {
    const a = analyze(HEALTHY);
    const grades = Object.fromEntries(a.areas.map((x) => [x.area, x.grade]));
    expect(grades).toEqual({ profitability: "good", stability: "good", growth: "good", cashflow: "good" });
    const growth = a.areas.find((x) => x.area === "growth")!;
    expect(growth.findings.map((f) => f.text)).toContain("4년 연평균 매출 성장 10.0%");
    expect(growth.findings.map((f) => f.text)).toContain("매출 5년 연속 증가");
  });

  it("영업손실·자본잠식·영업현금흐름 적자는 주의", () => {
    const bad = [
      accounts(2024, { revenue: 100, operatingIncome: 5, netIncome: 3, totalEquity: 10, totalAssets: 100, totalLiabilities: 90, operatingCashFlow: 5 }),
      accounts(2025, { revenue: 70, operatingIncome: -20, netIncome: 2, totalEquity: -5, totalAssets: 90, totalLiabilities: 95, operatingCashFlow: -8 }),
    ];
    const a = analyze(bad);
    const grades = Object.fromEntries(a.areas.map((x) => [x.area, x.grade]));
    expect(grades).toMatchObject({ profitability: "caution", stability: "caution", growth: "caution", cashflow: "caution" });
    const texts = a.signals.map((s) => `${s.year} ${s.text}`);
    expect(texts).toContain("2025 영업이익 적자전환");
    expect(texts).toContain("2025 완전자본잠식");
    expect(texts).toContain("2025 순이익 흑자인데 영업현금흐름 마이너스");
    expect(texts).toContain("2025 매출 급감 (-30.0%)");
    // 같은 해 안에서는 부정 신호가 먼저, 최신 연도부터
    expect(a.signals[0].year).toBe(2025);
  });

  it("데이터가 없는 영역은 na", () => {
    const a = analyze([accounts(2025, { totalAssets: 100, totalEquity: 60, totalLiabilities: 40 })]);
    const grades = Object.fromEntries(a.areas.map((x) => [x.area, x.grade]));
    expect(grades).toMatchObject({ profitability: "na", growth: "na", cashflow: "na", stability: "neutral" });
  });

  it("영업이익 급증·급감 신호 (전기 흑자일 때만)", () => {
    const a = analyze([
      accounts(2022, { operatingIncome: -5 }),
      accounts(2023, { operatingIncome: 40 }),
      accounts(2024, { operatingIncome: 10 }),
      accounts(2025, { operatingIncome: 30 }),
    ]);
    const texts = a.signals.map((s) => `${s.year} ${s.text}`);
    expect(texts).toContain("2025 영업이익 급증 (200.0%)");
    expect(texts).toContain("2024 영업이익 급감 (-75.0%)");
    expect(texts).toContain("2023 영업이익 흑자전환");
    expect(texts.filter((t) => t.startsWith("2023"))).toHaveLength(1);
  });

  it("부채비율 급등은 안정성 감점과 신호", () => {
    const a = analyze([
      accounts(2024, { totalAssets: 200, totalEquity: 100, totalLiabilities: 100 }),
      accounts(2025, { totalAssets: 250, totalEquity: 100, totalLiabilities: 160 }),
    ]);
    const stab = a.areas.find((x) => x.area === "stability")!;
    expect(stab.findings.map((f) => f.text)).toContain("부채비율 전년 대비 +60.0%p 급등");
    expect(a.signals.map((s) => s.text)).toContain("부채비율 급등 (+60.0%p → 160.0%)");
  });

  it("듀폰 분해: 세 요소의 곱이 ROE와 같고, 변화 요인을 고른다", () => {
    const a = analyze(HEALTHY);
    for (const y of a.dupont.years) {
      expect(y.netMargin! * y.assetTurnover! * y.leverage!).toBeCloseTo(y.roe!, 12);
    }
    // 순이익률이 매년 1%p씩 오르고 레버리지는 줄어든다 → 주 요인은 순이익률 상승
    expect(a.dupont.driver).toMatchObject({ component: "netMargin", direction: "up" });
  });

  it("듀폰 요인은 ROE나 요소가 음수면 계산하지 않음", () => {
    const a = analyze([
      accounts(2023, { revenue: 100, netIncome: 5, totalAssets: 100, totalEquity: 50 }),
      accounts(2024, { revenue: 100, netIncome: 5, totalAssets: 100, totalEquity: 50 }),
      accounts(2025, { revenue: 100, netIncome: -5, totalAssets: 100, totalEquity: 50 }),
    ]);
    expect(a.dupont.driver).toBeNull();
  });

  it("현금 전환: 순이익 흑자일 때만 영업현금흐름 ÷ 순이익", () => {
    const a = analyze([
      accounts(2024, { netIncome: -10, operatingCashFlow: 5 }),
      accounts(2025, { netIncome: 20, operatingCashFlow: 8 }),
    ]);
    expect(a.cash.map((c) => c.cashConversion)).toEqual([null, 0.4]);
    const cashArea = a.areas.find((x) => x.area === "cashflow")!;
    expect(cashArea.findings.map((f) => f.text)).toContain("영업현금흐름이 순이익의 40.0%에 그침");
  });

  it("업종 비교: 상위권은 강점, 하위권은 약점으로 분류하고 영역 점수에 반영", () => {
    const benchmark = {
      operatingMargin: bench(10),
      roe: bench(90),
      debtRatio: bench(50),
      revenueGrowth: null,
    };
    const a = analyze(HEALTHY, benchmark);
    expect(a.industry?.strengths.map((p) => p.key)).toEqual(["operatingMargin"]);
    expect(a.industry?.weaknesses.map((p) => p.key)).toEqual(["roe"]);
    const profit = a.areas.find((x) => x.area === "profitability")!;
    expect(profit.findings.map((f) => f.text)).toEqual(expect.arrayContaining(["영업이익률 업종 상위 10%", "ROE 업종 하위권 (상위 90%)"]));
    expect(analyze(HEALTHY).industry).toBeNull();
  });
});
