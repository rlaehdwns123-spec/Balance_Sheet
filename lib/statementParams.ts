import type { FsDiv } from "@/lib/dart/types";
import type { AmountUnit } from "@/lib/format";
import type { StatementKind } from "@/lib/normalize/statement";

/** 재무제표 화면 URL 쿼리: fs=CFS|OFS, sj=BS|IS|CF, unit=eok|mil */
export type StatementParams = { fs: FsDiv; sj: StatementKind; unit: AmountUnit };

export function parseStatementParams(get: (key: string) => string | null | undefined): StatementParams {
  const sj = get("sj");
  return {
    fs: get("fs") === "OFS" ? "OFS" : "CFS",
    sj: sj === "IS" || sj === "CF" ? sj : "BS",
    unit: get("unit") === "mil" ? "mil" : "eok",
  };
}
