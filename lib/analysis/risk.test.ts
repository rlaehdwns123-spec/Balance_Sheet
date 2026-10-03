import { describe, expect, it } from "vitest";
import { ACCOUNT_KEYS, type StandardAccounts } from "@/lib/normalize";
import { isCleanOpinion, riskChecks, type RiskCheck } from "./risk";

function accounts(year: number, values: Partial<StandardAccounts>): StandardAccounts {
  const empty = Object.fromEntries(ACCOUNT_KEYS.map((k) => [k, null]));
  return { ...empty, ...values, year } as StandardAccounts;
}

/** 위험 신호가 하나도 없는 회사 */
const healthy = (year: number, scale = 1) =>
  accounts(year, {
    revenue: 1000 * scale,
    operatingIncome: 100 * scale,
    netIncome: 80 * scale,
    operatingCashFlow: 120 * scale,
    totalAssets: 2000,
    totalLiabilities: 800,
    totalEquity: 1200,
    issuedCapital: 100,
    currentAssets: 600,
    currentLiabilities: 300,
    receivables: 100 * scale,
    financeCosts: 10,
  });

const AUDIT_OK = { year: 2025, opinion: "적정의견", auditor: "삼정회계법인" };
const byKey = (checks: RiskCheck[]) => Object.fromEntries(checks.map((c) => [c.key, c]));

describe("riskChecks", () => {
  it("건전한 회사는 모든 항목이 해당 없음", () => {
    const checks = riskChecks([healthy(2024), healthy(2025, 1.1)], AUDIT_OK);
    expect(checks).toHaveLength(8);
    expect(checks.every((c) => c.status === "clear")).toBe(true);
    expect(checks.every((c) => c.badge === null)).toBe(true);
  });

  it("영업적자 2년 연속이면 해당, 근거에 연도별 영업손익", () => {
    const c = byKey(
      riskChecks(
        [healthy(2023), { ...healthy(2024), operatingIncome: -5e9 }, { ...healthy(2025), operatingIncome: -3e9 }],
        AUDIT_OK,
      ),
    );
    expect(c.operatingLoss.status).toBe("hit");
    expect(c.operatingLoss.badge).toBe("영업적자 2년 연속");
    expect(c.operatingLoss.evidence).toBe("2024년 -50억 · 2025년 -30억");
  });

  it("영업적자 1년이면 해당 없음, 중간 연도가 빠지면 연속으로 보지 않음", () => {
    expect(byKey(riskChecks([healthy(2024), { ...healthy(2025), operatingIncome: -1 }], AUDIT_OK)).operatingLoss.status).toBe("clear");
    expect(
      byKey(riskChecks([{ ...healthy(2023), operatingIncome: -1 }, { ...healthy(2025), operatingIncome: -1 }], AUDIT_OK)).operatingLoss
        .status,
    ).toBe("clear");
  });

  it("자본잠식: 자본총계 < 자본금이면 부분, 음수면 완전", () => {
    const partial = byKey(riskChecks([{ ...healthy(2025), totalEquity: 60 }], AUDIT_OK));
    expect(partial.impairment.badge).toBe("부분자본잠식");
    expect(partial.impairment.evidence).toContain("잠식률 40.0%");
    const full = byKey(riskChecks([{ ...healthy(2025), totalEquity: -10 }], AUDIT_OK));
    expect(full.impairment.badge).toBe("완전자본잠식");
    // 자본총계 0 이하면 부채비율은 못 내지만 위험 신호로 본다
    expect(full.debtRatio.status).toBe("hit");
  });

  it("자본금 항목을 못 찾으면 부분자본잠식은 확인 불가", () => {
    expect(byKey(riskChecks([{ ...healthy(2025), issuedCapital: null }], AUDIT_OK)).impairment.status).toBe("na");
  });

  it("이자보상배율 1 미만, 금융비용 대용이면 근거에 표시", () => {
    const c = byKey(riskChecks([{ ...healthy(2025), operatingIncome: 5, financeCosts: 10 }], AUDIT_OK)).interestCoverage;
    expect(c.status).toBe("hit");
    expect(c.evidence).toContain("0.50배");
    expect(c.evidence).toContain("금융비용(이자비용 대용)");
  });

  it("순이익 흑자인데 영업현금흐름 적자", () => {
    expect(byKey(riskChecks([{ ...healthy(2025), operatingCashFlow: -1 }], AUDIT_OK)).cashGap.status).toBe("hit");
    expect(byKey(riskChecks([{ ...healthy(2025), netIncome: -1, operatingCashFlow: -1 }], AUDIT_OK)).cashGap.status).toBe("clear");
  });

  it("부채비율 200% 초과, 유동비율 100% 미만", () => {
    const c = byKey(riskChecks([{ ...healthy(2025), totalLiabilities: 2500, currentAssets: 200 }], AUDIT_OK));
    expect(c.debtRatio.status).toBe("hit");
    expect(c.currentRatio.status).toBe("hit");
  });

  it("매출채권 증가율이 매출 증가율보다 20%p 이상 높으면 해당", () => {
    const c = byKey(riskChecks([healthy(2024), { ...healthy(2025, 1.1), receivables: 140 }], AUDIT_OK)).receivables;
    expect(c.status).toBe("hit");
    expect(c.evidence).toBe("매출채권 40.0% vs 매출 10.0% (차이 +30.0%p)");
    // 차이가 20%p 미만이면 해당 없음
    expect(byKey(riskChecks([healthy(2024), { ...healthy(2025, 1.1), receivables: 129 }], AUDIT_OK)).receivables.status).toBe("clear");
  });

  it("감사의견: 적정이 아니면 해당, 못 불러오면 확인 불가", () => {
    expect(byKey(riskChecks([healthy(2025)], { ...AUDIT_OK, opinion: "한정의견" })).audit.badge).toBe("감사의견 한정의견");
    expect(byKey(riskChecks([healthy(2025)], null)).audit.status).toBe("na");
  });

  it("데이터가 없으면 확인 불가", () => {
    const checks = riskChecks([accounts(2025, {})], null);
    expect(checks.every((c) => c.status === "na")).toBe(true);
    expect(riskChecks([], null)).toEqual([]);
  });
});

describe("isCleanOpinion", () => {
  it("적정만 적정, 부적정·한정·의견거절은 아님", () => {
    expect(isCleanOpinion("적정의견")).toBe(true);
    expect(isCleanOpinion("적정")).toBe(true);
    expect(isCleanOpinion("부적정의견")).toBe(false);
    expect(isCleanOpinion("한정의견")).toBe(false);
    expect(isCleanOpinion("의견거절")).toBe(false);
  });
});
