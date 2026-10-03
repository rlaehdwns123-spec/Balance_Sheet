/** companyfacts의 값 하나. 순간 값(재무상태표)은 start가 없다 */
export type SecFact = {
  start?: string;
  end: string;
  val: number;
  form: string;
  /** 제출 보고서 기준 회계연도 — 비교 수치에도 같은 값이 붙으므로 연도 판단에 쓰지 않는다 */
  fy?: number;
  fp?: string;
  filed: string;
};

export type SecConcept = {
  /** ifrs-full 태그는 SEC가 null로 준다 */
  label: string | null;
  /** 단위(USD, TWD, shares, USD/shares …) → 값 목록 */
  units: Record<string, SecFact[]>;
};

/** facts → 분류체계(us-gaap, ifrs-full, dei …) → 태그 */
export type SecCompanyFacts = {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, SecConcept>>;
};

export type SecFiling = {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string;
  primaryDocument: string;
  primaryDocDescription: string;
};

export type SecSubmissions = {
  cik: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  sic: string;
  sicDescription: string;
  /** MMDD */
  fiscalYearEnd: string;
  stateOfIncorporation: string;
  website: string;
  /** 최근 제출 목록 (최신순) */
  filings: SecFiling[];
};

export type UsCorp = {
  /** 10자리 CIK */
  cik: string;
  ticker: string;
  name: string;
};
