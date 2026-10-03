import type { AuditOpinionRow, DisclosureRow, DividendRow, FsDiv } from "@/lib/dart/types";
import { parseAmount } from "@/lib/normalize/parse";

/**
 * 배당·감사의견·공시목록 응답 정리 — PRD.md "배당·공시" 절과 동일하게 유지할 것.
 * 배당(alotMatter)·감사의견(accnutAdtorNmNdAdtOpinion)은 사업보고서 1건에 당기·전기·전전기가 들어 있다.
 */

// ── 배당 ───────────────────────────────────────────────────────────

export type DividendUnit = "won" | "percent";
export type DividendItem = {
  key: string;
  label: string;
  unit: DividendUnit;
  /** years와 같은 순서 (당기, 전기, 전전기). percent는 소수(0.251 = 25.1%), won은 원 */
  values: (number | null)[];
};
export type DividendSummary = { years: number[]; items: DividendItem[] };

/** 결산일 "2025-12-31" → 2025 */
const yearOf = (stlmDt: string | undefined) => {
  const m = /^(\d{4})/.exec(stlmDt ?? "");
  return m ? Number(m[1]) : null;
};

const squash = (s: string) => s.replace(/\s+/g, "");

/**
 * 배당 항목 고르기: 주당 현금배당금·현금배당성향·현금배당수익률·현금배당금총액.
 * 배당성향은 (연결)/(별도) 두 줄이 있을 수 있어 재무제표 구분에 맞는 쪽을 먼저 쓴다.
 */
export function parseDividends(rows: DividendRow[], fs: FsDiv): DividendSummary | null {
  const year = yearOf(rows.find((r) => r.stlm_dt)?.stlm_dt);
  if (year == null || rows.length === 0) return null;
  const years = [year, year - 1, year - 2];
  const valuesOf = (r: DividendRow) => [r.thstrm, r.frmtrm, r.lwfr].map(parseAmount);
  const find = (pattern: RegExp, stock?: string) =>
    rows.filter((r) => pattern.test(squash(r.se)) && (stock === undefined || squash(r.stock_knd ?? "") === stock));
  const preferFs = (list: DividendRow[]) => {
    const tag = fs === "CFS" ? "(연결)" : "(별도)";
    return list.find((r) => squash(r.se).startsWith(tag)) ?? list[0];
  };

  const items: DividendItem[] = [];
  const push = (key: string, label: string, unit: DividendUnit, row: DividendRow | undefined, scale = 1) => {
    if (!row) return;
    const values = valuesOf(row).map((v) => (v == null ? null : unit === "percent" ? v / 100 : v * scale));
    if (values.some((v) => v != null)) items.push({ key, label, unit, values });
  };

  push("dpsCommon", "주당 현금배당금 (보통주)", "won", find(/^주당현금배당금/, "보통주")[0]);
  push("dpsPreferred", "주당 현금배당금 (우선주)", "won", find(/^주당현금배당금/, "우선주")[0]);
  push("payout", "현금배당성향", "percent", preferFs(find(/현금배당성향/)));
  push("yieldCommon", "현금배당수익률 (보통주)", "percent", find(/^현금배당수익률/, "보통주")[0]);
  push("yieldPreferred", "현금배당수익률 (우선주)", "percent", find(/^현금배당수익률/, "우선주")[0]);
  push("total", "현금배당금총액", "won", find(/^현금배당금총액/)[0], 1e6);

  return { years, items };
}

// ── 감사의견 ───────────────────────────────────────────────────────

export type AuditOpinion = {
  year: number;
  auditor: string;
  opinion: string;
  /** 강조사항 */
  emphasis: string | null;
  /** 핵심감사사항 */
  keyMatters: string | null;
  /** 감사보고서 특기사항 */
  special: string | null;
};

/** "-", "해당사항 없음" 같은 빈 값은 null */
const meaningful = (s: string | undefined) => {
  const t = (s ?? "").trim();
  return !t || /^(-|해당\s*사항\s*없음|없음|해당없음)$/.test(t) ? null : t;
};

const PERIOD_OFFSET: Record<string, number> = { 당기: 0, 전기: 1, 전전기: 2 };

/** 서로 다른 내용만 줄바꿈으로 이어 붙인다 */
const joinDistinct = (a: string | null, b: string | null) => (!a ? b : !b || a === b ? a : `${a}\n${b}`);

/**
 * 감사의견 행 → 연도별 (최신순). bsns_year는 "제57기 (당기)" 형식이라 결산일 연도에서 당기·전기·전전기를 뺀다.
 * 연결·별도 감사가 한 해에 두 줄씩 오는 경우가 많아, 같은 연도·감사인·의견은 하나로 합치고
 * 다른 강조사항·핵심감사사항(보통 "(연결재무제표) …"처럼 구분돼 있음)은 이어 붙인다.
 */
export function parseAuditOpinions(rows: AuditOpinionRow[]): AuditOpinion[] {
  const byKey = new Map<string, AuditOpinion>();
  for (const r of rows) {
    const base = yearOf(r.stlm_dt);
    const period = /\((전전기|전기|당기)\)/.exec(squash(r.bsns_year))?.[1];
    if (base == null || !period || !meaningful(r.adt_opinion)) continue;
    const item: AuditOpinion = {
      year: base - PERIOD_OFFSET[period],
      auditor: (r.adtor ?? "").trim(),
      opinion: r.adt_opinion.trim(),
      emphasis: meaningful(r.emphs_matter),
      keyMatters: meaningful(r.core_adt_matter),
      special: meaningful(r.adt_reprt_spcmnt_matter),
    };
    const key = `${item.year}|${item.auditor}|${item.opinion}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, item);
    else {
      prev.emphasis = joinDistinct(prev.emphasis, item.emphasis);
      prev.keyMatters = joinDistinct(prev.keyMatters, item.keyMatters);
      prev.special = joinDistinct(prev.special, item.special);
    }
  }
  return [...byKey.values()].sort((a, b) => b.year - a.year);
}

// ── 공시 목록 ──────────────────────────────────────────────────────

/** 공시유형 (pblntf_ty) */
export const DISCLOSURE_TYPES = [
  { value: "A", label: "정기공시" },
  { value: "B", label: "주요사항" },
  { value: "C", label: "발행공시" },
  { value: "D", label: "지분공시" },
  { value: "E", label: "기타공시" },
  { value: "F", label: "외부감사" },
  { value: "I", label: "거래소공시" },
] as const;
export type DisclosureType = (typeof DISCLOSURE_TYPES)[number]["value"];

export const parseDisclosureType = (v: string | null | undefined): DisclosureType | null =>
  DISCLOSURE_TYPES.find((t) => t.value === v)?.value ?? null;

export type Disclosure = {
  rceptNo: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  filer: string;
  /** 비고(rm)에 "정"이 있으면 정정 공시 */
  corrected: boolean;
  url: string;
};

export const dartViewerUrl = (rceptNo: string) => `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`;

export function parseDisclosures(rows: DisclosureRow[]): Disclosure[] {
  return rows.map((r) => ({
    rceptNo: r.rcept_no,
    title: r.report_nm.replace(/\s+/g, " ").trim(),
    date: `${r.rcept_dt.slice(0, 4)}-${r.rcept_dt.slice(4, 6)}-${r.rcept_dt.slice(6, 8)}`,
    filer: r.flr_nm.trim(),
    corrected: (r.rm ?? "").includes("정") || /^\[기재정정\]|^\[정정/.test(r.report_nm.trim()),
    url: dartViewerUrl(r.rcept_no),
  }));
}

/** Date → "YYYYMMDD" (한국 시간) */
export function yyyymmdd(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, "");
}
