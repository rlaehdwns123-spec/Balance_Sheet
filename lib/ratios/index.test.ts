import { describe, expect, it } from "vitest";
import { ACCOUNT_KEYS, type StandardAccounts } from "@/lib/normalize";
import { RATIO_GUIDE } from "./guide";
import { average, computeRatios, growthRate, RATIOS, safeDiv } from "./index";

function accounts(year: number, values: Partial<StandardAccounts>): StandardAccounts {
  const empty = Object.fromEntries(ACCOUNT_KEYS.map((k) => [k, null]));
  return { ...empty, ...values, year } as StandardAccounts;
}

// 삼성전자 연결재무제표 (DART 2025 사업보고서, 단위 원)
const SAMSUNG_2024 = accounts(2024, {
  revenue: 300870903000000,
  grossProfit: 114308635000000,
  operatingIncome: 32725961000000,
  netIncome: 34451351000000,
  netIncomeOwners: 33621363000000,
  totalAssets: 514531948000000,
  currentAssets: 227062266000000,
  inventories: 51754865000000,
  totalLiabilities: 112339878000000,
  currentLiabilities: 93326299000000,
  totalEquity: 402192070000000,
  equityOwners: 391687603000000,
});
const SAMSUNG_2025 = accounts(2025, {
  revenue: 333605938000000,
  grossProfit: 131370425000000,
  operatingIncome: 43601051000000,
  netIncome: 45206805000000,
  netIncomeOwners: 44260956000000,
  totalAssets: 566942110000000,
  currentAssets: 247684612000000,
  inventories: 52636828000000,
  totalLiabilities: 130621773000000,
  currentLiabilities: 106411348000000,
  totalEquity: 436320337000000,
  equityOwners: 424313255000000,
});

/**
 * 손계산 기댓값: 위 원본 금액으로 Python Decimal(정밀도 30)에서 식을 직접 계산한 값.
 * 예) ROE = 44,260,956 ÷ ((424,313,255 + 391,687,603) ÷ 2) = 0.1084826212
 */
const HAND_CALCULATED_2025: Record<string, number> = {
  grossMargin: 0.3937892287,
  operatingMargin: 0.1306962678,
  netMargin: 0.1355095934,
  roe: 0.1084826212,
  roa: 0.0836021995,
  debtRatio: 0.299371269,
  currentRatio: 2.327614645,
  quickRatio: 1.8329603719,
  equityRatio: 0.7696029794,
  revenueGrowth: 0.1088009331,
  operatingIncomeGrowth: 0.3323077357,
  netIncomeGrowth: 0.3121925175,
  assetGrowth: 0.1018598791,
  assetTurnover: 0.6169467229,
  equityTurnover: 0.7957090085,
  inventoryTurnover: 6.3914269117,
};

describe("computeRatios — 삼성전자 2025 손계산 대조", () => {
  const [y2024, y2025] = computeRatios([SAMSUNG_2025, SAMSUNG_2024]);

  it("모든 비율이 손계산 값과 소수 9자리까지 일치", () => {
    expect(Object.keys(HAND_CALCULATED_2025).sort()).toEqual(RATIOS.map((r) => r.key).sort());
    for (const [key, expected] of Object.entries(HAND_CALCULATED_2025)) {
      expect(y2025.values[key], key).toBeCloseTo(expected, 9);
    }
  });

  it("입력 순서와 무관하게 연도 오름차순, 첫 해는 평균·증가율이 null", () => {
    expect([y2024.year, y2025.year]).toEqual([2024, 2025]);
    expect(y2024.values.roe).toBeNull();
    expect(y2024.values.roa).toBeNull();
    expect(y2024.values.revenueGrowth).toBeNull();
    expect(y2024.values.operatingMargin).toBeCloseTo(32725961 / 300870903, 12); // 기말·당기 기준 비율은 계산됨
  });
});

describe("RATIO_GUIDE", () => {
  it("모든 비율에 의미·읽는 법 설명이 있다", () => {
    for (const r of RATIOS) {
      expect(RATIO_GUIDE[r.key]?.meaning, r.key).toBeTruthy();
      expect(RATIO_GUIDE[r.key]?.guide, r.key).toBeTruthy();
    }
  });
});

describe("null 안전 헬퍼", () => {
  it("safeDiv: null 또는 분모 0 이하이면 null", () => {
    expect(safeDiv(1, 4)).toBe(0.25);
    expect(safeDiv(-1, 4)).toBe(-0.25);
    expect(safeDiv(null, 4)).toBeNull();
    expect(safeDiv(1, null)).toBeNull();
    expect(safeDiv(1, 0)).toBeNull();
    expect(safeDiv(1, -5)).toBeNull(); // 자본잠식 등
  });

  it("average: 한쪽이라도 없으면 null", () => {
    expect(average(10, 20)).toBe(15);
    expect(average(10, null)).toBeNull();
    expect(average(undefined, 20)).toBeNull();
  });

  it("growthRate: 전년 0 이하(적자)면 null, 당기 적자는 음수 증가율", () => {
    expect(growthRate(120, 100)).toBeCloseTo(0.2, 12);
    expect(growthRate(-50, 100)).toBeCloseTo(-1.5, 12);
    expect(growthRate(100, -50)).toBeNull();
    expect(growthRate(100, 0)).toBeNull();
    expect(growthRate(100, null)).toBeNull();
  });
});

describe("비율별 예외 처리", () => {
  it("ROE: 지배주주 구분이 없으면(별도재무제표) 당기순이익 ÷ 평균 자본총계", () => {
    const [, cur] = computeRatios([
      accounts(2024, { totalEquity: 900 }),
      accounts(2025, { netIncome: 100, totalEquity: 1100 }),
    ]);
    expect(cur.values.roe).toBeCloseTo(100 / 1000, 12);
  });

  it("ROE: 평균 자본이 0 이하(자본잠식)면 null", () => {
    const [, cur] = computeRatios([
      accounts(2024, { totalEquity: -300 }),
      accounts(2025, { netIncome: 100, totalEquity: 100 }),
    ]);
    expect(cur.values.roe).toBeNull();
  });

  it("당좌비율: 재고자산이 없으면 null (0으로 가정하지 않음)", () => {
    const [cur] = computeRatios([accounts(2025, { currentAssets: 200, currentLiabilities: 100 })]);
    expect(cur.values.currentRatio).toBe(2);
    expect(cur.values.quickRatio).toBeNull();
  });

  it("매출액이 없으면(금융업 등) 매출 기반 비율은 모두 null", () => {
    const [, cur] = computeRatios([
      accounts(2024, { totalAssets: 1000 }),
      accounts(2025, { netIncome: 50, totalAssets: 1000 }),
    ]);
    expect(cur.values.operatingMargin).toBeNull();
    expect(cur.values.assetTurnover).toBeNull();
    expect(cur.values.revenueGrowth).toBeNull();
    expect(cur.values.roa).toBeCloseTo(0.05, 12);
  });

  it("중간 연도가 빠지면 직전 연도가 아닌 해와 평균 내지 않는다", () => {
    const [, y2025] = computeRatios([
      accounts(2023, { revenue: 100, totalAssets: 1000 }),
      accounts(2025, { revenue: 200, netIncome: 10, totalAssets: 1000 }),
    ]);
    expect(y2025.values.roa).toBeNull();
    expect(y2025.values.revenueGrowth).toBeNull();
  });
});
