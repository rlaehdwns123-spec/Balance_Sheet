import { describe, expect, it } from "vitest";
import { filingUrl, formLabel, matchesType, pageFilings, parseFilingType, trimFilings } from "./filings";
import type { SecFiling } from "./types";

const filing = (form: string, i: number, extra: Partial<SecFiling> = {}): SecFiling => ({
  accessionNumber: `0000320193-25-${String(i).padStart(6, "0")}`,
  filingDate: "2025-10-31",
  reportDate: "2025-09-27",
  form,
  primaryDocument: "aapl-20250927.htm",
  primaryDocDescription: form,
  ...extra,
});

describe("matchesType", () => {
  it("주요 = 연간·분기·수시, 정정본 포함", () => {
    for (const form of ["10-K", "10-K/A", "20-F", "40-F", "10-Q", "8-K", "6-K"]) expect(matchesType(form, "main")).toBe(true);
    for (const form of ["4", "144", "SC 13G", "DEF 14A"]) expect(matchesType(form, "main")).toBe(false);
    expect(matchesType("4", "all")).toBe(true);
  });

  it("유형별", () => {
    expect(matchesType("20-F/A", "annual")).toBe(true);
    expect(matchesType("10-Q", "annual")).toBe(false);
    expect(matchesType("6-K", "current")).toBe(true);
  });
});

describe("formLabel", () => {
  it("한글 설명, 정정본은 기본 서식으로, 모르는 서식은 null", () => {
    expect(formLabel("10-K/A")).toBe("연간 보고서");
    expect(formLabel("424B2")).toBe("투자설명서");
    expect(formLabel("X-17A-5")).toBeNull();
  });
});

describe("filingUrl", () => {
  it("CIK 앞자리 0과 접수번호 하이픈을 뺀 원문 주소", () => {
    expect(filingUrl("0000320193", filing("10-K", 79))).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm",
    );
  });
  it("주 문서가 없으면 색인 페이지", () => {
    expect(filingUrl("0000320193", filing("4", 1, { primaryDocument: "" }))).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000032019325000001/0000320193-25-000001-index.htm",
    );
  });
});

describe("pageFilings", () => {
  const filings = [
    filing("4", 1),
    filing("10-K", 2),
    filing("8-K", 3, { primaryDocDescription: "Press release" }),
    ...Array.from({ length: 25 }, (_, i) => filing("10-Q", 10 + i)),
  ];

  it("유형으로 거르고 20건씩 자른다", () => {
    const p1 = pageFilings("0000320193", filings, "main", 1);
    expect(p1).toMatchObject({ page: 1, totalPages: 2, total: 27 });
    expect(p1.items).toHaveLength(20);
    expect(p1.items[0].form).toBe("10-K");
    expect(pageFilings("0000320193", filings, "main", 2).items).toHaveLength(7);
  });

  it("범위를 넘는 페이지는 마지막 페이지로", () => {
    expect(pageFilings("0000320193", filings, "annual", 9)).toMatchObject({ page: 1, totalPages: 1, total: 1 });
  });

  it("설명이 서식명과 같으면 빼고, 다르면 남긴다", () => {
    const items = pageFilings("0000320193", filings, "all", 1).items;
    expect(items[1].description).toBeNull();
    expect(items[2].description).toBe("Press release");
  });

  it("알 수 없는 유형 값은 주요", () => {
    expect(parseFilingType("zzz")).toBe("main");
    expect(parseFilingType("annual")).toBe("annual");
  });
});

describe("trimFilings", () => {
  it("주요 보고서는 모두 남기고 그 밖의 서류는 최근 limit건만", () => {
    const filings = [
      ...Array.from({ length: 5 }, (_, i) => filing("424B2", i)),
      filing("10-K", 100),
      ...Array.from({ length: 5 }, (_, i) => filing("424B2", 200 + i)),
      filing("8-K", 300),
    ];
    const trimmed = trimFilings(filings, 3);
    expect(trimmed.map((f) => f.form)).toEqual(["424B2", "424B2", "424B2", "10-K", "8-K"]);
  });
});
