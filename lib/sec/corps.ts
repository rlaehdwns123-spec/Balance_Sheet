import type { UsCorp } from "./types";

/** CIK를 SEC URL에 쓰는 10자리로. 숫자가 아니면 null */
export function padCik(cik: string | number): string | null {
  const s = String(cik).trim();
  if (!/^\d{1,10}$/.test(s)) return null;
  return s.padStart(10, "0");
}

type CompanyTickersJson = Record<string, { cik_str: number; ticker: string; title: string }>;

/**
 * company_tickers.json → 종목 목록. 티커마다 한 행(GOOGL·GOOG처럼 한 CIK에 티커가 여럿일 수 있다).
 * SEC 원본 순서(대략 시가총액순)를 유지한다.
 */
export function parseCompanyTickers(json: CompanyTickersJson): UsCorp[] {
  return Object.values(json).map((r) => ({
    cik: padCik(r.cik_str)!,
    ticker: r.ticker,
    name: r.title,
  }));
}

const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * 티커·영문 회사명 검색. 한 회사(CIK)는 가장 잘 맞은 티커 하나로.
 * 정렬: 티커 일치 > 회사명 일치 > 티커 접두 > 회사명 접두 > 회사명 단어 접두 > 회사명 포함,
 * 같은 등급 안에서는 원본 순서(대략 시가총액순).
 */
export function searchUsCorps(corps: UsCorp[], query: string, limit = 10): UsCorp[] {
  const q = normalizeName(query);
  if (!q) return [];
  const qTicker = query.trim().toUpperCase().replace(/[.\s]/g, "-"); // BRK.B → BRK-B

  const best = new Map<string, { corp: UsCorp; rank: number; index: number }>();
  corps.forEach((corp, index) => {
    const name = normalizeName(corp.name);
    let rank: number;
    if (corp.ticker === qTicker) rank = 0;
    else if (name === q) rank = 1;
    else if (corp.ticker.startsWith(qTicker)) rank = 2;
    else if (name.startsWith(q)) rank = 3;
    else if (` ${name}`.includes(` ${q}`)) rank = 4;
    else if (name.includes(q)) rank = 5;
    else return;
    const cur = best.get(corp.cik);
    if (!cur || rank < cur.rank) best.set(corp.cik, { corp, rank, index: cur ? Math.min(cur.index, index) : index });
  });

  return [...best.values()]
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.corp);
}
