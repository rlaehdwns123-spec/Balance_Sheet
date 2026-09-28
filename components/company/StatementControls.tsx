"use client";

import Segmented from "@/components/Segmented";
import { useStatementParams } from "./useStatementParams";

export default function StatementControls() {
  const { fs, sj, unit, pd, hrefWith, replace } = useStatementParams();

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
            label="기간"
            value={pd}
            options={[
              { value: "A", label: "연간", href: hrefWith({ pd: null, q: null }) },
              { value: "Q", label: "분기·반기", href: hrefWith({ pd: "Q" }) },
            ]}
          />
          <Segmented
            label="연결/별도"
            value={fs}
            options={[
              { value: "CFS", label: "연결", href: hrefWith({ fs: "CFS" }) },
              { value: "OFS", label: "별도", href: hrefWith({ fs: "OFS" }) },
            ]}
          />
        </div>
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
