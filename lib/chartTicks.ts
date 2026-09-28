export type Ticks = { domain: [number, number]; ticks: number[] };

/** raw 이상인 가장 작은 {1, 2, 2.5, 5} × 10^k */
export function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) {
    // 부동소수 오차로 1 단계 올라가는 것 방지
    if (m * base >= raw * (1 - 1e-9)) return m * base;
  }
  return 10 * base;
}

const range = (min: number, step: number, count: number) =>
  // toPrecision으로 0.30000000000000004 같은 오차 제거, + 0으로 -0 제거
  Array.from({ length: count + 1 }, (_, i) => Number((min + i * step).toPrecision(12)) + 0);

/** 0을 포함하고 약 target칸으로 나눈 깔끔한 눈금 */
export function niceTicks(values: number[], target = 4): Ticks {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  if (min === max) return { domain: [0, 1], ticks: [0, 1] };
  const step = niceStep((max - min) / target);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const count = Math.round((hi - lo) / step);
  return { domain: [lo, hi], ticks: range(lo, step, count) };
}

/**
 * 보조축 눈금을 주축과 같은 칸 수·같은 0선 위치로 맞춘다 (이중축에서 격자선 하나로 두 축을 읽도록).
 * 보조축 값이 0선 아래·위 칸에 모두 들어가는 가장 작은 깔끔한 간격을 고른다.
 */
export function alignedTicks(primary: Ticks, values: number[]): Ticks {
  const n = primary.ticks.length - 1;
  const primaryStep = (primary.domain[1] - primary.domain[0]) / n;
  const below = Math.round(-primary.domain[0] / primaryStep); // 0선 아래 칸 수
  const above = n - below;

  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const need = Math.max(above > 0 ? max / above : max > 0 ? Infinity : 0, below > 0 ? -min / below : min < 0 ? Infinity : 0);
  // 0선 한쪽에 칸이 없는데 값이 그쪽에 있으면 맞출 수 없음 → 독립 눈금
  if (!Number.isFinite(need)) return niceTicks(values, n);

  const step = niceStep(need || 1);
  return { domain: [-below * step + 0, above * step], ticks: range(-below * step, step, n) };
}
