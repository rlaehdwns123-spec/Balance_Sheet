"use client";

import Segmented from "@/components/Segmented";
import { useStatementParams } from "./useStatementParams";

/** 재무제표 종류·연결/별도·금액 단위·금액/비중 선택. 분기 탭의 보고서별 재무제표에서도 같이 쓴다 */
export default function StatementControls() {
  const { fs, sj, unit, vw, hrefWith, replace } = useStatementParams();
  // 공통형은 손익계산서(매출액 대비)·재무상태표(자산총계 대비)만
  const commonSize = sj !== "CF";

  return (
    <div className="space-y-2">
      <Segmented
        label="재무제표 종류"
        value={sj}
        onChange={(v) => replace({ sj: v })}
        options={[
          { value: "BS", label: "재무상태표" },
          { value: "IS", label: "손익계산서" },
          { value: "CF", label: "현금흐름표" },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="연결/별도"
            value={fs}
            options={[
              { value: "CFS", label: "연결", href: hrefWith({ fs: "CFS" }) },
              { value: "OFS", label: "별도", href: hrefWith({ fs: "OFS" }) },
            ]}
          />
          {commonSize && (
            <Segmented
              label="금액 또는 비중"
              value={vw}
              onChange={(v) => replace({ vw: v })}
              options={[
                { value: "amt", label: "금액" },
                { value: "pct", label: "비중" },
              ]}
            />
          )}
        </div>
        {!(commonSize && vw === "pct") && (
          <Segmented
            label="금액 단위"
            value={unit}
            onChange={(v) => replace({ unit: v })}
            options={[
              { value: "eok", label: "억원" },
              { value: "mil", label: "백만원" },
            ]}
          />
        )}
      </div>
    </div>
  );
}
