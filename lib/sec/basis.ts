import { currencyName } from "@/lib/format";
import type { SecStandard } from "@/lib/normalize/sec";

const TAXONOMY_LABEL: Record<SecStandard["taxonomy"], string> = { "us-gaap": "US GAAP", "ifrs-full": "IFRS" };

/** 미국 기업 화면의 기준 문구: "연간 보고서 기준 · US GAAP · 달러(USD)" */
export const usBasis = (std: Pick<SecStandard, "taxonomy" | "currency">) =>
  `연간 보고서 기준 · ${TAXONOMY_LABEL[std.taxonomy]} · ${currencyName(std.currency)}(${std.currency})`;

/** 억·조로 줄인 금액의 통화 안내: "금액 단위 억·조 달러" */
export const usAmountNote = (currency: string) => `금액은 억·조 ${currencyName(currency)} 단위입니다.`;
