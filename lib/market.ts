/** 시장: 한국(DART, 8자리 고유번호) / 미국(SEC, 10자리 CIK) */
export type Market = "kr" | "us";

/** 회사 화면 주소. section을 주면 그 탭 (예: "analysis") */
export function companyPath(code: string, market: Market = "kr", section?: string): string {
  const base = market === "us" ? `/company/us/${code}` : `/company/${code}`;
  return section ? `${base}/${section}` : base;
}

/** 저장된 회사 항목의 코드가 시장 형식에 맞는지 (market이 없으면 예전 항목 — 한국) */
export function isValidCode(code: unknown, market: unknown): boolean {
  if (typeof code !== "string") return false;
  if (market === "us") return /^\d{10}$/.test(code);
  return (market === undefined || market === "kr") && /^\d{8}$/.test(code);
}

/** 비교 주소 등에서 코드 길이로 시장을 가른다: 8자리 한국 고유번호, 10자리 미국 CIK */
export const marketOfCode = (code: string): Market => (code.length === 10 ? "us" : "kr");
