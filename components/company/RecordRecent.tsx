"use client";

import { useEffect } from "react";
import type { Market } from "@/lib/market";
import { recordRecent } from "@/lib/recent";

/** 회사 페이지를 열면 최근 본 기업에 기록 (화면에는 아무것도 그리지 않음) */
export default function RecordRecent({
  corpCode,
  name,
  stockCode,
  market,
}: {
  corpCode: string;
  name: string;
  stockCode: string;
  /** 미국 기업이면 "us" (한국은 생략 — 예전 저장 형식과 같게) */
  market?: Market;
}) {
  useEffect(() => {
    recordRecent({ corpCode, name, stockCode, ...(market ? { market } : {}) });
  }, [corpCode, name, stockCode, market]);
  return null;
}
