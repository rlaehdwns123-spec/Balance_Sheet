import { describe, expect, it } from "vitest";
import { addRecent, MAX_RECENT, parseRecent, type RecentCorp } from "./recent";

const corp = (n: number, viewedAt = n): RecentCorp => ({
  corpCode: String(n).padStart(8, "0"),
  name: `회사${n}`,
  stockCode: String(n).padStart(6, "0"),
  viewedAt,
});

describe("parseRecent", () => {
  it("정상 JSON", () => {
    expect(parseRecent(JSON.stringify([corp(1), corp(2)]))).toEqual([corp(1), corp(2)]);
  });

  it("없음·깨진 JSON·배열 아님은 빈 목록", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("{not json")).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
  });

  it("형식이 틀린 항목만 버린다", () => {
    const raw = JSON.stringify([corp(1), { corpCode: "abc", name: "x" }, null, corp(2)]);
    expect(parseRecent(raw)).toEqual([corp(1), corp(2)]);
  });
});

describe("addRecent", () => {
  it("맨 앞에 추가하고 같은 회사는 중복 제거", () => {
    const list = [corp(1), corp(2), corp(3)];
    expect(addRecent(list, corp(2, 99)).map((c) => c.corpCode)).toEqual(["00000002", "00000001", "00000003"]);
  });

  it(`최대 ${MAX_RECENT}개 유지`, () => {
    const list = Array.from({ length: MAX_RECENT }, (_, i) => corp(i + 1));
    const next = addRecent(list, corp(100));
    expect(next).toHaveLength(MAX_RECENT);
    expect(next[0].corpCode).toBe("00000100");
    expect(next.at(-1)?.corpCode).toBe(String(MAX_RECENT - 1).padStart(8, "0"));
  });
});
