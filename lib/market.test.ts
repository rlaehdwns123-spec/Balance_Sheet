import { describe, expect, it } from "vitest";
import { companyPath, isValidCode } from "./market";
import { parseRecent } from "./recent";
import { parseWatchlist } from "./watchlist";

describe("companyPath", () => {
  it("한국은 /company/{고유번호}, 미국은 /company/us/{CIK}", () => {
    expect(companyPath("00126380")).toBe("/company/00126380");
    expect(companyPath("0000320193", "us", "ratios")).toBe("/company/us/0000320193/ratios");
  });
});

describe("isValidCode", () => {
  it("market이 없으면 예전 한국 항목", () => {
    expect(isValidCode("00126380", undefined)).toBe(true);
    expect(isValidCode("0000320193", undefined)).toBe(false);
    expect(isValidCode("0000320193", "us")).toBe(true);
    expect(isValidCode("00126380", "us")).toBe(false);
    expect(isValidCode("00126380", "jp")).toBe(false);
  });
});

describe("최근 본 기업·관심기업에 미국 기업", () => {
  it("market: us 항목을 읽고, 형식이 틀리면 버린다", () => {
    const raw = JSON.stringify([
      { corpCode: "0000320193", name: "Apple Inc.", stockCode: "AAPL", market: "us", viewedAt: 2, addedAt: 2 },
      { corpCode: "00126380", name: "삼성전자", stockCode: "005930", viewedAt: 1, addedAt: 1 },
      { corpCode: "320193", name: "bad", stockCode: "X", market: "us", viewedAt: 0, addedAt: 0 },
    ]);
    expect(parseRecent(raw).map((c) => c.stockCode)).toEqual(["AAPL", "005930"]);
    expect(parseWatchlist(raw).map((c) => c.stockCode)).toEqual(["AAPL", "005930"]);
  });
});
