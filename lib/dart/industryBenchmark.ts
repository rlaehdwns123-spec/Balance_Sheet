import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { benchmarkRatios, multiRowsToStandard, type RatioBenchmark } from "@/lib/benchmark";
import { industryName } from "@/lib/ksic";
import { getMultiAccounts } from "./client";

const INDUSTRIES_FILE = path.join(process.cwd(), "data", "industries.json");
const CHUNK = 100;

let cache: Promise<Record<string, string>> | null = null;

/** data/industries.json (corp_code → 업종코드). 없으면 빈 객체 — 업종 비교만 빠지고 나머지는 동작 */
function loadIndustries(): Promise<Record<string, string>> {
  cache ??= readFile(INDUSTRIES_FILE, "utf8")
    .then((t) => JSON.parse(t) as Record<string, string>)
    .catch(() => ({}));
  return cache;
}

export type IndustryBenchmark = {
  /** KSIC 중분류 코드(앞 2자리)와 이름 */
  code: string;
  name: string;
  year: number;
  /** 해당 연도 데이터가 있는 업종 회사 수 */
  companies: number;
  byRatio: Record<string, RatioBenchmark | null>;
};

/**
 * 같은 KSIC 중분류(업종코드 앞 2자리) 상장사들의 해당 연도 재무비율 통계.
 * 주요계정 API를 100개사씩 병렬 호출(하루 캐시). 업종 목록이 없거나 회사가 적으면 null.
 */
export async function getIndustryBenchmark(
  corpCode: string,
  indutyCode: string,
  year: number,
): Promise<IndustryBenchmark | null> {
  const code = indutyCode.slice(0, 2);
  if (code.length < 2) return null;

  const industries = await loadIndustries();
  const peers = Object.entries(industries)
    .filter(([, c]) => c.startsWith(code))
    .map(([corp]) => corp);
  if (!peers.includes(corpCode)) peers.push(corpCode);
  if (peers.length < 5) return null;

  peers.sort(); // 같은 업종이면 청크 구성이 같아 캐시가 재사용된다
  const chunks = Array.from({ length: Math.ceil(peers.length / CHUNK) }, (_, i) => peers.slice(i * CHUNK, (i + 1) * CHUNK));
  const rows = (await Promise.all(chunks.map((c) => getMultiAccounts(c, year)))).flat();

  const standard = multiRowsToStandard(rows, year);
  return {
    code,
    name: industryName(indutyCode) ?? `KSIC ${code}`,
    year,
    companies: standard.size,
    byRatio: benchmarkRatios(standard, corpCode),
  };
}
