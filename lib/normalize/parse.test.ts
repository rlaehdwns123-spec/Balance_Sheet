import { describe, expect, it } from "vitest";
import { parseAmount } from "./parse";

describe("parseAmount", () => {
  it("쉼표를 제거한다", () => {
    expect(parseAmount("1,234,567")).toBe(1234567);
    expect(parseAmount("333605938000000")).toBe(333605938000000);
  });

  it("음수: 마이너스 부호와 괄호 표기", () => {
    expect(parseAmount("-1,234")).toBe(-1234);
    expect(parseAmount("(1,234)")).toBe(-1234);
    expect(parseAmount("-4480835000000")).toBe(-4480835000000);
  });

  it("빈 값은 null", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    expect(parseAmount("-")).toBeNull();
    expect(parseAmount("()")).toBeNull();
    expect(parseAmount(undefined)).toBeNull();
    expect(parseAmount(null)).toBeNull();
  });

  it("0과 앞뒤 공백", () => {
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount(" 1,000 ")).toBe(1000);
  });

  it("숫자가 아니면 null", () => {
    expect(parseAmount("N/A")).toBeNull();
    expect(parseAmount("1,2a3")).toBeNull();
  });
});
