import type { InterimCode } from "@/lib/dart/types";

/** 보고서 코드 → 분기 번호 (1분기·반기·3분기) */
export const QUARTER_OF: Record<InterimCode, 1 | 2 | 3> = { "11013": 1, "11012": 2, "11014": 3 };
const CODE_OF = { 1: "11013", 2: "11012", 3: "11014" } as const satisfies Record<1 | 2 | 3, InterimCode>;

export const INTERIM_NAME: Record<InterimCode, string> = { "11013": "1분기", "11012": "반기", "11014": "3분기" };

export type InterimRef = { year: number; code: InterimCode };

/**
 * 한 분기·반기 보고서 바로 앞의 보고서들(사업보고서 제외), 최신순.
 * 2026 반기 → 2026 1분기, 2025 3분기, 2025 반기 …
 */
export function previousInterims(ref: InterimRef, count: number): InterimRef[] {
  const out: InterimRef[] = [];
  let year = ref.year;
  let q: number = QUARTER_OF[ref.code];
  while (out.length < count) {
    q -= 1;
    if (q === 0) {
      q = 3;
      year -= 1;
    }
    out.push({ year, code: CODE_OF[q as 1 | 2 | 3] });
  }
  return out;
}

/**
 * 최신 분기·반기 보고서 후보(최신순). 12월 결산 기준으로 분기가 끝난 보고서만 넣는다
 * (분기 종료 후 45일 안에 공시되므로 첫 후보가 아직 없을 수 있다).
 */
export function interimCandidates(now: Date, count = 4): InterimRef[] {
  const year = now.getFullYear();
  const ended = ([1, 2, 3] as const).filter((q) => new Date(year, q * 3, 1) <= now);
  const first: InterimRef = ended.length
    ? { year, code: CODE_OF[ended[ended.length - 1]] }
    : { year: year - 1, code: "11014" };
  return [first, ...previousInterims(first, count - 1)];
}
