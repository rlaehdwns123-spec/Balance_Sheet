/** 재무제표 구분: 연결(CFS) / 별도(OFS) */
export type FsDiv = "CFS" | "OFS";

/** 보고서 코드: 1분기 / 반기 / 3분기 / 사업보고서 */
export type ReportCode = "11013" | "11012" | "11014" | "11011";

/** 재무제표 종류: 재무상태표 / 손익계산서 / 포괄손익계산서 / 현금흐름표 / 자본변동표 */
export type SjDiv = "BS" | "IS" | "CIS" | "CF" | "SCE";

/** fnlttSinglAcntAll(단일회사 전체 재무제표) 응답의 한 행. 금액은 모두 문자열. */
export type DartAccountRow = {
  rcept_no: string;
  reprt_code: string;
  bsns_year: string;
  corp_code: string;
  sj_div: SjDiv;
  sj_nm: string;
  account_id: string;
  account_nm: string;
  account_detail: string;
  thstrm_nm: string;
  thstrm_amount: string;
  thstrm_add_amount?: string;
  frmtrm_nm?: string;
  frmtrm_amount?: string;
  frmtrm_q_nm?: string;
  frmtrm_q_amount?: string;
  frmtrm_add_amount?: string;
  bfefrmtrm_nm?: string;
  bfefrmtrm_amount?: string;
  ord: string;
  currency: string;
};

/** company(기업개황) 응답 */
export type DartCompany = {
  corp_code: string;
  corp_name: string;
  corp_name_eng: string;
  stock_name: string;
  stock_code: string;
  ceo_nm: string;
  /** Y 유가증권 / K 코스닥 / N 코넥스 / E 기타 */
  corp_cls: "Y" | "K" | "N" | "E";
  induty_code: string;
  est_dt: string;
  /** 결산월 (MM) */
  acc_mt: string;
  hm_url: string;
};

/** 한 사업연도 사업보고서의 원본 행 묶음 */
export type AnnualReport = {
  bsnsYear: number;
  rows: DartAccountRow[];
};

/** 분기·반기 보고서 코드 */
export type InterimCode = Exclude<ReportCode, "11011">;

/** 한 분기·반기 보고서의 원본 행 묶음 */
export type InterimReport = {
  bsnsYear: number;
  reprtCode: InterimCode;
  rows: DartAccountRow[];
};

/** alotMatter(배당에 관한 사항) 응답의 한 행. 값은 문자열 ("1,668", "25.10", "-") */
export type DividendRow = {
  rcept_no: string;
  corp_code: string;
  /** 구분 (예: "주당 현금배당금(원)", "(연결)현금배당성향(%)") */
  se: string;
  /** 주식 종류 (보통주/우선주/"-") */
  stock_knd?: string;
  thstrm: string;
  frmtrm: string;
  lwfr: string;
  /** 결산기준일 YYYY-MM-DD */
  stlm_dt: string;
};

/** accnutAdtorNmNdAdtOpinion(회계감사인의 명칭 및 감사의견) 응답의 한 행 */
export type AuditOpinionRow = {
  rcept_no: string;
  corp_code: string;
  /** "제57기 (당기)" 형식 */
  bsns_year: string;
  adtor: string;
  adt_opinion: string;
  adt_reprt_spcmnt_matter?: string;
  emphs_matter?: string;
  core_adt_matter?: string;
  stlm_dt: string;
};

/** list(공시검색) 응답의 한 행 */
export type DisclosureRow = {
  corp_code: string;
  corp_name: string;
  report_nm: string;
  rcept_no: string;
  flr_nm: string;
  /** YYYYMMDD */
  rcept_dt: string;
  rm: string;
};
