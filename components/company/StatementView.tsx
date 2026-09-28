"use client";

import { Fragment } from "react";
import { formatAmount, UNIT_LABEL } from "@/lib/format";
import type { Section, StatementKind, StatementRow, StatementTable } from "@/lib/normalize/statement";
import { useStatementParams } from "./useStatementParams";

const SOURCE_LABEL = { BS: "재무상태표", IS: "손익계산서", CIS: "포괄손익계산서", CF: "현금흐름표" } as const;

const SECTION_LABEL: Record<Exclude<Section, "summary">, string> = {
  operating: "영업",
  investing: "투자",
  financing: "재무",
  assets: "자산",
  liabilities: "부채",
  equity: "자본",
};

/** 범주 머리행을 넣을 표. 현금흐름표는 "영업활동현금흐름" 같은 소계가 이미 머리 역할을 한다 */
const HEADER_SECTIONS: Record<StatementKind, Section[]> = {
  BS: ["assets", "liabilities", "equity"],
  IS: ["operating", "investing", "financing"],
  CF: [],
};

const LEGEND: Record<StatementKind, Section[]> = {
  BS: ["assets", "liabilities", "equity"],
  IS: ["operating", "investing", "financing"],
  CF: ["operating", "investing", "financing"],
};

const INCOME_NOTE = {
  kifrs:
    "영업·투자·재무 구분은 IFRS 18(2027년 시행) 기준입니다. 이 보고서들은 기존 양식이라 계정 성격으로 분류한 추정이며, 표시된 영업이익에는 기타수익·비용이 포함되지 않습니다.",
  mixed:
    "2027년 이후는 IFRS 18 양식, 이전 연도는 기존 양식입니다. 기존 양식 연도의 영업이익에는 기타수익·비용이 포함되지 않아 연도 간 직접 비교에 주의하세요.",
  ifrs18: "IFRS 18 양식(영업·투자·재무 범주)으로 공시된 손익계산서입니다.",
} as const;

const TIER_CLASS: Record<StatementRow["tier"], string> = {
  total: "fs-total font-bold text-neutral-950 dark:text-white",
  subtotal: "fs-subtotal font-semibold text-neutral-900 dark:text-neutral-100",
  item: "font-normal text-neutral-600 dark:text-neutral-400",
};

export default function StatementView({
  years,
  tables,
}: {
  years: number[];
  tables: Record<StatementKind, StatementTable>;
}) {
  const { fs, sj, unit } = useStatementParams();
  const table = tables[sj];
  const headerSections = HEADER_SECTIONS[sj];

  return (
    <div>
      <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
        단위: {UNIT_LABEL[unit]} · {fs === "CFS" ? "연결" : "별도"} · 사업보고서 기준
        {sj === "IS" && table.source === "CIS" && " · 포괄손익계산서"}
        {table.rows.some((r) => r.perShare) && " · 주당이익은 원"}
      </p>

      {/* 범주 색 범례 (색만으로 구분하지 않도록 표 안에도 범주 머리행·라벨이 있다) */}
      <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300" aria-label="범주 색">
        {LEGEND[sj].map((section) => (
          <li key={section} data-section={section} className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-1 rounded-full bg-[var(--accent)]" />
            {SECTION_LABEL[section as Exclude<Section, "summary">]}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-neutral-500">
          <span aria-hidden className="h-3 w-3 rounded-sm border-t-2 border-neutral-400 bg-neutral-200 dark:bg-neutral-700" />
          합계
        </li>
      </ul>

      {table.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          {SOURCE_LABEL[sj]} 데이터가 없습니다.
        </p>
      ) : (
        // 모바일에서는 화면 끝까지 붙여 가로 공간 확보 (-mx-4), 계정명 열은 sticky
        <div className="-mx-4 overflow-x-auto overscroll-x-contain sm:mx-0 sm:rounded-xl sm:border sm:border-neutral-200 sm:dark:border-neutral-800">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-neutral-600 dark:text-neutral-400">
                <th
                  scope="col"
                  data-section="summary"
                  className="fs-cell fs-sticky sticky left-0 z-10 w-36 min-w-36 border-b border-neutral-300 py-2 pr-2 pl-4 text-left font-medium dark:border-neutral-700"
                >
                  계정
                </th>
                {years.map((y, i) => (
                  <th
                    key={y}
                    scope="col"
                    className={`fs-cell min-w-[5.5rem] border-b border-neutral-300 px-3 py-2 text-right last:pr-4 dark:border-neutral-700 ${
                      i === 0 ? "font-bold text-neutral-900 dark:text-neutral-100" : "font-medium"
                    }`}
                  >
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, idx) => {
                const startsSection =
                  headerSections.includes(row.section) && (idx === 0 || table.rows[idx - 1].section !== row.section);
                return (
                  <Fragment key={row.key}>
                    {startsSection && <SectionHeader section={row.section} colSpan={years.length} />}
                    <tr data-section={row.section} className={TIER_CLASS[row.tier]}>
                      <th
                        scope="row"
                        style={{ paddingLeft: `${1 + row.level * 0.75}rem` }}
                        className="fs-cell fs-sticky sticky left-0 z-10 w-36 min-w-36 border-b border-neutral-100 py-2 pr-2 text-left leading-snug [font-weight:inherit] break-keep [overflow-wrap:anywhere] dark:border-neutral-900"
                      >
                        {row.label}
                      </th>
                      {row.values.map((v, i) => {
                        const { text, negative } = formatAmount(v, unit, row.perShare);
                        return (
                          <td
                            key={years[i]}
                            className={`fs-cell border-b border-neutral-100 px-3 py-2 text-right whitespace-nowrap last:pr-4 dark:border-neutral-900 ${
                              negative ? "text-red-600 dark:text-red-400" : v === null ? "text-neutral-400 dark:text-neutral-600" : ""
                            }`}
                          >
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sj === "IS" && table.rows.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{INCOME_NOTE[table.format]}</p>
      )}
    </div>
  );
}

/** 범주 머리행: 범주 색 배경 + 굵은 라벨. 값 칸은 비워 두되 배경을 이어서 한 줄 띠로 보이게 */
function SectionHeader({ section, colSpan }: { section: Section; colSpan: number }) {
  return (
    <tr data-section={section} className="fs-header">
      <th
        scope="rowgroup"
        className="fs-cell fs-sticky sticky left-0 z-10 border-b border-neutral-200 py-1.5 pr-2 pl-4 text-left text-[13px] font-bold tracking-wide text-neutral-900 dark:border-neutral-800 dark:text-neutral-50"
      >
        {SECTION_LABEL[section as Exclude<Section, "summary">]}
      </th>
      <td colSpan={colSpan} className="fs-cell border-b border-neutral-200 dark:border-neutral-800" />
    </tr>
  );
}
