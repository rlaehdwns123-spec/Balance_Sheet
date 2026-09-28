"use client";

import Segmented from "@/components/Segmented";
import { useStatementParams } from "./useStatementParams";

export default function StatementControls() {
  const { fs, sj, unit, hrefWith, replace } = useStatementParams();

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
      <div className="flex items-center justify-between gap-2">
        <Segmented
          label="연결/별도"
          value={fs}
          options={[
            { value: "CFS", label: "연결", href: hrefWith({ fs: "CFS" }) },
            { value: "OFS", label: "별도", href: hrefWith({ fs: "OFS" }) },
          ]}
        />
        <Segmented
          label="금액 단위"
          value={unit}
          onChange={(v) => replace({ unit: v })}
          options={[
            { value: "eok", label: "억원" },
            { value: "mil", label: "백만원" },
          ]}
        />
      </div>
    </div>
  );
}
