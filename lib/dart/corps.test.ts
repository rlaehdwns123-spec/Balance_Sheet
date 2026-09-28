import { describe, expect, it } from "vitest";
import { parseCorpCodeXml, searchCorps, type Corp } from "./corps";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><corp_eng_name>SAMSUNG ELECTRONICS CO,.LTD</corp_eng_name><stock_code>005930</stock_code><modify_date>20240101</modify_date></list>
  <list><corp_code>00999999</corp_code><corp_name>비상장회사</corp_name><corp_eng_name></corp_eng_name><stock_code> </stock_code><modify_date>20240101</modify_date></list>
  <list><corp_code>00164779</corp_code><corp_name>SK하이닉스</corp_name><corp_eng_name>SK hynix</corp_eng_name><stock_code>000660</stock_code><modify_date>20240101</modify_date></list>
  <list><corp_code>00000001</corp_code><corp_name>A&amp;B</corp_name><corp_eng_name></corp_eng_name><stock_code>123450</stock_code><modify_date>20240101</modify_date></list>
</result>`;

describe("parseCorpCodeXml", () => {
  it("stock_code가 있는 회사만 추출한다", () => {
    expect(parseCorpCodeXml(XML)).toEqual([
      { corp_code: "00126380", corp_name: "삼성전자", stock_code: "005930" },
      { corp_code: "00164779", corp_name: "SK하이닉스", stock_code: "000660" },
      { corp_code: "00000001", corp_name: "A&B", stock_code: "123450" },
    ]);
  });
});

describe("searchCorps", () => {
  const corps: Corp[] = [
    { corp_code: "1", corp_name: "삼성화재", stock_code: "000810" },
    { corp_code: "2", corp_name: "삼성전자", stock_code: "005930" },
    { corp_code: "3", corp_name: "르노삼성", stock_code: "900000" },
    { corp_code: "4", corp_name: "SK하이닉스", stock_code: "000660" },
    { corp_code: "5", corp_name: "삼성 SDI", stock_code: "006400" },
  ];
  const names = (q: string, limit?: number) => searchCorps(corps, q, limit).map((c) => c.corp_name);

  it("회사명 부분일치, 접두 일치가 포함보다 앞선다", () => {
    expect(names("삼성")).toEqual(["삼성화재", "삼성전자", "삼성 SDI", "르노삼성"]);
  });

  it("종목코드로 검색한다", () => {
    expect(names("005930")).toEqual(["삼성전자"]);
    expect(names("0006")).toEqual(["SK하이닉스"]);
  });

  it("대소문자·공백을 무시한다", () => {
    expect(names("sk하이")).toEqual(["SK하이닉스"]);
    expect(names("삼성sdi")).toEqual(["삼성 SDI"]);
  });

  it("빈 검색어는 결과가 없고, limit을 지킨다", () => {
    expect(names("  ")).toEqual([]);
    expect(names("삼성", 2)).toHaveLength(2);
  });
});
