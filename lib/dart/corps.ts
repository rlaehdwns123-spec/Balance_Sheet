export type Corp = {
  corp_code: string;
  corp_name: string;
  stock_code: string;
};

/** corpCode.xml 본문에서 stock_code가 있는(상장) 회사만 추출 */
export function parseCorpCodeXml(xml: string): Corp[] {
  const corps: Corp[] = [];
  for (const [, body] of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const field = (tag: string) => body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1].trim() ?? "";
    const stock_code = field("stock_code");
    if (!stock_code) continue;
    corps.push({ corp_code: field("corp_code"), corp_name: decodeXml(field("corp_name")), stock_code });
  }
  return corps;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");

/**
 * 회사명/종목코드 부분일치 검색.
 * 정렬: 종목코드 일치 > 회사명 일치 > 회사명 접두 > 종목코드 접두 > 회사명 포함 > 종목코드 포함,
 * 같은 등급 안에서는 종목코드 오름차순 (오래된 대형 상장사가 앞에 오는 경향).
 */
export function searchCorps(corps: Corp[], query: string, limit = 10): Corp[] {
  const q = normalize(query);
  if (!q) return [];

  const ranked: { corp: Corp; rank: number }[] = [];
  for (const corp of corps) {
    const name = normalize(corp.corp_name);
    const code = corp.stock_code;
    let rank: number;
    if (code === q) rank = 0;
    else if (name === q) rank = 1;
    else if (name.startsWith(q)) rank = 2;
    else if (code.startsWith(q)) rank = 3;
    else if (name.includes(q)) rank = 4;
    else if (code.includes(q)) rank = 5;
    else continue;
    ranked.push({ corp, rank });
  }

  return ranked
    .sort((a, b) => a.rank - b.rank || a.corp.stock_code.localeCompare(b.corp.stock_code))
    .slice(0, limit)
    .map((r) => r.corp);
}
