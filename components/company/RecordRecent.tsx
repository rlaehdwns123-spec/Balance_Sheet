"use client";

import { useEffect } from "react";
import { recordRecent } from "@/lib/recent";

/** 회사 페이지를 열면 최근 본 기업에 기록 (화면에는 아무것도 그리지 않음) */
export default function RecordRecent({ corpCode, name, stockCode }: { corpCode: string; name: string; stockCode: string }) {
  useEffect(() => {
    recordRecent({ corpCode, name, stockCode });
  }, [corpCode, name, stockCode]);
  return null;
}
