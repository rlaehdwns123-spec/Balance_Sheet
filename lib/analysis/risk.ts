import { formatRatio, formatWonCompact } from "@/lib/format";
import type { StandardAccounts } from "@/lib/normalize";
import { computeRatios, growthRate, interestBasis } from "@/lib/ratios";

/**
 * 위험 신호 점검 — PRD.md "위험 신호 점검" 절과 동일하게 유지할 것.
 * 최신 사업연도 기준. 참고용 지표이며 투자 판단의 근거가 아니다.
 */

/** 해당 / 해당 없음 / 판단에 필요한 항목이 없어 확인 불가 */
export type RiskStatus = "hit" | "clear" | "na";

export type RiskCheck = {
  key: string;
  /** 점검 항목 이름 */
  label: string;
  status: RiskStatus;
  /** 해당(hit)일 때 배지 문구 (예: "부분자본잠식") */
  badge: string | null;
  /** 판단 근거 수치 */
  evidence: string | null;
};

/** 최신 사업연도 감사의견. 불러오지 못하면 null */
export type AuditInput = { year: number; opinion: string; auditor: string } | null;

const T = {
  lossYears: 2,
  interestCoverage: 1,
  debtRatio: 2,
  currentRatio: 1,
  /** 매출채권 증가율 − 매출액 증가율 */
  receivableGap: 0.2,
} as const;

const defaultMoney = (v: number) => formatWonCompact(v, 1e11);
const pct = (v: number) => formatRatio(v, "percent");
const pp = (v: number) => formatRatio(v, "percent").replace("%", "%p");

/** 감사의견이 적정인지 ("적정의견"·"적정"). "부적정"은 적정이 아님 */
export const isCleanOpinion = (opinion: string) => opinion.replace(/\s/g, "").startsWith("적정");

/**
 * @param standard 연도 오름차순 표준 계정 (증가율·연속 적자를 위해 이전 연도 포함)
 * @param audit 최신 연도 감사의견 (없으면 감사의견 항목은 확인 불가)
 * @param options.money 근거 수치의 금액 표기 (기본: "3,400억" 원화 표기, 미국 기업은 통화를 붙인다)
 * @param options.skip 점검하지 않을 항목 (미국 기업의 감사의견 등)
 */
export function riskChecks(
  standard: StandardAccounts[],
  audit: AuditInput,
  options: { money?: (v: number) => string; skip?: string[] } = {},
): RiskCheck[] {
  const won = options.money ?? defaultMoney;
  const sorted = [...standard].sort((a, b) => a.year - b.year);
  const cur = sorted.at(-1);
  if (!cur) return [];
  const prev = sorted.find((y) => y.year === cur.year - 1) ?? null;
  const ratios = computeRatios(sorted).at(-1)?.values ?? {};
  const checks: RiskCheck[] = [];
  const push = (key: string, label: string, status: RiskStatus, badge: string, evidence: string | null = null) =>
    checks.push({ key, label, status, badge: status === "hit" ? badge : null, evidence });

  // 영업적자 연속 (최신 연도부터 거꾸로, 연도가 끊기면 멈춤)
  {
    const label = "영업적자 2년 이상 연속";
    const losses: StandardAccounts[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const y = sorted[i];
      if (y.year !== cur.year - losses.length || y.operatingIncome == null || y.operatingIncome >= 0) break;
      losses.push(y);
    }
    if (cur.operatingIncome == null) push("operatingLoss", label, "na", "");
    else if (losses.length >= T.lossYears)
      push(
        "operatingLoss",
        label,
        "hit",
        `영업적자 ${losses.length}년 연속`,
        losses
          .reverse()
          .map((y) => `${y.year}년 ${won(y.operatingIncome!)}`)
          .join(" · "),
      );
    else push("operatingLoss", label, "clear", "", `${cur.year}년 영업이익 ${won(cur.operatingIncome)}`);
  }

  // 자본잠식: 자본총계 < 0 완전, 자본총계 < 자본금 부분
  {
    const label = "자본잠식";
    const equity = cur.totalEquity;
    const capital = cur.issuedCapital;
    if (equity == null) push("impairment", label, "na", "");
    else if (equity < 0) push("impairment", label, "hit", "완전자본잠식", `자본총계 ${won(equity)}`);
    else if (capital == null) push("impairment", label, "na", "", "자본금 항목을 찾지 못했습니다");
    else if (equity < capital)
      push(
        "impairment",
        label,
        "hit",
        "부분자본잠식",
        `자본총계 ${won(equity)} < 자본금 ${won(capital)} (잠식률 ${pct((capital - equity) / capital)})`,
      );
    else push("impairment", label, "clear", "", `자본총계 ${won(equity)} ≥ 자본금 ${won(capital)}`);
  }

  // 이자보상배율
  {
    const label = "이자보상배율 1배 미만";
    const coverage = ratios.interestCoverage ?? null;
    const basis = interestBasis(cur);
    if (coverage == null || cur.operatingIncome == null || basis.value == null) push("interestCoverage", label, "na", "");
    else
      push(
        "interestCoverage",
        label,
        coverage < T.interestCoverage ? "hit" : "clear",
        "이자보상배율 1배 미만",
        `${formatRatio(coverage, "multiple")} = 영업이익 ${won(cur.operatingIncome)} ÷ ${
          basis.proxy ? "금융비용(이자비용 대용)" : "이자비용"
        } ${won(basis.value)}`,
      );
  }

  // 순이익 흑자 + 영업현금흐름 적자
  {
    const label = "순이익 흑자인데 영업현금흐름 적자";
    const ni = cur.netIncome;
    const ocf = cur.operatingCashFlow;
    if (ni == null || ocf == null) push("cashGap", label, "na", "");
    else
      push(
        "cashGap",
        label,
        ni > 0 && ocf < 0 ? "hit" : "clear",
        "흑자인데 영업현금 유출",
        `당기순이익 ${won(ni)} · 영업활동현금흐름 ${won(ocf)}`,
      );
  }

  // 부채비율 (자본총계가 0 이하면 비율을 못 내지만 위험은 더 크다)
  {
    const label = "부채비율 200% 초과";
    const debtRatio = ratios.debtRatio ?? null;
    if (cur.totalEquity != null && cur.totalEquity <= 0 && cur.totalLiabilities != null)
      push(
        "debtRatio",
        label,
        "hit",
        "부채비율 산정 불가(자본잠식)",
        `부채총계 ${won(cur.totalLiabilities)} · 자본총계 ${won(cur.totalEquity)}`,
      );
    else if (debtRatio == null) push("debtRatio", label, "na", "");
    else push("debtRatio", label, debtRatio > T.debtRatio ? "hit" : "clear", "부채비율 200% 초과", `부채비율 ${pct(debtRatio)}`);
  }

  // 유동비율
  {
    const label = "유동비율 100% 미만";
    const currentRatio = ratios.currentRatio ?? null;
    if (currentRatio == null) push("currentRatio", label, "na", "");
    else
      push(
        "currentRatio",
        label,
        currentRatio < T.currentRatio ? "hit" : "clear",
        "유동비율 100% 미만",
        `유동비율 ${pct(currentRatio)}`,
      );
  }

  // 매출채권이 매출보다 빠르게 증가
  {
    const label = "매출채권 증가율이 매출 증가율보다 20%p 이상 높음";
    const recGrowth = growthRate(cur.receivables, prev?.receivables);
    const revGrowth = growthRate(cur.revenue, prev?.revenue);
    if (recGrowth == null || revGrowth == null) push("receivables", label, "na", "");
    else {
      const gap = recGrowth - revGrowth;
      push(
        "receivables",
        label,
        gap >= T.receivableGap ? "hit" : "clear",
        "매출채권 급증",
        `매출채권 ${pct(recGrowth)} vs 매출 ${pct(revGrowth)} (차이 ${gap >= 0 ? "+" : "−"}${pp(Math.abs(gap))})`,
      );
    }
  }

  // 감사의견
  {
    const label = "감사의견 적정 아님";
    if (!audit) push("audit", label, "na", "");
    else
      push(
        "audit",
        label,
        isCleanOpinion(audit.opinion) ? "clear" : "hit",
        `감사의견 ${audit.opinion}`,
        `${audit.year}년 ${audit.opinion}${audit.auditor ? ` · ${audit.auditor}` : ""}`,
      );
  }

  return options.skip ? checks.filter((c) => !options.skip!.includes(c.key)) : checks;
}
