"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Segmented from "@/components/Segmented";
import { companyPath, type Market } from "@/lib/market";
import FsToggle from "./FsToggle";

type View = "ratios" | "analysis" | "charts";

/** 비율·분석 탭 안의 하위 화면 선택(비율 / 분석 / 차트) + 연결·별도 (미국 기업은 연결/별도 없음) */
export default function RatioSubNav({ corpCode, market = "kr" }: { corpCode: string; market?: Market }) {
  const pathname = usePathname();
  const fs = useSearchParams().get("fs");
  const query = fs && market === "kr" ? `?fs=${fs}` : "";
  const base = companyPath(corpCode, market);
  const current: View = pathname.startsWith(`${base}/analysis`) ? "analysis" : pathname.startsWith(`${base}/charts`) ? "charts" : "ratios";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Segmented
        label="비율·분석 보기"
        value={current}
        options={[
          { value: "ratios", label: "비율", href: `${base}/ratios${query}` },
          { value: "analysis", label: "분석", href: `${base}/analysis${query}` },
          { value: "charts", label: "차트", href: `${base}/charts${query}` },
        ]}
      />
      {market === "kr" && <FsToggle />}
    </div>
  );
}
