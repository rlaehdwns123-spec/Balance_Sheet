import { describe, expect, it } from "vitest";
import { interimCandidates, previousInterims } from "./interim";

describe("previousInterims", () => {
  it("사업보고서를 건너뛰고 앞의 분기·반기 보고서를 최신순으로", () => {
    expect(previousInterims({ year: 2026, code: "11012" }, 3)).toEqual([
      { year: 2026, code: "11013" },
      { year: 2025, code: "11014" },
      { year: 2025, code: "11012" },
    ]);
  });
});

describe("interimCandidates", () => {
  it("분기가 끝난 보고서부터 후보로", () => {
    expect(interimCandidates(new Date(2026, 8, 28), 2)).toEqual([
      { year: 2026, code: "11012" },
      { year: 2026, code: "11013" },
    ]);
    expect(interimCandidates(new Date(2026, 9, 1), 1)).toEqual([{ year: 2026, code: "11014" }]);
  });

  it("1분기가 끝나기 전이면 작년 3분기부터", () => {
    expect(interimCandidates(new Date(2027, 1, 15), 2)).toEqual([
      { year: 2026, code: "11014" },
      { year: 2026, code: "11012" },
    ]);
  });
});
