import type { SecFiling } from "./types";

/**
 * 미국 기업 공시 탭 — PRD.md "v1.2 화면 규칙"의 공시: submissions의 최근 제출 목록, 누르면 SEC 원문.
 * 기본은 주요 보고서(연간·분기·수시)만, 내부자 거래(Form 4 등)처럼 건수가 많은 서류는 "전체"에서.
 */

export type FilingType = "main" | "annual" | "quarterly" | "current" | "all";

export const FILING_TYPES: { value: FilingType; label: string }[] = [
  { value: "main", label: "주요" },
  { value: "annual", label: "연간" },
  { value: "quarterly", label: "분기" },
  { value: "current", label: "수시" },
  { value: "all", label: "전체" },
];

export const parseFilingType = (v: string | null | undefined): FilingType =>
  FILING_TYPES.some((t) => t.value === v) ? (v as FilingType) : "main";

/** 정정본(/A)을 뗀 기본 서식 */
const baseForm = (form: string) => form.replace(/\/A$/, "");

const CATEGORY: Record<string, Exclude<FilingType, "main" | "all">> = {
  "10-K": "annual",
  "20-F": "annual",
  "40-F": "annual",
  "10-Q": "quarterly",
  "8-K": "current",
  "6-K": "current",
};

/** 서식 → 한글 설명 */
const FORM_LABEL: Record<string, string> = {
  "10-K": "연간 보고서",
  "20-F": "연간 보고서 (해외 기업)",
  "40-F": "연간 보고서 (캐나다 기업)",
  "10-Q": "분기 보고서",
  "8-K": "수시 보고서",
  "6-K": "수시 보고서 (해외 기업)",
  "DEF 14A": "주주총회 위임장 설명서",
  "DEFA14A": "주주총회 위임장 추가 자료",
  "S-1": "증권신고서",
  "S-3": "증권신고서 (간이)",
  "S-8": "임직원 주식 보상 등록",
  "SC 13D": "5% 이상 대량 보유 보고",
  "SC 13G": "5% 이상 대량 보유 보고 (단순 투자)",
  "SCHEDULE 13D": "5% 이상 대량 보유 보고",
  "SCHEDULE 13G": "5% 이상 대량 보유 보고 (단순 투자)",
  "3": "임원·주요주주 최초 지분 보고",
  "4": "임원·주요주주 지분 변동",
  "5": "임원·주요주주 연간 지분 보고",
  "144": "제한 증권 매도 예정 신고",
  "11-K": "직원 저축 계획 연간 보고서",
  "SD": "분쟁 광물 보고",
  "ARS": "주주용 연차 보고서",
  "25-NSE": "상장 폐지 통지",
  "FWP": "자유 서식 투자설명서",
};

export function formLabel(form: string): string | null {
  const base = baseForm(form);
  return FORM_LABEL[base] ?? (/^424B/.test(base) ? "투자설명서" : null);
}

export function matchesType(form: string, type: FilingType): boolean {
  if (type === "all") return true;
  const category = CATEGORY[baseForm(form)];
  return type === "main" ? category !== undefined : category === type;
}

/** SEC 원문 주소: 주 문서가 있으면 그 문서, 없으면 제출 건 색인 페이지 */
export function filingUrl(cik: string, f: Pick<SecFiling, "accessionNumber" | "primaryDocument">): string {
  const dir = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${f.accessionNumber.replace(/-/g, "")}`;
  return f.primaryDocument ? `${dir}/${f.primaryDocument}` : `${dir}/${f.accessionNumber}-index.htm`;
}

export type FilingItem = {
  accessionNumber: string;
  form: string;
  label: string | null;
  /** primaryDocDescription — 서식명과 같으면 null */
  description: string | null;
  amended: boolean;
  filingDate: string;
  reportDate: string | null;
  url: string;
};

export type FilingPage = { items: FilingItem[]; page: number; totalPages: number; total: number };

export const FILINGS_PER_PAGE = 20;

/** 유형으로 거르고 페이지로 자른다 (submissions는 이미 최신순) */
export function pageFilings(cik: string, filings: SecFiling[], type: FilingType, page: number): FilingPage {
  const matched = filings.filter((f) => matchesType(f.form, type));
  const totalPages = Math.max(1, Math.ceil(matched.length / FILINGS_PER_PAGE));
  const current = Math.min(Math.max(1, page), totalPages);
  const items = matched.slice((current - 1) * FILINGS_PER_PAGE, current * FILINGS_PER_PAGE).map((f) => {
    const description = f.primaryDocDescription?.trim() || null;
    return {
      accessionNumber: f.accessionNumber,
      form: f.form,
      label: formLabel(f.form),
      description: description && description.toUpperCase() !== f.form.toUpperCase() ? description : null,
      amended: f.form.endsWith("/A"),
      filingDate: f.filingDate,
      reportDate: f.reportDate || null,
      url: filingUrl(cik, f),
    };
  });
  return { items, page: current, totalPages, total: matched.length };
}

/** 캐시에 남길 그 밖의 서류 수 */
export const OTHER_FILINGS_LIMIT = 1000;

/**
 * 캐시용으로 제출 목록을 줄인다: 주요 보고서는 모두, 그 밖의 서류는 최근 limit건.
 * 금융사는 1년에 투자설명서(424B2)만 수만 건이라(JPM 약 2만 6천 건) Next 캐시 한도 2MB를 넘는다.
 */
export function trimFilings(filings: SecFiling[], limit = OTHER_FILINGS_LIMIT): SecFiling[] {
  let others = 0;
  return filings.filter((f) => matchesType(f.form, "main") || others++ < limit);
}
