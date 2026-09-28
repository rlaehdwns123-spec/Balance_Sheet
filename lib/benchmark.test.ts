import { describe, expect, it } from "vitest";
import { benchmarkRatios, multiRowsToStandard, quantile, standingOf, type MultiAccountRow } from "./benchmark";

function rows(corp: string, fs: "CFS" | "OFS", accounts: Record<string, [string, string]>): MultiAccountRow[] {
  return Object.entries(accounts).map(([account_nm, [thstrm_amount, frmtrm_amount]]) => ({
    corp_code: corp,
    fs_div: fs,
    sj_div: account_nm.includes("총계") || account_nm.includes("유동") ? "BS" : "IS",
    account_nm,
    thstrm_amount,
    frmtrm_amount,
  }));
}

describe("multiRowsToStandard", () => {
  it("연결이 있으면 연결, 없으면 별도. 쉼표 금액과 '(손실)' 표기를 처리", () => {
    const data = multiRowsToStandard(
      [
        ...rows("A", "CFS", { 매출액: ["1,000", "800"], "당기순이익(손실)": ["-50", "30"] }),
        ...rows("A", "OFS", { 매출액: ["999", "999"] }),
        ...rows("B", "OFS", { 자산총계: ["500", "400"] }),
      ],
      2025,
    );
    const [aPrev, aCur] = data.get("A")!;
    expect([aPrev.year, aCur.year]).toEqual([2024, 2025]);
    expect([aCur.revenue, aPrev.revenue, aCur.netIncome, aPrev.netIncome]).toEqual([1000, 800, -50, 30]);
    expect(data.get("B")![1].totalAssets).toBe(500);
  });
});

describe("quantile", () => {
  it("선형 보간", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10, 20, 30, 40, 50], 0.25)).toBe(20);
    expect(quantile([7], 0.75)).toBe(7);
  });
});

describe("benchmarkRatios", () => {
  // 영업이익률 10%·20%·30%·40%·50%, 부채비율은 반대로 높을수록 나쁨
  const peers = multiRowsToStandard(
    [1, 2, 3, 4, 5].flatMap((i) =>
      rows(`C${i}`, "CFS", {
        매출액: ["100", "100"],
        영업이익: [String(i * 10), "5"],
        부채총계: [String(i * 20), "0"],
        자본총계: ["100", "100"],
      }),
    ),
    2025,
  );

  it("업종 중앙값·사분위수와 유리한 방향 기준 순위", () => {
    const b = benchmarkRatios(peers, "C4");
    expect(b.operatingMargin).toMatchObject({ n: 5, p25: 0.2, median: 0.3, p75: 0.4, value: 0.4 });
    expect(b.operatingMargin?.topPercent).toBe(40); // 더 나은 회사 1곳 → (1+1)/5
    // 부채비율은 낮을수록 좋음: C4(80%)보다 낮은 회사 3곳 → 상위 80%
    expect(b.debtRatio).toMatchObject({ median: 0.6, value: 0.8, topPercent: 80 });
  });

  it("최고 값이면 상위 20%가 아니라 상위 (1/n)", () => {
    expect(benchmarkRatios(peers, "C5").operatingMargin?.topPercent).toBe(20);
  });

  it("대상 회사 데이터가 없으면 통계만, 비교 회사가 5곳 미만인 비율은 null", () => {
    const b = benchmarkRatios(peers, "NONE");
    expect(b.operatingMargin).toMatchObject({ value: null, topPercent: null, n: 5 });
    // 유동자산이 없어 유동비율은 계산 불가 → 표본 0
    expect(b.currentRatio).toBeNull();
  });
});

describe("standingOf", () => {
  it("상위 25% 이내 상위권, 75% 초과 하위권", () => {
    expect([standingOf(1), standingOf(25), standingOf(26), standingOf(75), standingOf(76)]).toEqual([
      "top",
      "top",
      "middle",
      "middle",
      "bottom",
    ]);
  });
});
