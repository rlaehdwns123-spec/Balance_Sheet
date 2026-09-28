import { CATEGORY_LABEL, type RatioCategory, type RatioDef } from "@/lib/ratios";
import { formatRatio, formatRatioDelta } from "@/lib/format";

/** 서버 → 클라이언트로 넘기는 비율 한 줄 (compute 함수 제외) */
export type RatioRow = Omit<RatioDef, "compute"> & {
  /** years와 같은 순서 */
  values: (number | null)[];
  /** 첫 표시 연도의 전년 값 (증감 계산용) */
  previous: number | null;
};

const CATEGORIES: RatioCategory[] = ["profitability", "stability", "growth", "activity"];

export default function RatioCards({ years, rows, fs }: { years: number[]; rows: RatioRow[]; fs: "CFS" | "OFS" }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {fs === "CFS" ? "연결" : "별도"} · 사업보고서 기준 · 화살표는 전년 대비 증감 · 이름을 누르면 계산식
      </p>
      {CATEGORIES.map((category) => (
        <section
          key={category}
          aria-labelledby={`cat-${category}`}
          className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <h2 id={`cat-${category}`} className="mb-3 font-semibold">
            {CATEGORY_LABEL[category]}
          </h2>
          <ul className="space-y-4">
            {rows
              .filter((r) => r.category === category)
              .map((row) => (
                <RatioItem key={row.key} row={row} years={years} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RatioItem({ row, years }: { row: RatioRow; years: number[] }) {
  const popoverId = `formula-${row.key}`;

  return (
    <li>
      <button
        type="button"
        popoverTarget={popoverId}
        className="inline-flex items-center gap-1 text-sm font-medium"
        aria-describedby={popoverId}
      >
        {row.label}
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-neutral-400" fill="currentColor" aria-hidden>
          <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-.75-11.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zM9.25 9v5h1.5V9h-1.5z" />
        </svg>
        <span className="sr-only">계산식 보기</span>
      </button>

      {/* 계산식 툴팁: 모바일은 탭, 바깥을 누르거나 Esc로 닫힘 (Popover API) */}
      <div
        id={popoverId}
        popover="auto"
        role="tooltip"
        className="m-auto w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-900 shadow-xl backdrop:bg-black/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      >
        <p className="font-semibold">{row.label}</p>
        <p className="mt-2 whitespace-pre-line">{row.formula}</p>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {row.higherIsBetter ? "높을수록 좋음" : "낮을수록 좋음"}
          {row.formula.includes("평균") && " · 평균 = (전기말 + 당기말) ÷ 2"}
        </p>
      </div>

      <div className="mt-1.5 grid grid-cols-5 gap-1 text-center">
        {years.map((year, i) => {
          const value = row.values[i];
          const prev = i === 0 ? row.previous : row.values[i - 1];
          const delta = value != null && prev != null ? value - prev : null;
          const latest = i === years.length - 1;
          return (
            <div
              key={year}
              className={`rounded-lg px-0.5 py-1.5 ${latest ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}
            >
              <div className="text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400">{year}</div>
              <div
                className={`text-sm tabular-nums ${latest ? "font-semibold" : ""} ${
                  value != null && value < 0 ? "text-red-600 dark:text-red-400" : value == null ? "text-neutral-400" : ""
                }`}
              >
                {formatRatio(value, row.unit)}
              </div>
              <Delta delta={delta} unit={row.unit} />
            </div>
          );
        })}
      </div>
    </li>
  );
}

/** 전년 대비 증감: 상승 ▲ 빨강 / 하락 ▼ 파랑 (국내 관례) */
function Delta({ delta, unit }: { delta: number | null; unit: RatioRow["unit"] }) {
  const d = formatRatioDelta(delta, unit);
  if (!d || d.direction === "flat") {
    return <div className="text-[11px] text-neutral-300 dark:text-neutral-600">{d ? "0" : "–"}</div>;
  }
  const up = d.direction === "up";
  return (
    <div className={`text-[11px] tabular-nums ${up ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"}`}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "상승" : "하락"}</span>
      {d.text}
    </div>
  );
}
