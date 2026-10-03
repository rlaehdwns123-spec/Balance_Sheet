import { describe, expect, it } from "vitest";
import { padCik, parseCompanyTickers, searchUsCorps } from "./corps";

describe("padCik", () => {
  it("10자리로 채우고, 숫자가 아니면 null", () => {
    expect(padCik(320193)).toBe("0000320193");
    expect(padCik("0000320193")).toBe("0000320193");
    expect(padCik("AAPL")).toBeNull();
    expect(padCik("12345678901")).toBeNull();
  });
});

describe("parseCompanyTickers", () => {
  it("티커마다 한 행, 원본 순서 유지", () => {
    const corps = parseCompanyTickers({
      "0": { cik_str: 1652044, ticker: "GOOGL", title: "Alphabet Inc." },
      "1": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." },
      "2": { cik_str: 1652044, ticker: "GOOG", title: "Alphabet Inc." },
    });
    expect(corps.map((c) => c.ticker)).toEqual(["GOOGL", "AAPL", "GOOG"]);
    expect(corps[1]).toEqual({ cik: "0000320193", ticker: "AAPL", name: "Apple Inc." });
  });
});

describe("searchUsCorps", () => {
  const corps = [
    { cik: "0001045810", ticker: "NVDA", name: "NVIDIA CORP" },
    { cik: "0000320193", ticker: "AAPL", name: "Apple Inc." },
    { cik: "0001652044", ticker: "GOOGL", name: "Alphabet Inc." },
    { cik: "0001652044", ticker: "GOOG", name: "Alphabet Inc." },
    { cik: "0001067983", ticker: "BRK-B", name: "BERKSHIRE HATHAWAY INC" },
    { cik: "0000000001", ticker: "APLE", name: "Apple Hospitality REIT, Inc." },
    { cik: "0000000002", ticker: "PINE", name: "Pineapple Energy" },
  ];

  it("티커 일치가 먼저, 대소문자 무시", () => {
    expect(searchUsCorps(corps, "aapl")[0].ticker).toBe("AAPL");
  });

  it("회사명 접두 > 포함, 같은 등급은 원본 순서", () => {
    expect(searchUsCorps(corps, "apple").map((c) => c.ticker)).toEqual(["AAPL", "APLE", "PINE"]);
  });

  it("한 회사는 한 번만 (가장 잘 맞은 티커)", () => {
    expect(searchUsCorps(corps, "goog").map((c) => c.ticker)).toEqual(["GOOG"]);
    expect(searchUsCorps(corps, "alphabet").map((c) => c.ticker)).toEqual(["GOOGL"]);
  });

  it("BRK.B처럼 점으로 써도 찾는다", () => {
    expect(searchUsCorps(corps, "brk.b")[0].ticker).toBe("BRK-B");
  });

  it("빈 검색어·한글은 결과 없음", () => {
    expect(searchUsCorps(corps, "  ")).toEqual([]);
    expect(searchUsCorps(corps, "애플")).toEqual([]);
  });
});
