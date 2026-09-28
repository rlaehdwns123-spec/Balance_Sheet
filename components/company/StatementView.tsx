"use client";

import { useRouter } from "next/navigation";
import { Fragment } from "react";
import Segmented from "@/components/Segmented";
import { formatAmount, formatChange, UNIT_LABEL } from "@/lib/format";
import { INTERIM_NAME, QUARTER_OF, type InterimRef } from "@/lib/interim";
import type { Section, StatementKind, StatementRow, StatementTable } from "@/lib/normalize/statement";
import { interimKey, type IncomeBasis, type IncomeView } from "@/lib/statementParams";
import { useStatementParams } from "./useStatementParams";

/** 손익계산서는 보기(IFRS 18/기존)·기준(3개월/누적)별로 미리 만든 표 */
export type StatementTables = {
  BS: StatementTable;
  IS: Record<IncomeView, Record<IncomeBasis, StatementTable>>;
  CF: StatementTable;
};

/** 분기·반기 보기: 보여 주는 보고서와 고를 수 있는 보고서(최신순) */
export type InterimInfo = { current: InterimRef; options: InterimRef[] };

const interimLabel = ({ year, code }: InterimRef) => `${year} ${INTERIM_NAME[code]}`;

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

const CLASSIC_NOTE =
  "기존 K-IFRS 양식 순서(영업이익 → 기타수익·비용 → 금융손익 → 법인세차감전이익)로 범주 구분 없이 보여 줍니다.";

const TIER_CLASS: Record<StatementRow["tier"], string> = {
  total: "fs-total font-bold text-neutral-950 dark:text-white",
  subtotal: "fs-subtotal font-semibold text-neutral-900 dark:text-neutral-100",
  item: "font-normal text-neutral-600 dark:text-neutral-400",
};

export default function StatementView({ tables, interim }: { tables: StatementTables; interim?: InterimInfo }) {
  const { fs, sj, unit, isv, acc, replace, hrefWith } = useStatementParams();
  const router = useRouter();
  const table = sj === "IS" ? tables.IS[isv][acc] : tables[sj];
  const classic = sj === "IS" && isv === "classic";
  const headerSections = classic ? [] : HEADER_SECTIONS[sj];
  // 1분기는 3개월 = 누적이라 기준 선택이 필요 없음
  const showBasis = sj === "IS" && !!interim && QUARTER_OF[interim.current.code] > 1;
  const { columns } = table;
  const colCount = columns.length + (table.compare ? 1 : 0);

  return (
    <div>
      {(interim || sj === "IS") && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {interim && (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-neutral-600 dark:text-neutral-400">보고서</span>
              <select
                value={interimKey(interim.current.year, interim.current.code)}
                onChange={(e) => router.push(hrefWith({ q: e.target.value }), { scroll: false })}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900"
              >
                {interim.options.map((ref, i) => (
                  <option key={interimKey(ref.year, ref.code)} value={interimKey(ref.year, ref.code)}>
                    {interimLabel(ref)}
                    {i === 0 ? " (최신)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {sj === "IS" && (
            <Segmented
              label="손익계산서 양식"
              value={isv}
              onChange={(v) => replace({ isv: v })}
              options={[
                { value: "ifrs18", label: "IFRS 18 범주" },
                { value: "classic", label: "기존 양식" },
              ]}
            />
          )}
          {showBasis && (
            <Segmented
              label="손익 기준 기간"
              value={acc}
              onChange={(v) => replace({ acc: v })}
              options={[
                { value: "q", label: "3개월" },
                { value: "cum", label: "누적" },
              ]}
            />
          )}
        </div>
      )}

      <p className="mb-2 text-xs text-neutral-600 dark:text-neutral-400">
        단위: {UNIT_LABEL[unit]} · {fs === "CFS" ? "연결" : "별도"} ·{" "}
        {interim ? `${interimLabel(interim.current)}보고서 기준 · 전년 동기 대비` : "사업보고서 기준"}
        {sj === "IS" && table.source === "CIS" && " · 포괄손익계산서"}
        {table.rows.some((r) => r.perShare) && " · 주당이익은 원"}
      </p>

      {/* 범주 색 범례 (색만으로 구분하지 않도록 표 안에도 범주 머리행·라벨이 있다) */}
      <ul className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300" aria-label="범주 색">
        {(classic ? [] : LEGEND[sj]).map((section) => (
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
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`fs-cell min-w-[5.5rem] border-b border-neutral-300 px-3 py-2 text-right last:pr-4 dark:border-neutral-700 ${
                      i === 0 ? "font-bold text-neutral-900 dark:text-neutral-100" : "font-medium"
                    }`}
                  >
                    {col.label}
                    {col.sub && <span className="block text-[11px] font-normal text-neutral-500">{col.sub}</span>}
                  </th>
                ))}
                {table.compare && (
                  <th
                    scope="col"
                    className="fs-cell min-w-[5rem] border-b border-neutral-300 px-3 py-2 text-right font-medium last:pr-4 dark:border-neutral-700"
                  >
                    증감률
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, idx) => {
                const startsSection =
                  headerSections.includes(row.section) && (idx === 0 || table.rows[idx - 1].section !== row.section);
                return (
                  <Fragment key={row.key}>
                    {startsSection && <SectionHeader section={row.section} colSpan={colCount} />}
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
                            key={columns[i].key}
                            className={`fs-cell border-b border-neutral-100 px-3 py-2 text-right whitespace-nowrap last:pr-4 dark:border-neutral-900 ${
                              negative ? "text-red-600 dark:text-red-400" : v === null ? "text-neutral-400 dark:text-neutral-600" : ""
                            }`}
                          >
                            {text}
                          </td>
                        );
                      })}
                      {table.compare && <ChangeCell row={row} turnaround={sj === "IS"} />}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sj === "IS" && table.rows.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          {classic ? CLASSIC_NOTE : INCOME_NOTE[table.format]}
        </p>
      )}
      {interim && table.rows.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          {sj === "BS"
            ? "재무상태표는 분기·반기말 잔액을 직전 사업연도 말과 비교합니다."
            : "증감률은 전년 같은 기간 대비이며, 증가는 ▲ 빨강·감소는 ▼ 파랑입니다."}
        </p>
      )}
    </div>
  );
}

const CHANGE_CLASS = {
  up: "text-red-600 dark:text-red-400",
  down: "text-blue-600 dark:text-blue-400",
  flat: "",
  none: "text-neutral-400 dark:text-neutral-500",
} as const;

/** 당기 vs 비교 기간 증감률 (한국식: 증가 빨강 ▲, 감소 파랑 ▼. 흑자·적자전환은 글자로) */
function ChangeCell({ row, turnaround }: { row: StatementRow; turnaround: boolean }) {
  const [current, prior] = row.values;
  const { direction, text } = formatChange(current, prior, turnaround && !row.perShare);
  const arrow = text.endsWith("%") ? { up: "▲", down: "▼", flat: "", none: "" }[direction] : "";
  return (
    <td
      className={`fs-cell border-b border-neutral-100 px-3 py-2 text-right text-xs whitespace-nowrap last:pr-4 dark:border-neutral-900 ${CHANGE_CLASS[direction]}`}
    >
      {arrow && <span aria-label={direction === "up" ? "증가" : "감소"}>{arrow} </span>}
      {text}
    </td>
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
