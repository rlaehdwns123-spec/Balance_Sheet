import { ACCOUNT_KEYS, parseAmount, type AccountKey, type StandardAccounts } from "@/lib/normalize";
import { computeRatios, RATIOS } from "@/lib/ratios";

/** DART 다중회사 주요계정(fnlttMultiAcnt) 한 행 */
export type MultiAccountRow = {
  corp_code: string;
  fs_div: "CFS" | "OFS";
  sj_div: string;
  account_nm: string;
  thstrm_amount: string;
  frmtrm_amount?: string;
};

/** 주요계정 이름 → 표준 계정. 매출총이익·재고자산·지배주주 지분은 이 API에 없다 */
const MULTI_ACCOUNT_KEYS: Record<string, AccountKey> = {
  유동자산: "currentAssets",
  자산총계: "totalAssets",
  유동부채: "currentLiabilities",
  부채총계: "totalLiabilities",
  자본총계: "totalEquity",
  매출액: "revenue",
  영업이익: "operatingIncome",
  당기순이익: "netIncome",
};

/** 업종 비교가 가능한 비율 (입력 계정이 모두 주요계정에 있는 것) */
export const BENCHMARK_RATIO_KEYS = ["operatingMargin", "netMargin", "roe", "roa", "debtRatio", "currentRatio", "equityRatio",
  "revenueGrowth", "operatingIncomeGrowth", "netIncomeGrowth", "assetGrowth", "assetTurnover", "equityTurnover"] as const;

const MIN_PEERS = 5;

const emptyYear = (year: number): StandardAccounts =>
  Object.fromEntries([["year", year], ...ACCOUNT_KEYS.map((k) => [k, null])]) as StandardAccounts;

const normalizeName = (name: string) => name.replace(/\s+/g, "").replace(/\((손실|이익)\)$/, "");

/**
 * 주요계정 행 → 회사별 [전기, 당기] 표준 계정. 연결(CFS)이 있으면 연결, 없으면 별도(OFS).
 */
export function multiRowsToStandard(rows: MultiAccountRow[], year: number): Map<string, StandardAccounts[]> {
  const byCorp = new Map<string, MultiAccountRow[]>();
  for (const r of rows) byCorp.set(r.corp_code, [...(byCorp.get(r.corp_code) ?? []), r]);

  const result = new Map<string, StandardAccounts[]>();
  for (const [corp, list] of byCorp) {
    const hasCfs = list.some((r) => r.fs_div === "CFS");
    const picked = list.filter((r) => r.fs_div === (hasCfs ? "CFS" : "OFS"));
    const prev = emptyYear(year - 1);
    const cur = emptyYear(year);
    for (const r of picked) {
      const key = MULTI_ACCOUNT_KEYS[normalizeName(r.account_nm)];
      if (!key) continue;
      cur[key] = parseAmount(r.thstrm_amount);
      prev[key] = parseAmount(r.frmtrm_amount);
    }
    result.set(corp, [prev, cur]);
  }
  return result;
}

/** 선형 보간 분위수 (sorted는 오름차순) */
export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export type RatioBenchmark = {
  /** 값이 있는 업종 회사 수 (대상 회사 포함) */
  n: number;
  p25: number;
  median: number;
  p75: number;
  /** 같은 주요계정 기준으로 계산한 대상 회사 값 (순위 계산용) */
  value: number | null;
  /** 유리한 방향 기준 "상위 x%" (1~100). 대상 회사 값이 없으면 null */
  topPercent: number | null;
};

export type Standing = "top" | "middle" | "bottom";

/** 상위 25% 이내 → 상위권, 하위 25% → 하위권 */
export function standingOf(topPercent: number): Standing {
  return topPercent <= 25 ? "top" : topPercent > 75 ? "bottom" : "middle";
}

/**
 * 업종 회사들의 표준 계정 → 비율별 업종 통계와 대상 회사의 위치.
 * 값이 있는 회사가 MIN_PEERS 미만인 비율은 null (비교 의미가 약함).
 */
export function benchmarkRatios(
  peers: Map<string, StandardAccounts[]>,
  corpCode: string,
): Record<string, RatioBenchmark | null> {
  const ratiosByCorp = new Map<string, Record<string, number | null>>();
  for (const [corp, years] of peers) {
    const last = computeRatios(years).at(-1);
    if (last) ratiosByCorp.set(corp, last.values);
  }

  const out: Record<string, RatioBenchmark | null> = {};
  for (const key of BENCHMARK_RATIO_KEYS) {
    const def = RATIOS.find((r) => r.key === key)!;
    const values = [...ratiosByCorp.values()].map((v) => v[key]).filter((v): v is number => v != null && Number.isFinite(v));
    if (values.length < MIN_PEERS) {
      out[key] = null;
      continue;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const value = ratiosByCorp.get(corpCode)?.[key] ?? null;
    let topPercent: number | null = null;
    if (value != null) {
      const better = values.filter((v) => (def.higherIsBetter ? v > value : v < value)).length;
      topPercent = Math.max(1, Math.ceil(((better + 1) / values.length) * 100));
    }
    out[key] = {
      n: values.length,
      p25: quantile(sorted, 0.25),
      median: quantile(sorted, 0.5),
      p75: quantile(sorted, 0.75),
      value,
      topPercent,
    };
  }
  return out;
}
