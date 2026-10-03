import { describe, expect, it } from "vitest";
import { MAX_WATCH, parseWatchlist, toggleIn, type WatchCorp } from "./watchlist";

const corp = (n: number): WatchCorp => ({ corpCode: String(n).padStart(8, "0"), name: `회사${n}`, stockCode: "000000", addedAt: n });

describe("parseWatchlist", () => {
  it("손상된 값·형식이 틀린 항목·중복은 버린다", () => {
    expect(parseWatchlist(null)).toEqual([]);
    expect(parseWatchlist("{not json")).toEqual([]);
    expect(parseWatchlist('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([corp(1), { corpCode: "123", name: "x", stockCode: "", addedAt: 1 }, corp(1), corp(2)]);
    expect(parseWatchlist(raw).map((c) => c.corpCode)).toEqual(["00000001", "00000002"]);
  });
});

describe("toggleIn", () => {
  it("없으면 맨 앞에 추가, 있으면 뺀다", () => {
    const added = toggleIn([corp(1)], { corpCode: "00000002", name: "회사2", stockCode: "000000" }, 99);
    expect(added.map((c) => c.corpCode)).toEqual(["00000002", "00000001"]);
    expect(added[0].addedAt).toBe(99);
    expect(toggleIn(added, { corpCode: "00000001", name: "회사1", stockCode: "000000" }, 100).map((c) => c.corpCode)).toEqual([
      "00000002",
    ]);
  });

  it("최대 개수 유지", () => {
    const full = Array.from({ length: MAX_WATCH }, (_, i) => corp(i + 1));
    const next = toggleIn(full, { corpCode: "99999999", name: "새회사", stockCode: "" }, 1);
    expect(next).toHaveLength(MAX_WATCH);
    expect(next[0].corpCode).toBe("99999999");
  });
});
