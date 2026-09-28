"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { parseStatementParams, type StatementParams } from "@/lib/statementParams";

/**
 * 재무제표 화면 상태(fs/sj/unit)를 URL 쿼리로 관리.
 * sj·unit은 표시만 바뀌므로 replaceState로 서버 요청 없이 바꾸고,
 * fs는 데이터가 달라지므로 hrefWith로 만든 링크로 이동한다.
 */
export function useStatementParams() {
  const searchParams = useSearchParams();
  const params = parseStatementParams((k) => searchParams.get(k));

  const hrefWith = useCallback(
    (patch: Partial<StatementParams>) => withPatch(searchParams.toString(), patch),
    [searchParams],
  );

  // 렌더 시점 searchParams가 아니라 현재 URL 기준으로 합쳐야 연속 클릭 시 앞의 변경이 덮이지 않음
  const replace = useCallback((patch: Partial<Pick<StatementParams, "sj" | "unit">>) => {
    window.history.replaceState(null, "", withPatch(window.location.search, patch));
  }, []);

  return { ...params, hrefWith, replace };
}

function withPatch(search: string, patch: Partial<StatementParams>): string {
  const next = new URLSearchParams(search);
  for (const [k, v] of Object.entries(patch)) next.set(k, v);
  return `?${next}`;
}
