import { describe, expect, it } from "vitest";
import { alignedTicks, niceStep, niceTicks } from "./chartTicks";

describe("niceStep", () => {
  it("1·2·2.5·5 × 10^k로 올림", () => {
    expect(niceStep(85e12)).toBe(100e12);
    expect(niceStep(21e12)).toBe(25e12);
    expect(niceStep(0.047)).toBeCloseTo(0.05, 12);
    expect(niceStep(2)).toBe(2);
  });
});

describe("niceTicks", () => {
  it("양수만: 0부터 깔끔한 간격 (삼성 매출 3,336조 → 0~400조)", () => {
    expect(niceTicks([333.6e12, 43.6e12, 6.6e12])).toEqual({
      domain: [0, 400e12],
      ticks: [0, 100e12, 200e12, 300e12, 400e12],
    });
  });

  it("음수 포함 시 0 아래로도 확장", () => {
    const t = niceTicks([97e12, -7.7e12]);
    expect(t.ticks).toContain(0);
    expect(t.domain[0]).toBeLessThan(-7.7e12);
    expect(t.domain[1]).toBeGreaterThanOrEqual(97e12);
  });

  it("값이 모두 0이면 [0, 1]", () => {
    expect(niceTicks([0, 0])).toEqual({ domain: [0, 1], ticks: [0, 1] });
  });
});

describe("alignedTicks", () => {
  it("주축과 칸 수·0선 위치를 맞춘다", () => {
    const primary = niceTicks([333.6e12, 6.6e12]); // 0~400조, 4칸, 0선 맨 아래
    const t = alignedTicks(primary, [0.183, 0.025, 0.131]);
    expect(t.ticks).toHaveLength(primary.ticks.length);
    expect(t.domain[0]).toBe(0);
    expect(t.ticks).toEqual([0, 0.05, 0.1, 0.15, 0.2]);
  });

  it("주축에 0선 아래 칸이 있으면 보조축 음수도 같은 칸에 들어간다", () => {
    const primary = { domain: [-25, 100] as [number, number], ticks: [-25, 0, 25, 50, 75, 100] };
    const t = alignedTicks(primary, [0.486, -0.236, 0.3]);
    expect(t.ticks).toEqual([-0.25, 0, 0.25, 0.5, 0.75, 1]);
  });

  it("주축에 0선 아래 칸이 없는데 보조축이 음수면 독립 눈금으로", () => {
    const primary = niceTicks([100, 50]);
    const t = alignedTicks(primary, [0.2, -0.1]);
    expect(t.domain[0]).toBeLessThan(0);
    expect(t.domain[1]).toBeGreaterThanOrEqual(0.2);
  });
});
