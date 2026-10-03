import type { SecCompanyFacts, SecConcept, SecFact } from "./types";

/** 연간 보고서: 10-K, 20-F, 40-F와 각 정정본(/A) */
const ANNUAL_FORM = /^(10-K|20-F|40-F)(\/A)?$/;
export const isAnnualForm = (form: string) => ANNUAL_FORM.test(form);

const DAY_MS = 86_400_000;
/** 손익·현금흐름 기간이 약 1년인지 (52·53주 회계연도 포함) */
export function isAnnualDuration(start: string, end: string): boolean {
  const days = (Date.parse(end) - Date.parse(start)) / DAY_MS;
  return days >= 350 && days <= 380;
}

/**
 * 기말일만으로 정하는 회계연도(회사 표기를 모를 때의 대체 규칙): 기말일이 속한 해.
 * 단 1월 첫 주에 끝나는 52·53주 회계연도(예: 2021-01-02)는 사실상 전년도 12월 결산이라 전년도로 본다.
 */
export function fiscalYearOf(end: string): number {
  const [y, m, d] = end.split("-").map(Number);
  return m === 1 && d <= 7 ? y - 1 : y;
}

/** 연간 보고서의 값이고, 기간 값이면 약 1년짜리인지 */
const isAnnualFact = (f: SecFact) => isAnnualForm(f.form) && (f.start === undefined || isAnnualDuration(f.start, f.end));

/**
 * 캐시용으로 companyfacts를 줄인다: 연간 보고서 값만, minEnd 이후 기말만, 설명(description) 제외.
 * 대형사 원본은 수 MB라(애플 3.8MB, JPM 8MB) Next 캐시 한도 2MB를 넘는다.
 */
export function trimCompanyFacts(raw: SecCompanyFacts, minEnd: string): SecCompanyFacts {
  const facts: SecCompanyFacts["facts"] = {};
  for (const [taxonomy, concepts] of Object.entries(raw.facts)) {
    const kept: Record<string, SecConcept> = {};
    for (const [tag, concept] of Object.entries(concepts)) {
      const units: SecConcept["units"] = {};
      for (const [unit, values] of Object.entries(concept.units)) {
        const annual = values
          .filter((f) => f.end >= minEnd && isAnnualFact(f))
          .map(({ start, end, val, form, fy, fp, filed }) => ({ start, end, val, form, fy, fp, filed }));
        if (annual.length) units[unit] = annual;
      }
      if (Object.keys(units).length) kept[tag] = { label: concept.label, units };
    }
    if (Object.keys(kept).length) facts[taxonomy] = kept;
  }
  return { cik: raw.cik, entityName: raw.entityName, facts };
}

export type Taxonomy = "us-gaap" | "ifrs-full";

/** 자산총계(Assets)가 ifrs-full에 있으면 IFRS 회사, 아니면 us-gaap */
export function primaryTaxonomy(cf: SecCompanyFacts): Taxonomy {
  return cf.facts["ifrs-full"]?.Assets ? "ifrs-full" : "us-gaap";
}

/** 보고 통화: 자산총계 연간 값이 가장 많은 통화 단위 (예: TSMC는 TWD와 USD 환산값 중 TWD) */
export function reportingCurrency(cf: SecCompanyFacts, taxonomy: Taxonomy = primaryTaxonomy(cf)): string | null {
  const units = cf.facts[taxonomy]?.Assets?.units ?? {};
  let best: string | null = null;
  let bestCount = 0;
  for (const [unit, values] of Object.entries(units)) {
    const count = values.filter(isAnnualFact).length;
    if (count > bestCount) [best, bestCount] = [unit, count];
  }
  return best;
}

export type FiscalPeriod = { fiscalYear: number; end: string };

/**
 * 회사의 회계연도 기말일 목록 (최신순).
 * 연간 보고서에 나온 약 1년 기간 값들의 기말일을 모아, 회계연도마다 가장 많이 쓰인 기말일을 고른다.
 * 재무상태표 순간 값은 이 기말일에 맞는 것만 받아서, 보고서 안의 다른 시점 값(후속 사건 등)을 거른다.
 *
 * 연도 표기는 회사가 쓰는 회계연도: 그 기간을 당기로 처음 보고한 연간 보고서의 fy.
 * 1월 결산 회사도 엔비디아·월마트는 끝난 해(2026년 1월 → FY2026), 타깃은 시작한 해(→ FY2025)로 불러
 * 기말일만으로는 정할 수 없다. 나중 보고서의 비교 수치에는 그 보고서의 fy가 붙으므로 가장 먼저 제출된 것만 본다.
 * fy가 없거나 기말일과 맞지 않으면(기말일의 해 또는 전년이 아니면) fiscalYearOf로 대신한다.
 */
export function fiscalPeriods(cf: SecCompanyFacts, taxonomy: Taxonomy = primaryTaxonomy(cf)): FiscalPeriod[] {
  const countByEnd = new Map<string, number>();
  const firstReport = new Map<string, { filed: string; fy?: number }>();
  for (const concept of Object.values(cf.facts[taxonomy] ?? {})) {
    for (const values of Object.values(concept.units)) {
      for (const f of values) {
        if (f.start === undefined || !isAnnualFact(f)) continue;
        countByEnd.set(f.end, (countByEnd.get(f.end) ?? 0) + 1);
        const first = firstReport.get(f.end);
        if (f.fp === "FY" && (!first || f.filed < first.filed)) firstReport.set(f.end, { filed: f.filed, fy: f.fy });
      }
    }
  }
  const labelOf = (end: string) => {
    const fy = firstReport.get(end)?.fy;
    const endYear = Number(end.slice(0, 4));
    return fy === endYear || fy === endYear - 1 ? fy : fiscalYearOf(end);
  };
  const best = new Map<number, { end: string; count: number }>();
  for (const [end, count] of countByEnd) {
    const fy = labelOf(end);
    const cur = best.get(fy);
    if (!cur || count > cur.count || (count === cur.count && end > cur.end)) best.set(fy, { end, count });
  }
  return [...best]
    .map(([fiscalYear, { end }]) => ({ fiscalYear, end }))
    .sort((a, b) => b.fiscalYear - a.fiscalYear);
}

export type AnnualValue = {
  fiscalYear: number;
  start?: string;
  end: string;
  val: number;
  form: string;
  filed: string;
};

/**
 * 태그 하나의 연간 값: 회계연도 → 값.
 * - 연간 보고서(정정본 포함) 값만, 기간 값은 약 1년짜리만
 * - 기말일이 그 회계연도의 기말일과 같은 값만
 * - 같은 기간에 값이 여럿이면(매년 보고서의 비교 수치, 정정본) filed가 가장 늦은 것
 */
export function annualValues(
  concept: SecConcept | undefined,
  unit: string,
  periods: FiscalPeriod[],
): Map<number, AnnualValue> {
  const yearByEnd = new Map(periods.map((p) => [p.end, p.fiscalYear]));
  const result = new Map<number, AnnualValue>();
  for (const f of concept?.units[unit] ?? []) {
    if (!isAnnualFact(f)) continue;
    const fiscalYear = yearByEnd.get(f.end);
    if (fiscalYear === undefined) continue;
    const cur = result.get(fiscalYear);
    if (cur && cur.filed > f.filed) continue; // 같은 날 제출이면 뒤에 나온 값
    result.set(fiscalYear, { fiscalYear, start: f.start, end: f.end, val: f.val, form: f.form, filed: f.filed });
  }
  return result;
}

export type AnnualContext = {
  taxonomy: Taxonomy;
  currency: string;
  /** 최근 N개 회계연도 (최신순) */
  periods: FiscalPeriod[];
};

/** 분류체계·보고 통화·최근 N개 회계연도. 연간 재무 데이터가 없으면 null */
export function annualContext(cf: SecCompanyFacts, years = 5): AnnualContext | null {
  const taxonomy = primaryTaxonomy(cf);
  const currency = reportingCurrency(cf, taxonomy);
  const periods = fiscalPeriods(cf, taxonomy).slice(0, years);
  if (!currency || !periods.length) return null;
  return { taxonomy, currency, periods };
}

/** 컨텍스트 기준으로 태그 하나의 연간 값. unit을 안 주면 보고 통화 */
export function annualTagValues(
  cf: SecCompanyFacts,
  ctx: AnnualContext,
  tag: string,
  unit: string = ctx.currency,
): Map<number, AnnualValue> {
  return annualValues(cf.facts[ctx.taxonomy]?.[tag], unit, ctx.periods);
}
