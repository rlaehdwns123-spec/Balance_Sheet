"use client";

import FinancialComboChart from "@/components/charts/FinancialComboChart";
import Segmented from "@/components/Segmented";
import { formatAmount, formatRatio, UNIT_LABEL } from "@/lib/format";
import type { QuarterPoint } from "@/lib/quarterly";
import { useStatementParams } from "./useStatementParams";

type Row = {
  key: string;
  label: string;
  kind: "amount" | "percent";
  tier?: "total" | "subtotal";
  pick: (p: QuarterPoint) => number | null;
};

const ROWS: Row[] = [
  { key: "revenue", label: "매출액", kind: "amount", tier: "subtotal", pick: (p) => p.revenue },
  { key: "revenueYoY", label: "매출액 전년 동기 대비", kind: "percent", pick: (p) => p.revenueYoY },
  { key: "operatingIncome", label: "영업이익", kind: "amount", tier: "total", pick: (p) => p.operatingIncome },
  { key: "operatingMargin", label: "영업이익률", kind: "percent", pick: (p) => p.operatingMargin },
  { key: "netIncome", label: "당기순이익", kind: "amount", tier: "total", pick: (p) => p.netIncome },
  { key: "operatingCashFlow", label: "영업활동현금흐름", kind: "amount", tier: "subtotal", pick: (p) => p.operatingCashFlow },
  { key: "capex", label: "유형자산의 취득", kind: "amount", pick: (p) => p.capex },
  { key: "fcf", label: "잉여현금흐름(FCF)", kind: "amount", tier: "subtotal", pick: (p) => p.fcf },
];

const TIER_CLASS = {
  total: "fs-total font-bold text-neutral-950 dark:text-white",
  subtotal: "fs-subtotal font-semibold text-neutral-900 dark:text-neutral-100",
  item: "font-normal text-neutral-600 dark:text-neutral-400",
} as const;

/** 최근 12개 분기 실적: 추이 차트(오래된 → 최신) + 표(최신 분기부터) */
export default function QuarterlyView({ points, fs, fiscalMonth }: { points: QuarterPoint[]; fs: "CFS" | "OFS"; fiscalMonth: number }) {
  const { unit, replace } = useStatementParams();
  const newestFirst = [...points].reverse();
  const chart = points.map((p) => ({
    year: p.label,
    revenue: p.revenue,
    operatingIncome: p.operatingIncome,
    netIncome: p.netIncome,
    operatingMargin: p.operatingMargin,
  }));
  const basis = `${fs === "CFS" ? "연결" : "별도"} · 분기 3개월 기준`;

  return (
    <div className="space-y-4">
      <figure className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
        <figcaption className="mb-3">
          <h2 className="font-semibold">분기 매출·이익 추이</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">막대 금액(좌축) · 선 영업이익률(우축) · {basis}</p>
        </figcaption>
        <FinancialComboChart data={chart} />
      </figure>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            단위: {UNIT_LABEL[unit]} · {basis}
          </p>
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
        <div className="-mx-4 overflow-x-auto overscroll-x-contain sm:mx-0 sm:rounded-xl sm:border sm:border-neutral-200 sm:dark:border-neutral-800">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-neutral-600 dark:text-neutral-400">
                <th
                  scope="col"
                  className="fs-cell fs-sticky sticky left-0 z-10 w-32 min-w-32 border-b border-neutral-300 py-2 pr-2 pl-4 text-left font-medium dark:border-neutral-700"
                >
                  항목
                </th>
                {newestFirst.map((p, i) => (
                  <th
                    key={p.label}
                    scope="col"
                    className={`fs-cell min-w-[5rem] border-b border-neutral-300 px-3 py-2 text-right last:pr-4 dark:border-neutral-700 ${
                      i === 0 ? "font-bold text-neutral-900 dark:text-neutral-100" : "font-medium"
                    } ${p.q === 4 ? "border-l border-l-neutral-200 dark:border-l-neutral-800" : ""}`}
                  >
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className={TIER_CLASS[row.tier ?? "item"]}>
                  <th
                    scope="row"
                    style={{ paddingLeft: row.tier ? "1rem" : "1.75rem" }}
                    className="fs-cell fs-sticky sticky left-0 z-10 w-32 min-w-32 border-b border-neutral-100 py-2 pr-2 text-left leading-snug [font-weight:inherit] break-keep dark:border-neutral-900"
                  >
                    {row.label}
                  </th>
                  {newestFirst.map((p) => {
                    const v = row.pick(p);
                    const { text, negative } =
                      row.kind === "percent" ? { text: formatRatio(v, "percent"), negative: v != null && v < 0 } : formatAmount(v, unit);
                    return (
                      <td
                        key={p.label}
                        className={`fs-cell border-b border-neutral-100 px-3 py-2 text-right whitespace-nowrap last:pr-4 dark:border-neutral-900 ${
                          negative ? "text-red-600 dark:text-red-400" : v === null ? "text-neutral-400 dark:text-neutral-600" : ""
                        } ${p.q === 4 ? "border-l border-l-neutral-200 dark:border-l-neutral-800" : ""}`}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        <li>손익은 분기·반기 보고서의 해당 분기 3개월 금액이고, 4분기는 사업보고서 연간 금액에서 3분기 누적을 뺀 값입니다.</li>
        <li>현금흐름표는 연초부터 누적으로 공시되어 직전 분기 누적을 빼서 분기 값을 구했습니다.</li>
        <li>매출액 전년 동기 대비는 표의 12개 분기 안에서 비교할 수 있는 분기만 계산합니다.</li>
        {fiscalMonth !== 12 && <li>{fiscalMonth}월 결산 회사라 분기는 사업연도 기준입니다 (1Q = 사업연도 첫 3개월).</li>}
      </ul>
    </div>
  );
}
