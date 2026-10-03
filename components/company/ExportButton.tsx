"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ExportPayload } from "@/lib/export/payload";
import type { Market } from "@/lib/market";

/**
 * 재무제표·비율·분석을 시트별로 담은 .xlsx 다운로드. exceljs는 눌렀을 때만 불러온다.
 * 미국 기업(corpCode = 10자리 CIK)은 연결/별도 구분이 없다.
 */
export default function ExportButton({ corpCode, market = "kr" }: { corpCode: string; market?: Market }) {
  const fs = useSearchParams().get("fs") === "OFS" ? "OFS" : "CFS";
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState("");

  async function download() {
    setState("busy");
    try {
      const res = await fetch(`/api/export?corp=${corpCode}&fs=${fs}`);
      const body = (await res.json()) as ExportPayload | { error: string };
      if (!res.ok || "error" in body) throw new Error("error" in body ? body.error : `HTTP ${res.status}`);

      const [mod, { buildWorkbook, exportFileName }] = await Promise.all([import("exceljs"), import("@/lib/export/workbook")]);
      // 브라우저 번들은 UMD라 default 아래에 있을 수 있다
      const ns = mod as unknown as { Workbook?: typeof import("exceljs").Workbook; default?: { Workbook: typeof import("exceljs").Workbook } };
      const WorkbookClass = ns.Workbook ?? ns.default?.Workbook;
      if (!WorkbookClass) throw new Error("엑셀 라이브러리를 불러오지 못했습니다.");

      const buffer = await buildWorkbook(WorkbookClass, body).xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName(body);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState("idle");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "내보내기에 실패했습니다.");
      setState("error");
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={download}
        disabled={state === "busy"}
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline disabled:cursor-wait disabled:opacity-60 dark:text-blue-400"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 3v10M6 9l4 4 4-4M4 16h12" />
        </svg>
        {state === "busy" ? "만드는 중…" : market === "us" ? "엑셀" : `엑셀 (${fs === "CFS" ? "연결" : "별도"})`}
      </button>
      {state === "error" && (
        <span role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {message}
        </span>
      )}
    </span>
  );
}
