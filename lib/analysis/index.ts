import { standingOf, type RatioBenchmark } from "@/lib/benchmark";
import { formatRatio } from "@/lib/format";
import type { StandardAccounts } from "@/lib/normalize";
import { average, computeRatios, RATIOS, safeDiv, type RatioUnit } from "@/lib/ratios";

/**
 * 규칙 기반 재무 진단 — PRD.md "분석" 절과 동일하게 유지할 것.
 * 입력은 표준 계정(연도 오름차순, 표시 연도보다 1년 더)과 선택적 업종 비교.
 */

export type Tone = "positive" | "negative" | "neutral";
export type Grade = "good" | "neutral" | "caution" | "na";
export type AreaKey = "profitability" | "stability" | "growth" | "cashflow";

export const AREA_LABEL: Record<AreaKey, string> = {
  profitability: "수익성",
  stability: "안정성",
  growth: "성장성",
  cashflow: "현금흐름",
};

export type Finding = { tone: Tone; text: string };
export type AreaAssessment = { area: AreaKey; grade: Grade; score: number; findings: Finding[] };

export type DupontYear = {
  year: number;
  /** 당기순이익 ÷ 평균 자본총계 (= 아래 세 값의 곱) */
  roe: number | null;
  netMargin: number | null;
  assetTurnover: number | null;
  /** 평균 자산총계 ÷ 평균 자본총계 */
  leverage: number | null;
};

export type DupontComponent = "netMargin" | "assetTurnover" | "leverage";
export const DUPONT_LABEL: Record<DupontComponent, string> = {
  netMargin: "순이익률",
  assetTurnover: "총자산회전율",
  leverage: "재무레버리지",
};

export type DupontSummary = {
  years: DupontYear[];
  /** 최신 연도 ROE 변화를 가장 크게 설명하는 요소 (세 요소·ROE가 두 해 모두 양수일 때만) */
  driver: { component: DupontComponent; direction: "up" | "down"; roeDelta: number } | null;
};

export type CashFlowPattern = { code: string; label: string; description: string };

export type CashQualityYear = {
  year: number;
  netIncome: number | null;
  operatingCashFlow: number | null;
  investingCashFlow: number | null;
  financingCashFlow: number | null;
  /** 영업활동현금흐름 ÷ 당기순이익 (순이익이 흑자일 때만) */
  cashConversion: number | null;
  /** 유형자산의 취득 (양수로 맞춤) */
  capex: number | null;
  /** 잉여현금흐름 = 영업활동현금흐름 − 유형자산의 취득 */
  fcf: number | null;
  /** FCF ÷ 매출액 */
  fcfMargin: number | null;
  pattern: CashFlowPattern | null;
};

export type Signal = { year: number; tone: Tone; text: string };

export type IndustryPoint = {
  key: string;
  label: string;
  unit: RatioUnit;
  higherIsBetter: boolean;
  value: number;
  median: number;
  topPercent: number;
};

export type Analysis = {
  years: number[];
  latestYear: number;
  areas: AreaAssessment[];
  dupont: DupontSummary;
  cash: CashQualityYear[];
  signals: Signal[];
  industry: { strengths: IndustryPoint[]; weaknesses: IndustryPoint[] } | null;
};

// ── 임계값 ─────────────────────────────────────────────────────────

const T = {
  highOperatingMargin: 0.1,
  highRoe: 0.1,
  highDebtRatio: 2,
  lowDebtRatio: 1,
  lowCurrentRatio: 1,
  highCurrentRatio: 1.5,
  debtRatioJump: 0.5,
  strongRevenueGrowth: 0.1,
  goodRevenueCagr: 0.05,
  revenueSurge: 0.3,
  revenuePlunge: -0.2,
  /** 영업이익증가율 (전기 흑자일 때만 계산됨) */
  profitSurge: 1,
  profitPlunge: -0.5,
  goodCashConversion: 1,
  weakCashConversion: 0.5,
  streak: 3,
} as const;

const pct = (v: number) => formatRatio(v, "percent");
const pp = (v: number) => `${v >= 0 ? "+" : "−"}${formatRatio(Math.abs(v), "percent").replace("%", "%p")}`;

/** 끝에서부터 연속으로 오른(up) 또는 내린(down) 횟수. null을 만나면 멈춘다 */
export function trailingStreak(values: (number | null)[]): { direction: "up" | "down"; count: number } | null {
  let direction: "up" | "down" | null = null;
  let count = 0;
  for (let i = values.length - 1; i > 0; i--) {
    const cur = values[i];
    const prev = values[i - 1];
    if (cur == null || prev == null || cur === prev) break;
    const d = cur > prev ? "up" : "down";
    if (direction && d !== direction) break;
    direction = d;
    count++;
  }
  return direction ? { direction, count } : null;
}

/** 연평균 증가율. 시작·끝이 모두 양수일 때만 */
export function cagr(first: number | null, last: number | null, periods: number): number | null {
  if (first == null || last == null || first <= 0 || last <= 0 || periods <= 0) return null;
  return (last / first) ** (1 / periods) - 1;
}

/** 잉여현금흐름 = 영업활동현금흐름 − |유형자산의 취득| (회사마다 취득 부호가 달라 절댓값) */
export function freeCashFlow(ocf: number | null, capex: number | null): number | null {
  if (ocf == null || capex == null) return null;
  return ocf - Math.abs(capex);
}

/** 영업·투자·재무 현금흐름 부호로 본 현금흐름 유형 (0은 +로 본다) */
export function cashFlowPattern(ocf: number | null, icf: number | null, fcf: number | null): CashFlowPattern | null {
  if (ocf == null || icf == null || fcf == null) return null;
  const code = [ocf, icf, fcf].map((v) => (v >= 0 ? "+" : "-")).join("");
  return { code, ...PATTERNS[code] };
}

const PATTERNS: Record<string, { label: string; description: string }> = {
  "+--": { label: "안정 운영형", description: "영업으로 번 현금으로 투자하고 차입금 상환·배당까지 합니다." },
  "+-+": { label: "성장 투자형", description: "영업현금에 외부 조달을 더해 적극적으로 투자합니다." },
  "++-": { label: "구조 조정형", description: "자산을 팔아 생긴 현금으로 부채를 갚거나 주주에게 돌려줍니다." },
  "+++": { label: "현금 축적형", description: "영업·자산 매각·조달 모두에서 현금이 들어와 쌓이고 있습니다." },
  "--+": { label: "외부 조달 의존형", description: "영업에서 현금이 나가는데 차입·증자로 투자를 이어갑니다." },
  "-++": { label: "자금 압박형", description: "영업 적자를 자산 매각과 외부 조달로 메우고 있습니다." },
  "-+-": { label: "자산 매각형", description: "영업 적자 속에 자산을 팔아 부채를 갚고 있습니다." },
  "---": { label: "현금 소진형", description: "보유 현금을 쓰며 영업·투자·상환을 감당하고 있습니다." },
};

type Scored = Finding & { weight: number };
const add = (list: Scored[], weight: number, text: string) =>
  list.push({ weight, text, tone: weight > 0 ? "positive" : weight < 0 ? "negative" : "neutral" });

function grade(findings: Scored[], hasData: boolean): AreaAssessment["grade"] {
  if (!hasData) return "na";
  const score = findings.reduce((s, f) => s + f.weight, 0);
  return score >= 2 ? "good" : score <= -1 ? "caution" : "neutral";
}

function industryFinding(
  list: Scored[],
  benchmark: Record<string, RatioBenchmark | null> | null | undefined,
  key: string,
) {
  const b = benchmark?.[key];
  if (!b || b.topPercent == null) return;
  const def = RATIOS.find((r) => r.key === key)!;
  const standing = standingOf(b.topPercent);
  if (standing === "top") add(list, 1, `${def.label} 업종 상위 ${b.topPercent}%`);
  if (standing === "bottom") add(list, -1, `${def.label} 업종 하위권 (상위 ${b.topPercent}%)`);
}

/**
 * 표준 계정 → 진단 결과.
 * @param standard 연도 오름차순. 첫 표시 연도의 평균·증가율을 위해 displayYears + 1개를 넘기는 게 좋다
 * @param benchmark 최신 연도 업종 비교 (없으면 업종 관련 판단만 빠진다)
 */
export function analyze(
  standard: StandardAccounts[],
  benchmark?: Record<string, RatioBenchmark | null> | null,
  displayYears = 5,
): Analysis {
  const sorted = [...standard].sort((a, b) => a.year - b.year);
  const ratioYears = computeRatios(sorted);
  const shown = sorted.slice(-displayYears);
  const years = shown.map((y) => y.year);
  const latestYear = years[years.length - 1];
  const byYear = new Map(sorted.map((y) => [y.year, y]));
  const ratioByYear = new Map(ratioYears.map((r) => [r.year, r.values]));
  const ratio = (year: number, key: string) => ratioByYear.get(year)?.[key] ?? null;
  const acc = (year: number, key: keyof Omit<StandardAccounts, "year">) => byYear.get(year)?.[key] ?? null;
  /** 연속 추세는 계산 가능한 모든 연도(표시 연도 + 1)로 본다 */
  const ratioSeries = (key: string) => ratioYears.map((r) => r.values[key] ?? null);
  const accSeries = (key: keyof Omit<StandardAccounts, "year">) => sorted.map((y) => y[key]);

  const L = latestYear;

  // ── 수익성 ──
  const profit: Scored[] = [];
  const opIncome = acc(L, "operatingIncome");
  const opMargin = ratio(L, "operatingMargin");
  const roe = ratio(L, "roe");
  if (opIncome != null && opIncome < 0) add(profit, -2, `영업손실${opMargin != null ? ` (영업이익률 ${pct(opMargin)})` : ""}`);
  else if (opMargin != null && opMargin >= T.highOperatingMargin) add(profit, 1, `영업이익률 ${pct(opMargin)}로 10% 이상`);
  if (roe != null && roe >= T.highRoe) add(profit, 1, `ROE ${pct(roe)}로 10% 이상`);
  else if (roe != null && roe < 0) add(profit, -1, `ROE ${pct(roe)} — 순손실`);
  const marginStreak = trailingStreak(ratioSeries("operatingMargin"));
  if (marginStreak && marginStreak.count >= T.streak)
    add(profit, marginStreak.direction === "up" ? 1 : -1, `영업이익률 ${marginStreak.count}년 연속 ${marginStreak.direction === "up" ? "상승" : "하락"}`);
  industryFinding(profit, benchmark, "operatingMargin");
  industryFinding(profit, benchmark, "roe");

  // ── 안정성 ──
  const stab: Scored[] = [];
  const equity = acc(L, "totalEquity");
  const debtRatio = ratio(L, "debtRatio");
  const currentRatio = ratio(L, "currentRatio");
  if (equity != null && equity <= 0) add(stab, -3, "완전자본잠식 — 자본총계가 0 이하");
  else if (debtRatio != null && debtRatio > T.highDebtRatio) add(stab, -2, `부채비율 ${pct(debtRatio)}로 200% 초과`);
  else if (debtRatio != null && debtRatio <= T.lowDebtRatio) add(stab, 1, `부채비율 ${pct(debtRatio)}로 100% 이하`);
  if (currentRatio != null && currentRatio < T.lowCurrentRatio)
    add(stab, -1, `유동비율 ${pct(currentRatio)} — 1년 안에 갚을 부채가 유동자산보다 많음`);
  else if (currentRatio != null && currentRatio >= T.highCurrentRatio) add(stab, 1, `유동비율 ${pct(currentRatio)}로 단기 지급 여력 충분`);
  const prevDebtRatio = ratio(L - 1, "debtRatio");
  if (debtRatio != null && prevDebtRatio != null && debtRatio - prevDebtRatio >= T.debtRatioJump)
    add(stab, -1, `부채비율 전년 대비 ${pp(debtRatio - prevDebtRatio)} 급등`);
  industryFinding(stab, benchmark, "debtRatio");

  // ── 성장성 ──
  const grow: Scored[] = [];
  const revGrowth = ratio(L, "revenueGrowth");
  if (revGrowth != null && revGrowth >= T.strongRevenueGrowth) add(grow, 1, `매출 전년 대비 ${pct(revGrowth)} 증가`);
  else if (revGrowth != null && revGrowth < 0) add(grow, -1, `매출 전년 대비 ${pct(Math.abs(revGrowth))} 감소`);
  const firstShown = shown[0];
  const revCagr = cagr(firstShown?.revenue ?? null, acc(L, "revenue"), years.length - 1);
  if (revCagr != null && revCagr >= T.goodRevenueCagr) add(grow, 1, `${years.length - 1}년 연평균 매출 성장 ${pct(revCagr)}`);
  else if (revCagr != null && revCagr < 0) add(grow, -1, `${years.length - 1}년 연평균 매출 ${pct(Math.abs(revCagr))} 감소`);
  const revStreak = trailingStreak(accSeries("revenue"));
  if (revStreak && revStreak.count >= T.streak)
    add(grow, revStreak.direction === "up" ? 1 : -1, `매출 ${revStreak.count}년 연속 ${revStreak.direction === "up" ? "증가" : "감소"}`);
  industryFinding(grow, benchmark, "revenueGrowth");

  // ── 현금흐름 ──
  const cashF: Scored[] = [];
  const ocf = acc(L, "operatingCashFlow");
  const ni = acc(L, "netIncome");
  if (ocf != null && ocf < 0) add(cashF, -2, `영업활동현금흐름 마이너스${ni != null && ni > 0 ? " — 순이익은 흑자" : ""}`);
  const conversion = ocf != null && ocf > 0 ? safeDiv(ocf, ni) : null;
  if (conversion != null && conversion >= T.goodCashConversion)
    add(cashF, 1, `영업현금흐름이 순이익의 ${formatRatio(conversion, "times").replace("회", "배")} — 이익이 현금으로 들어옴`);
  else if (conversion != null && conversion < T.weakCashConversion)
    add(cashF, -1, `영업현금흐름이 순이익의 ${pct(conversion)}에 그침`);
  const ocfShown = shown.map((y) => y.operatingCashFlow).filter((v): v is number => v != null);
  const negativeOcfYears = ocfShown.filter((v) => v < 0).length;
  if (ocfShown.length >= 3 && negativeOcfYears === 0) add(cashF, 1, `${ocfShown.length}년 모두 영업현금흐름 플러스`);
  else if (negativeOcfYears >= 2) add(cashF, -1, `${ocfShown.length}년 중 ${negativeOcfYears}년 영업현금흐름 마이너스`);

  const areas: AreaAssessment[] = (
    [
      ["profitability", profit, opMargin != null || roe != null || opIncome != null],
      ["stability", stab, debtRatio != null || currentRatio != null || equity != null],
      ["growth", grow, revGrowth != null || revCagr != null],
      ["cashflow", cashF, ocf != null],
    ] as const
  ).map(([area, list, hasData]) => ({
    area,
    grade: grade(list, hasData),
    score: list.reduce((s, f) => s + f.weight, 0),
    findings: list.map(({ tone, text }) => ({ tone, text })),
  }));

  return {
    years,
    latestYear,
    areas,
    dupont: dupont(sorted, years),
    cash: shown.map((y) => {
      const fcf = freeCashFlow(y.operatingCashFlow, y.capex);
      return {
        year: y.year,
        netIncome: y.netIncome,
        operatingCashFlow: y.operatingCashFlow,
        investingCashFlow: y.investingCashFlow,
        financingCashFlow: y.financingCashFlow,
        cashConversion: y.operatingCashFlow != null && y.netIncome != null && y.netIncome > 0 ? y.operatingCashFlow / y.netIncome : null,
        capex: y.capex == null ? null : Math.abs(y.capex),
        fcf,
        fcfMargin: safeDiv(fcf, y.revenue),
        pattern: cashFlowPattern(y.operatingCashFlow, y.investingCashFlow, y.financingCashFlow),
      };
    }),
    signals: signals(sorted, ratioByYear, years),
    industry: benchmark ? industryPoints(benchmark) : null,
  };
}

/** ROE = 순이익률 × 총자산회전율 × 재무레버리지 (모두 당기순이익·평균 자본총계 기준이라 곱이 정확히 ROE) */
function dupont(sorted: StandardAccounts[], years: number[]): DupontSummary {
  const byYear = new Map(sorted.map((y) => [y.year, y]));
  const rows: DupontYear[] = years.map((year) => {
    const cur = byYear.get(year)!;
    const prev = byYear.get(year - 1);
    const avgAssets = average(cur.totalAssets, prev?.totalAssets);
    const avgEquity = average(cur.totalEquity, prev?.totalEquity);
    return {
      year,
      roe: safeDiv(cur.netIncome, avgEquity),
      netMargin: safeDiv(cur.netIncome, cur.revenue),
      assetTurnover: safeDiv(cur.revenue, avgAssets),
      leverage: safeDiv(avgAssets, avgEquity),
    };
  });

  const [a, b] = rows.slice(-2);
  let driver: DupontSummary["driver"] = null;
  const comps: DupontComponent[] = ["netMargin", "assetTurnover", "leverage"];
  if (a && b && a.roe != null && b.roe != null && comps.every((c) => (a[c] ?? 0) > 0 && (b[c] ?? 0) > 0)) {
    // 로그 변화량으로 ROE 변화를 세 요소에 나눈다: ln(ROE1/ROE0) = Σ ln(요소1/요소0)
    const contributions = comps.map((c) => ({ c, d: Math.log(b[c]! / a[c]!) }));
    const top = contributions.reduce((m, x) => (Math.abs(x.d) > Math.abs(m.d) ? x : m));
    if (top.d !== 0) driver = { component: top.c, direction: top.d > 0 ? "up" : "down", roeDelta: b.roe - a.roe };
  }
  return { years: rows, driver };
}

function signals(sorted: StandardAccounts[], ratioByYear: Map<number, Record<string, number | null>>, years: number[]): Signal[] {
  const byYear = new Map(sorted.map((y) => [y.year, y]));
  const out: Signal[] = [];
  const none: Record<string, number | null> = {};
  const turn =(year: number, label: string, cur: number | null, prev: number | null) => {
    if (cur == null || prev == null) return;
    if (prev < 0 && cur > 0) out.push({ year, tone: "positive", text: `${label} 흑자전환` });
    if (prev > 0 && cur < 0) out.push({ year, tone: "negative", text: `${label} 적자전환` });
  };

  for (const year of years) {
    const cur = byYear.get(year)!;
    const prev = byYear.get(year - 1);
    const r = ratioByYear.get(year) ?? none;
    const pr = ratioByYear.get(year - 1) ?? none;
    turn(year, "영업이익", cur.operatingIncome, prev?.operatingIncome ?? null);
    turn(year, "당기순이익", cur.netIncome, prev?.netIncome ?? null);
    if (r.revenueGrowth != null && r.revenueGrowth >= T.revenueSurge)
      out.push({ year, tone: "positive", text: `매출 급성장 (${pct(r.revenueGrowth)})` });
    if (r.revenueGrowth != null && r.revenueGrowth <= T.revenuePlunge)
      out.push({ year, tone: "negative", text: `매출 급감 (${pct(r.revenueGrowth)})` });
    if (r.operatingIncomeGrowth != null && r.operatingIncomeGrowth >= T.profitSurge)
      out.push({ year, tone: "positive", text: `영업이익 급증 (${pct(r.operatingIncomeGrowth)})` });
    if (r.operatingIncomeGrowth != null && r.operatingIncomeGrowth <= T.profitPlunge)
      out.push({ year, tone: "negative", text: `영업이익 급감 (${pct(r.operatingIncomeGrowth)})` });
    if (r.debtRatio != null && pr.debtRatio != null && r.debtRatio - pr.debtRatio >= T.debtRatioJump)
      out.push({ year, tone: "negative", text: `부채비율 급등 (${pp(r.debtRatio - pr.debtRatio)} → ${pct(r.debtRatio)})` });
    if (cur.totalEquity != null && cur.totalEquity <= 0) out.push({ year, tone: "negative", text: "완전자본잠식" });
    if (cur.operatingCashFlow != null && cur.operatingCashFlow < 0)
      out.push({
        year,
        tone: "negative",
        text: cur.netIncome != null && cur.netIncome > 0 ? "순이익 흑자인데 영업현금흐름 마이너스" : "영업현금흐름 마이너스",
      });
  }

  // 최신 연도에서 끝나는 연속 추세
  const latest = years[years.length - 1];
  const ratioSeries = (key: string) => sorted.map((y) => ratioByYear.get(y.year)?.[key] ?? null);
  const streaks: [string, (number | null)[], boolean, [string, string]][] = [
    ["매출", sorted.map((y) => y.revenue), true, ["증가", "감소"]],
    ["영업이익률", ratioSeries("operatingMargin"), true, ["상승", "하락"]],
    ["부채비율", ratioSeries("debtRatio"), false, ["상승", "하락"]],
  ];
  for (const [label, values, higherIsBetter, [upWord, downWord]] of streaks) {
    const s = trailingStreak(values);
    if (!s || s.count < T.streak) continue;
    const good = (s.direction === "up") === higherIsBetter;
    out.push({ year: latest, tone: good ? "positive" : "negative", text: `${label} ${s.count}년 연속 ${s.direction === "up" ? upWord : downWord}` });
  }

  // 최신 연도부터, 같은 해 안에서는 부정 신호 먼저
  const toneOrder: Record<Tone, number> = { negative: 0, positive: 1, neutral: 2 };
  return out.sort((a, b) => b.year - a.year || toneOrder[a.tone] - toneOrder[b.tone]);
}

function industryPoints(benchmark: Record<string, RatioBenchmark | null>) {
  const points: IndustryPoint[] = [];
  for (const [key, b] of Object.entries(benchmark)) {
    if (!b || b.value == null || b.topPercent == null) continue;
    const def = RATIOS.find((r) => r.key === key);
    if (!def) continue;
    points.push({ key, label: def.label, unit: def.unit, higherIsBetter: def.higherIsBetter, value: b.value, median: b.median, topPercent: b.topPercent });
  }
  return {
    strengths: points.filter((p) => standingOf(p.topPercent) === "top").sort((a, b) => a.topPercent - b.topPercent),
    weaknesses: points.filter((p) => standingOf(p.topPercent) === "bottom").sort((a, b) => b.topPercent - a.topPercent),
  };
}
