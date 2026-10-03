export type AmountUnit = "eok" | "mil";

export const UNIT_LABEL: Record<AmountUnit, string> = { eok: "억원", mil: "백만원" };
const DIVISOR: Record<AmountUnit, number> = { eok: 1e8, mil: 1e6 };

const intFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

/**
 * 원 단위 금액 → 표시 문자열. 음수는 괄호 표기 "(1,234)".
 * perShare(주당이익 등)는 단위 변환 없이 원 그대로.
 */
export function formatAmount(
  value: number | null,
  unit: AmountUnit,
  perShare = false,
): { text: string; negative: boolean } {
  if (value === null) return { text: "–", negative: false };
  const scaled = Math.round(perShare ? value : value / DIVISOR[unit]);
  // 반올림 결과 0이면 부호 없이 (-0 방지)
  if (scaled === 0) return { text: "0", negative: false };
  const text = intFormat.format(Math.abs(scaled));
  return scaled < 0 ? { text: `(${text})`, negative: true } : { text, negative: false };
}

/** 지표 단위: 비율(%) / 회전(회) / 배수(배) / 일수(일) / 금액(원) */
export type MetricUnit = "percent" | "times" | "multiple" | "days" | "won";

/**
 * 지표 값: percent는 소수(0.131) → "13.1%", times는 "0.62회", multiple은 "3.40배", days는 "45일",
 * won은 "1.2조"·"3,400억" 같은 짧은 금액
 */
export function formatRatio(value: number | null, unit: MetricUnit): string {
  if (value === null) return "–";
  switch (unit) {
    case "percent":
      return `${fixed(value * 100, 1)}%`;
    case "times":
      return `${fixed(value, 2)}회`;
    case "multiple":
      return `${fixed(value, 2)}배`;
    case "days":
      return `${fixed(value, 0)}일`;
    case "won":
      return formatWonCompact(value, 1e11);
  }
}

/**
 * 전년 대비 증감: percent는 %p, times는 회. 부호는 direction으로, text는 절댓값.
 * 표시 자릿수로 반올림해 0이면 flat.
 */
export function formatRatioDelta(
  delta: number | null,
  unit: MetricUnit,
): { direction: "up" | "down" | "flat"; text: string } | null {
  if (delta === null) return null;
  const abs = Math.abs(delta);
  const text =
    unit === "percent"
      ? `${fixed(abs * 100, 1)}%p`
      : unit === "won"
        ? formatWonCompact(abs, 1e11)
        : formatRatio(abs, unit);
  if (/^0(\.0+)?\D*$/.test(text.replace(/,/g, ""))) return { direction: "flat", text: "0" };
  return { direction: delta > 0 ? "up" : "down", text };
}

/**
 * 비교 기간 대비 증감률. 분모는 |비교 기간 값|이라 음수끼리도 "커지면 +".
 * turnaround(손익 항목)면 부호가 바뀔 때 흑자전환·적자전환, 둘 다 음수면 적자지속.
 */
export function formatChange(
  current: number | null,
  prior: number | null,
  turnaround = false,
): { direction: "up" | "down" | "flat" | "none"; text: string } {
  if (current === null || prior === null) return { direction: "none", text: "–" };
  if (turnaround) {
    if (prior < 0 && current > 0) return { direction: "up", text: "흑자전환" };
    if (prior > 0 && current < 0) return { direction: "down", text: "적자전환" };
    if (prior < 0 && current < 0) return { direction: "none", text: "적자지속" };
  }
  if (prior === 0) return { direction: "none", text: "–" };
  const rate = ((current - prior) / Math.abs(prior)) * 100;
  const shown = fixed(Math.abs(rate), 1);
  if (Number(shown.replace(/,/g, "")) === 0) return { direction: "flat", text: "0.0%" };
  return { direction: rate > 0 ? "up" : "down", text: `${shown}%` };
}

/**
 * 차트 축용 짧은 금액: 1조 이상이면 "12조", 아니면 "3,400억". 0은 "0".
 * step이 1조 미만이면 조 단위라도 소수 1자리.
 */
export function formatWonCompact(value: number, step = Infinity): string {
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1e12) {
    const digits = step < 1e12 ? 1 : 0;
    return `${fixed(value / 1e12, digits)}조`;
  }
  return `${intFormat.format(Math.round(value / 1e8))}억`;
}

const fixed = (n: number, digits: number) =>
  new Intl.NumberFormat("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
