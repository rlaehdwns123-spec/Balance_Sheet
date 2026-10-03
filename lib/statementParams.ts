import type { FsDiv, InterimCode } from "@/lib/dart/types";
import type { AmountUnit } from "@/lib/format";
import type { StatementKind } from "@/lib/normalize/statement";

/** 기간: 연간(사업보고서 5개년) / 분기(분기·반기 보고서 전년 동기 비교) */
export type Period = "A" | "Q";
/** 손익계산서 보기: IFRS 18 범주 / 기존 K-IFRS 양식 */
export type IncomeView = "ifrs18" | "classic";
/** 분기 손익 기준: 해당 분기 3개월 / 연초부터 누적 */
export type IncomeBasis = "q" | "cum";
/** 값 표시: 금액 / 공통형 비중(손익은 매출액, 재무상태는 자산총계 대비 %) */
export type ValueView = "amt" | "pct";
/** 계정명 표시(미국 기업): SEC 원문 + 한글 병기 / 원문만 */
export type LabelView = "both" | "en";

/**
 * 재무제표 화면 URL 쿼리
 * - 데이터가 바뀌는 값(서버): fs=CFS|OFS, pd=A|Q, q=2026-11012 (분기 보고서 지정, 없으면 최신)
 * - 표시만 바뀌는 값(클라이언트): sj=BS|IS|CF, unit=eok|mil, isv=ifrs18|classic, acc=q|cum, vw=amt|pct, lbl=both|en
 * pd=Q(분기·반기 보고서 재무제표)는 분기 탭의 "보고서별 재무제표" 보기에서 쓴다.
 */
export type StatementParams = {
  fs: FsDiv;
  sj: StatementKind;
  unit: AmountUnit;
  pd: Period;
  q: string | null;
  isv: IncomeView;
  acc: IncomeBasis;
  vw: ValueView;
  lbl: LabelView;
};

export function parseStatementParams(get: (key: string) => string | null | undefined): StatementParams {
  const sj = get("sj");
  const q = get("q");
  return {
    fs: get("fs") === "OFS" ? "OFS" : "CFS",
    sj: sj === "IS" || sj === "CF" ? sj : "BS",
    unit: get("unit") === "mil" ? "mil" : "eok",
    pd: get("pd") === "Q" ? "Q" : "A",
    q: q && parseInterimKey(q) ? q : null,
    isv: get("isv") === "classic" ? "classic" : "ifrs18",
    acc: get("acc") === "cum" ? "cum" : "q",
    vw: get("vw") === "pct" ? "pct" : "amt",
    lbl: get("lbl") === "en" ? "en" : "both",
  };
}

/** "2026-11012" → { year: 2026, code: "11012" } */
export function parseInterimKey(key: string): { year: number; code: InterimCode } | null {
  const m = /^(\d{4})-(11013|11012|11014)$/.exec(key);
  return m ? { year: Number(m[1]), code: m[2] as InterimCode } : null;
}

export const interimKey = (year: number, code: InterimCode) => `${year}-${code}`;
