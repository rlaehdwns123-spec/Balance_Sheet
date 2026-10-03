import { describe, expect, it } from "vitest";
import { formatAmount, formatChange, formatMoneyCompact, formatRatio, formatRatioDelta, formatWonCompact } from "./format";

describe("formatWonCompact", () => {
  it("1조 이상은 조, 미만은 억", () => {
    expect(formatWonCompact(300e12)).toBe("300조");
    expect(formatWonCompact(-8e12)).toBe("-8조");
    expect(formatWonCompact(3.4e11)).toBe("3,400억");
    expect(formatWonCompact(0)).toBe("0");
  });

  it("축 간격이 1조 미만이면 조 단위에 소수 1자리", () => {
    expect(formatWonCompact(1.5e12, 5e11)).toBe("1.5조");
  });
});

describe("formatRatio", () => {
  it("percent는 소수 1자리 %, times는 소수 2자리 회", () => {
    expect(formatRatio(0.1306962678, "percent")).toBe("13.1%");
    expect(formatRatio(-0.298, "percent")).toBe("-29.8%");
    expect(formatRatio(12.5, "percent")).toBe("1,250.0%");
    expect(formatRatio(0.6169467229, "times")).toBe("0.62회");
    expect(formatRatio(null, "times")).toBe("–");
  });

  it("배수·일수·금액 단위", () => {
    expect(formatRatio(3.7158, "multiple")).toBe("3.72배");
    expect(formatRatio(123.1, "days")).toBe("123일");
    expect(formatRatio(-32617239000000, "won")).toBe("-32.6조");
    expect(formatRatio(3.4e11, "won")).toBe("3,400억");
  });
});

describe("formatRatioDelta", () => {
  it("percent 증감은 %p, 방향은 부호로", () => {
    expect(formatRatioDelta(0.0219, "percent")).toEqual({ direction: "up", text: "2.2%p" });
    expect(formatRatioDelta(-0.0219, "percent")).toEqual({ direction: "down", text: "2.2%p" });
  });

  it("표시 자릿수로 반올림해 0이면 flat", () => {
    expect(formatRatioDelta(0.0004, "percent")).toEqual({ direction: "flat", text: "0" });
    expect(formatRatioDelta(-0.004, "times")).toEqual({ direction: "flat", text: "0" });
  });

  it("times 증감은 회, 없으면 null", () => {
    expect(formatRatioDelta(0.125, "times")).toEqual({ direction: "up", text: "0.13회" });
    expect(formatRatioDelta(null, "times")).toBeNull();
  });

  it("배수·일수·금액 증감", () => {
    expect(formatRatioDelta(-0.5, "multiple")).toEqual({ direction: "down", text: "0.50배" });
    expect(formatRatioDelta(12.4, "days")).toEqual({ direction: "up", text: "12일" });
    expect(formatRatioDelta(0.3, "days")).toEqual({ direction: "flat", text: "0" });
    expect(formatRatioDelta(2e12, "won")).toEqual({ direction: "up", text: "2.0조" });
    expect(formatRatioDelta(1e6, "won")).toEqual({ direction: "flat", text: "0" });
  });
});

describe("formatAmount", () => {
  it("억원/백만원 변환과 천단위 쉼표", () => {
    expect(formatAmount(333_605_938_000_000, "eok")).toEqual({ text: "3,336,059", negative: false });
    expect(formatAmount(333_605_938_000_000, "mil")).toEqual({ text: "333,605,938", negative: false });
  });

  it("음수는 괄호 표기", () => {
    expect(formatAmount(-4_480_835_000_000, "eok")).toEqual({ text: "(44,808)", negative: true });
  });

  it("반올림해서 0이면 부호 없는 0", () => {
    expect(formatAmount(-1_000, "eok")).toEqual({ text: "0", negative: false });
  });

  it("빈 값", () => {
    expect(formatAmount(null, "eok")).toEqual({ text: "–", negative: false });
  });

  it("주당 값은 원 단위 그대로", () => {
    expect(formatAmount(6605, "eok", true)).toEqual({ text: "6,605", negative: false });
    expect(formatAmount(-120, "mil", true)).toEqual({ text: "(120)", negative: true });
  });
});

describe("formatChange", () => {
  it("비교 기간 대비 증감률, 분모는 절댓값", () => {
    expect(formatChange(120, 100)).toEqual({ direction: "up", text: "20.0%" });
    expect(formatChange(80, 100)).toEqual({ direction: "down", text: "20.0%" });
    expect(formatChange(-50, -100)).toEqual({ direction: "up", text: "50.0%" });
    expect(formatChange(100, 100)).toEqual({ direction: "flat", text: "0.0%" });
  });

  it("값이 없거나 비교 기간이 0이면 –", () => {
    expect(formatChange(null, 100).text).toBe("–");
    expect(formatChange(100, 0).text).toBe("–");
  });

  it("손익 항목은 부호가 바뀌면 흑자·적자전환", () => {
    expect(formatChange(10, -5, true)).toEqual({ direction: "up", text: "흑자전환" });
    expect(formatChange(-10, 5, true)).toEqual({ direction: "down", text: "적자전환" });
    expect(formatChange(-10, -5, true)).toEqual({ direction: "none", text: "적자지속" });
  });
});

describe("formatMoneyCompact", () => {
  it("원화는 기존 표기, 그 밖은 통화 이름을 붙인다", () => {
    expect(formatMoneyCompact(3.4e11)).toBe("3,400억");
    expect(formatMoneyCompact(1.33e11, "USD")).toBe("1,330억 달러");
    expect(formatMoneyCompact(-2.5e12, "TWD")).toBe("-2.5조 대만달러");
    expect(formatMoneyCompact(1e9, "XYZ")).toBe("10억 XYZ");
  });
});
