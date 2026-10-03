import { BENCHMARK_RATIO_KEYS, standingOf, type RatioBenchmark, type Standing } from "@/lib/benchmark";
import { formatRatio, formatRatioDelta } from "@/lib/format";
import { CATEGORY_LABEL, type RatioCategory, type RatioDef } from "@/lib/ratios";

/** 서버 → 클라이언트로 넘기는 비율 한 줄 (compute 함수 제외) */
export type RatioRow = Omit<RatioDef, "compute"> & {
  meaning: string;
  guide: string;
  /** 계산 기준 안내 (예: 금융비용 대용) */
  note: string | null;
  /** years와 같은 순서 */
  values: (number | null)[];
  /** 첫 표시 연도의 전년 값 (증감 계산용) */
  previous: number | null;
  /** 최신 연도 업종 비교 (없으면 null) */
  benchmark: RatioBenchmark | null;
};

export type IndustryMeta = { name: string; code: string; year: number; companies: number };

const CATEGORIES: RatioCategory[] = ["profitability", "stability", "growth", "activity"];

const STANDING: Record<Standing, { label: string; className: string }> = {
  top: {
    label: "업종 상위권",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  },
  middle: {
    label: "업종 중간",
    className: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  },
  bottom: {
    label: "업종 하위권",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200",
  },
};

export default function RatioCards({
  years,
  rows,
  fs,
  industry,
  basis,
  industryNote,
}: {
  years: number[];
  rows: RatioRow[];
  fs: "CFS" | "OFS";
  industry: IndustryMeta | null;
  /** 기준 문구 (기본: "연결 · 사업보고서 기준") */
  basis?: string;
  /** 업종 비교가 없을 때 안내 (기본: 불러오지 못함) */
  industryNote?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        <p>{basis ?? `${fs === "CFS" ? "연결" : "별도"} · 사업보고서 기준`} · 화살표는 전년 대비 증감 · 이름을 누르면 의미와 계산식</p>
        {industry ? (
          <p>
            업종 비교: <span className="font-medium text-neutral-800 dark:text-neutral-200">{industry.name}</span> 상장사{" "}
            {industry.companies}개 · {industry.year}년 · DART 주요계정(연결 우선) 기준
          </p>
        ) : (
          <p>{industryNote ?? "업종 비교 데이터를 불러오지 못했습니다."}</p>
        )}
        {industry && <RangeLegend />}
      </div>

      {CATEGORIES.map((category) => (
        <section
          key={category}
          aria-labelledby={`cat-${category}`}
          className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <h2 id={`cat-${category}`} className="mb-3 font-semibold">
            {CATEGORY_LABEL[category]}
          </h2>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {rows
              .filter((r) => r.category === category)
              .map((row) => (
                <RatioItem key={row.key} row={row} years={years} hasIndustry={!!industry} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RatioItem({ row, years, hasIndustry }: { row: RatioRow; years: number[]; hasIndustry: boolean }) {
  const popoverId = `formula-${row.key}`;
  const b = row.benchmark;

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <button
        type="button"
        popoverTarget={popoverId}
        className="inline-flex items-center gap-1 text-sm font-semibold"
        aria-describedby={popoverId}
      >
        {row.label}
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-neutral-400" fill="currentColor" aria-hidden>
          <path d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm-.75-11.5a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0zM9.25 9v5h1.5V9h-1.5z" />
        </svg>
        <span className="sr-only">의미와 계산식 보기</span>
      </button>
      <p className="mt-0.5 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{row.meaning}</p>
      {row.note && (
        <p className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          {row.note}
        </p>
      )}

      <RatioPopover id={popoverId} row={row} />

      <div className="mt-2 grid grid-cols-5 gap-1 text-center">
        {years.map((year, i) => {
          const value = row.values[i];
          const prev = i === 0 ? row.previous : row.values[i - 1];
          const delta = value != null && prev != null ? value - prev : null;
          const latest = i === years.length - 1;
          return (
            <div key={year} className={`rounded-lg px-0.5 py-1.5 ${latest ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
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

      {hasIndustry && (
        <div className="mt-2.5">
          {b ? (
            <BenchmarkLine row={row} b={b} />
          ) : (
            <p className="text-[11px] text-neutral-500">
              {(BENCHMARK_RATIO_KEYS as readonly string[]).includes(row.key)
                ? "업종 비교: 값이 있는 비교 회사가 부족합니다."
                : "업종 비교: DART 주요계정에 필요한 항목이 없어 제공하지 않습니다."}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** 업종 비교 한 줄 + 분포 막대 */
function BenchmarkLine({ row, b }: { row: RatioRow; b: RatioBenchmark }) {
  const standing = b.topPercent != null ? standingOf(b.topPercent) : null;
  return (
    <div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300">
        {standing && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STANDING[standing].className}`}>
            {STANDING[standing].label}
          </span>
        )}
        <span>
          업종 중앙값 <span className="font-semibold tabular-nums">{formatRatio(b.median, row.unit)}</span>
        </span>
        {b.topPercent != null && (
          <span className="text-neutral-600 dark:text-neutral-400">
            상위 <span className="font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{b.topPercent}%</span> ({b.n}개사 중
            {!row.higherIsBetter && ", 낮을수록 좋음"})
          </span>
        )}
      </p>
      <RangeBar b={b} unit={row.unit} label={row.label} />
    </div>
  );
}

/**
 * 업종 분포 막대: 회색 띠 = 업종 중간 50%(하위 25%~상위 25% 경계), 세로선 = 중앙값, 파란 점 = 이 회사.
 * 이상치에 끌려가지 않도록 범위는 사분위 폭의 0.75배만큼만 넓히고, 회사 값이 밖이면 그 값까지 넓힌다.
 */
function RangeBar({ b, unit, label }: { b: RatioBenchmark; unit: RatioRow["unit"]; label: string }) {
  const iqr = b.p75 - b.p25;
  const pad = iqr > 0 ? iqr * 0.75 : Math.abs(b.median) * 0.2 || 0.01;
  // 부채비율·회전율처럼 관측값이 모두 0 이상이면 축이 음수로 내려가지 않게
  const observedMin = Math.min(b.p25, b.value ?? Infinity);
  const lo = Math.min(observedMin >= 0 ? Math.max(0, b.p25 - pad) : b.p25 - pad, b.value ?? Infinity);
  const hi = Math.max(b.p75 + pad, b.value ?? -Infinity);
  const pct = (x: number) => Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100));
  const describe =
    `${label} 업종 중간 50% ${formatRatio(b.p25, unit)}~${formatRatio(b.p75, unit)}, 중앙값 ${formatRatio(b.median, unit)}` +
    (b.value != null ? `, 이 회사 ${formatRatio(b.value, unit)}` : "");

  return (
    <div className="mt-1.5">
      <div role="img" aria-label={describe} className="relative h-4">
        <div className="absolute inset-x-0 top-1.5 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
        <div
          className="absolute top-1 h-2 rounded-sm bg-neutral-400 dark:bg-neutral-500"
          style={{ left: `${pct(b.p25)}%`, width: `${Math.max(1, pct(b.p75) - pct(b.p25))}%` }}
        />
        <div className="absolute top-0 h-4 w-0.5 -translate-x-1/2 bg-neutral-800 dark:bg-neutral-100" style={{ left: `${pct(b.median)}%` }} />
        {b.value != null && (
          <div
            className="absolute top-0.5 h-3 w-3 -translate-x-1/2 rounded-full bg-blue-600 ring-2 ring-white dark:bg-blue-400 dark:ring-neutral-950"
            style={{ left: `${pct(b.value)}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-neutral-500 tabular-nums">
        <span>{formatRatio(lo, unit)}</span>
        <span>{formatRatio(hi, unit)}</span>
      </div>
    </div>
  );
}

function RangeLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-hidden>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400" /> 이 회사
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-0.5 bg-neutral-800 dark:bg-neutral-100" /> 업종 중앙값
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-4 rounded-sm bg-neutral-400 dark:bg-neutral-500" /> 업종 중간 50%
      </span>
    </p>
  );
}

/** 의미·읽는 법·계산식·업종 비교 (모바일은 탭, 바깥을 누르거나 Esc로 닫힘 — Popover API) */
function RatioPopover({ id, row }: { id: string; row: RatioRow }) {
  const b = row.benchmark;
  return (
    <div
      id={id}
      popover="auto"
      role="tooltip"
      className="m-auto max-h-[80dvh] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-900 shadow-xl backdrop:bg-black/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    >
      <p className="text-base font-bold">{row.label}</p>
      <dl className="mt-3 space-y-3">
        <div>
          <dt className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">의미</dt>
          <dd className="mt-0.5 leading-relaxed">{row.meaning}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">읽는 법</dt>
          <dd className="mt-0.5 leading-relaxed">
            {row.guide} <span className="text-neutral-500">({row.higherIsBetter ? "높을수록 좋음" : "낮을수록 좋음"})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">계산식</dt>
          <dd className="mt-0.5 whitespace-pre-line">{row.formula}</dd>
          {row.formula.includes("평균") && <dd className="text-xs text-neutral-500">평균 = (전기말 + 당기말) ÷ 2</dd>}
        </div>
        {b && (
          <div>
            <dt className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">업종 비교</dt>
            <dd className="mt-0.5 leading-relaxed">
              중앙값 {formatRatio(b.median, row.unit)}, 중간 50%는 {formatRatio(b.p25, row.unit)}~{formatRatio(b.p75, row.unit)}
              {b.topPercent != null && (
                <>
                  . 이 회사는 {b.n}개사 중 상위 {b.topPercent}%
                  {!row.higherIsBetter && "(낮을수록 좋은 지표 기준)"}입니다.
                </>
              )}
            </dd>
          </div>
        )}
      </dl>
    </div>
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
