"use client";

import { formatAmount, UNIT_LABEL } from "@/lib/format";
import type { StatementKind, StatementTable } from "@/lib/normalize/statement";
import { useStatementParams } from "./useStatementParams";

const SOURCE_LABEL = { BS: "재무상태표", IS: "손익계산서", CIS: "포괄손익계산서", CF: "현금흐름표" } as const;

export default function StatementView({
  years,
  tables,
}: {
  years: number[];
  tables: Record<StatementKind, StatementTable>;
}) {
  const { fs, sj, unit } = useStatementParams();
  const table = tables[sj];

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
        단위: {UNIT_LABEL[unit]} · {fs === "CFS" ? "연결" : "별도"} · 사업보고서 기준
        {sj === "IS" && table.source === "CIS" && " · 포괄손익계산서"}
        {table.rows.some((r) => r.perShare) && " · 주당이익은 원"}
      </p>

      {table.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          {SOURCE_LABEL[sj]} 데이터가 없습니다.
        </p>
      ) : (
        // 모바일에서는 화면 끝까지 붙여 가로 공간 확보 (-mx-4), 계정명 열은 sticky
        <div className="-mx-4 overflow-x-auto overscroll-x-contain sm:mx-0 sm:rounded-xl sm:border sm:border-neutral-200 sm:dark:border-neutral-800">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-neutral-500 dark:text-neutral-400">
                <th
                  scope="col"
                  className="sticky left-0 z-10 w-36 min-w-36 border-b border-neutral-200 bg-white py-2 pr-2 pl-4 text-left font-medium shadow-[1px_0_0_var(--color-neutral-200)] dark:border-neutral-800 dark:bg-neutral-950 dark:shadow-[1px_0_0_var(--color-neutral-800)]"
                >
                  계정
                </th>
                {years.map((y) => (
                  <th
                    key={y}
                    scope="col"
                    className="min-w-[5.5rem] border-b border-neutral-200 px-3 py-2 text-right font-medium last:pr-4 dark:border-neutral-800"
                  >
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => {
                const bg = row.emphasis ? "bg-neutral-50 dark:bg-neutral-900" : "bg-white dark:bg-neutral-950";
                return (
                  <tr key={row.key} className={row.emphasis ? "font-semibold" : undefined}>
                    <th
                      scope="row"
                      style={{ paddingLeft: `${1 + row.level * 0.75}rem` }}
                      className={`sticky left-0 z-10 w-36 min-w-36 border-b border-neutral-100 py-2 pr-2 text-left leading-snug break-keep [overflow-wrap:anywhere] shadow-[1px_0_0_var(--color-neutral-200)] dark:border-neutral-900 dark:shadow-[1px_0_0_var(--color-neutral-800)] ${bg} ${
                        row.emphasis ? "font-semibold" : "font-normal text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      {row.label}
                    </th>
                    {row.values.map((v, i) => {
                      const { text, negative } = formatAmount(v, unit, row.perShare);
                      return (
                        <td
                          key={years[i]}
                          className={`border-b border-neutral-100 px-3 py-2 text-right whitespace-nowrap last:pr-4 dark:border-neutral-900 ${bg} ${
                            negative ? "text-red-600 dark:text-red-400" : v === null ? "text-neutral-400 dark:text-neutral-600" : ""
                          }`}
                        >
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
