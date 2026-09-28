import { describe, expect, it } from "vitest";
import { maxIndices, parseCorpList, pickDefaultYear } from "./compare";

describe("parseCorpList", () => {
  it("8자리 코드만, 중복 제거, 최대 3개, 순서 유지", () => {
    expect(parseCorpList("00126380,00164779,00126380,abc,1234,00266961,00401731")).toEqual([
      "00126380",
      "00164779",
      "00266961",
    ]);
  });

  it("공백·빈 값·배열 파라미터", () => {
    expect(parseCorpList(" 00126380 , ,")).toEqual(["00126380"]);
    expect(parseCorpList(["00126380", "00164779"])).toEqual(["00126380", "00164779"]);
    expect(parseCorpList(undefined)).toEqual([]);
    expect(parseCorpList("")).toEqual([]);
  });
});

describe("maxIndices", () => {
  it("최댓값 회사 인덱스 (null 무시)", () => {
    expect(maxIndices([0.131, 0.486, null])).toEqual([1]);
    expect(maxIndices([-5, -2, -9])).toEqual([1]);
  });

  it("동률이면 모두", () => {
    expect(maxIndices([3, 1, 3])).toEqual([0, 2]);
  });

  it("값 있는 회사가 2곳 미만이면 강조 없음", () => {
    expect(maxIndices([5, null, null])).toEqual([]);
    expect(maxIndices([])).toEqual([]);
  });
});

describe("pickDefaultYear", () => {
  it("모든 회사에 공통인 가장 최근 연도", () => {
    expect(
      pickDefaultYear([
        [2021, 2022, 2023, 2024, 2025],
        [2020, 2021, 2022, 2023, 2024],
      ]),
    ).toBe(2024);
  });

  it("실패한 회사(빈 배열)는 무시", () => {
    expect(pickDefaultYear([[2021, 2022, 2023, 2024, 2025], []])).toBe(2025);
  });

  it("공통 연도가 없으면 전체 중 최근, 아무것도 없으면 null", () => {
    expect(pickDefaultYear([[2019, 2020], [2024, 2025]])).toBe(2025);
    expect(pickDefaultYear([[], []])).toBeNull();
  });
});
