import Link from "next/link";
import {
  AREA_LABEL,
  DUPONT_LABEL,
  type Analysis,
  type AreaAssessment,
  type DupontYear,
  type Grade,
  type IndustryPoint,
  type Tone,
} from "@/lib/analysis";
import type { RiskCheck, RiskStatus } from "@/lib/analysis/risk";
import { formatRatio, formatWonCompact } from "@/lib/format";

const GRADE: Record<Grade, { label: string; className: string }> = {
  good: { label: "양호", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" },
  neutral: { label: "보통", className: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" },
  caution: { label: "주의", className: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200" },
  na: { label: "데이터 없음", className: "bg-neutral-50 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500" },
};

const TONE_DOT: Record<Tone, string> = {
  positive: "bg-emerald-500",
  negative: "bg-amber-500",
  neutral: "bg-neutral-400",
};
const TONE_SR: Record<Tone, string> = { positive: "긍정", negative: "부정", neutral: "중립" };

const card = "rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800";
const caption = "text-xs text-neutral-500 dark:text-neutral-400";

export default function AnalysisView({
  analysis,
  risks,
  fs,
  corpCode,
  industryName,
}: {
  analysis: Analysis;
  risks: RiskCheck[];
  fs: "CFS" | "OFS";
  corpCode: string;
  industryName: string | null;
}) {
  const { areas, latestYear } = analysis;
  const good = areas.filter((a) => a.grade === "good").map((a) => AREA_LABEL[a.area]);
  const caution = areas.filter((a) => a.grade === "caution").map((a) => AREA_LABEL[a.area]);

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        <p>
          {latestYear}년 기준 · {fs === "CFS" ? "연결" : "별도"} · 사업보고서 · 정해진 규칙에 따른 자동 진단이며 투자 권유가 아닙니다
        </p>
        <p>
          근거 숫자는{" "}
          <Link href={`/company/${corpCode}/ratios${fs === "OFS" ? "?fs=OFS" : ""}`} className="font-medium text-blue-700 underline dark:text-blue-400">
            비율 화면
          </Link>
          에서 볼 수 있습니다.
        </p>
      </div>

      <RiskSection risks={risks} year={latestYear} />

      <section aria-labelledby="summary-title" className={card}>
        <h2 id="summary-title" className="font-semibold">
          한눈 요약
        </h2>
        <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
          {good.length > 0 && <>강점 <b>{good.join("·")}</b></>}
          {good.length > 0 && caution.length > 0 && " · "}
          {caution.length > 0 && <>주의 <b>{caution.join("·")}</b></>}
          {good.length === 0 && caution.length === 0 && "두드러진 강점이나 주의할 영역이 없습니다."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {areas.map((a) => (
            <AreaCard key={a.area} area={a} />
          ))}
        </div>
      </section>

      <DupontSection analysis={analysis} />
      <CashSection analysis={analysis} />
      <SignalsSection analysis={analysis} />
      <IndustrySection analysis={analysis} industryName={industryName} />
    </div>
  );
}

const RISK_STATUS: Record<RiskStatus, { label: string; className: string }> = {
  hit: { label: "해당", className: "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200" },
  clear: { label: "해당 없음", className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
  na: { label: "확인 불가", className: "bg-neutral-50 text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500" },
};

/** 위험 신호 점검: 해당 항목은 배지 + 근거 수치, 나머지는 접어서 */
function RiskSection({ risks, year }: { risks: RiskCheck[]; year: number }) {
  const hits = risks.filter((r) => r.status === "hit");
  const rest = risks.filter((r) => r.status !== "hit");
  return (
    <section aria-labelledby="risk-title" className={card}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="risk-title" className="font-semibold">
          위험 신호 점검
        </h2>
        <span className={caption}>
          {year}년 · {risks.length}개 항목
        </span>
      </div>
      <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        참고용 지표이며 투자 판단의 근거가 아닙니다.
      </p>

      {hits.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">점검한 항목 중 해당하는 위험 신호가 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {hits.map((r) => (
            <li key={r.key} className="rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-900/60 dark:bg-red-950/30">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white dark:bg-red-500">
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                  <path d="M10 2 1 18h18L10 2zm-.9 6h1.8v5H9.1V8zm0 6.5h1.8v1.8H9.1v-1.8z" />
                </svg>
                {r.badge}
              </span>
              {r.evidence && <p className="mt-1.5 text-xs tabular-nums text-neutral-700 dark:text-neutral-300">{r.evidence}</p>}
            </li>
          ))}
        </ul>
      )}

      <details className="group mt-3">
        <summary className="cursor-pointer text-xs font-medium text-neutral-600 select-none dark:text-neutral-400">
          전체 점검 항목 보기 ({rest.length}개 해당 없음·확인 불가)
        </summary>
        <ul className="mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
          {risks.map((r) => (
            <li key={r.key} className="flex items-start justify-between gap-3 py-2 text-xs">
              <span className="min-w-0">
                <span className="text-neutral-800 dark:text-neutral-200">{r.label}</span>
                {r.evidence && <span className="block tabular-nums text-neutral-500">{r.evidence}</span>}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${RISK_STATUS[r.status].className}`}>
                {RISK_STATUS[r.status].label}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function AreaCard({ area }: { area: AreaAssessment }) {
  const g = GRADE[area.grade];
  return (
    <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{AREA_LABEL[area.area]}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${g.className}`}>{g.label}</span>
      </div>
      {area.findings.length > 0 ? (
        <ToneList items={area.findings} className="mt-2" />
      ) : (
        <p className="mt-2 text-xs text-neutral-500">
          {area.grade === "na" ? "판단에 필요한 항목이 공시되지 않았습니다." : "뚜렷한 강점·약점 신호가 없습니다."}
        </p>
      )}
    </div>
  );
}

function ToneList({ items, className = "" }: { items: { tone: Tone; text: string }[]; className?: string }) {
  return (
    <ul className={`space-y-1 ${className}`}>
      {items.map((f, i) => (
        <li key={i} className="flex gap-2 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[f.tone]}`} aria-hidden />
          <span>
            <span className="sr-only">{TONE_SR[f.tone]}: </span>
            {f.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 라벨 한 줄 + 5개년 값 칸 (재무비율 카드와 같은 배치) */
function YearRow({ label, years, cells, hint }: { label: string; years: number[]; cells: React.ReactNode[]; hint?: string }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="text-sm font-medium">
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-neutral-500">{hint}</span>}
      </p>
      <div className="mt-1.5 grid grid-cols-5 gap-1 text-center">
        {years.map((year, i) => {
          const latest = i === years.length - 1;
          return (
            <div key={year} className={`rounded-lg px-0.5 py-1.5 ${latest ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
              <div className="text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400">{year}</div>
              <div className={`text-sm tabular-nums ${latest ? "font-semibold" : ""}`}>{cells[i]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ratioCell = (v: number | null, unit: "percent" | "times", suffix?: string) =>
  v == null ? (
    <span className="text-neutral-400">–</span>
  ) : (
    <span className={v < 0 ? "text-red-600 dark:text-red-400" : ""}>
      {suffix ? formatRatio(v, unit).replace("회", suffix) : formatRatio(v, unit)}
    </span>
  );

const wonCell = (v: number | null) =>
  v == null ? <span className="text-neutral-400">–</span> : <span className={v < 0 ? "text-red-600 dark:text-red-400" : ""}>{formatWonCompact(v, 1e11)}</span>;

function DupontSection({ analysis }: { analysis: Analysis }) {
  const { years, dupont } = analysis;
  const d = dupont.driver;
  const pick = (key: keyof Omit<DupontYear, "year">) => dupont.years.map((y) => y[key]);

  return (
    <section aria-labelledby="dupont-title" className={card}>
      <h2 id="dupont-title" className="font-semibold">
        ROE 분해
      </h2>
      <p className={`mt-0.5 ${caption}`}>ROE = 순이익률 × 총자산회전율 × 재무레버리지</p>
      {d && (
        <p className="mt-2 text-sm leading-relaxed">
          {analysis.latestYear}년 ROE는 전년보다 <b>{formatRatio(Math.abs(d.roeDelta), "percent").replace("%", "%p")}</b>{" "}
          {d.roeDelta >= 0 ? "올랐고" : "내렸고"}, 가장 큰 요인은 <b>{DUPONT_LABEL[d.component]} {d.direction === "up" ? "상승" : "하락"}</b>
          입니다. {DRIVER_HINT[d.component][d.direction]}
        </p>
      )}
      <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
        <YearRow label="ROE" hint="자본총계 기준" years={years} cells={pick("roe").map((v) => ratioCell(v, "percent"))} />
        <YearRow label="순이익률" hint="얼마나 남기나" years={years} cells={pick("netMargin").map((v) => ratioCell(v, "percent"))} />
        <YearRow label="총자산회전율" hint="자산을 얼마나 굴리나" years={years} cells={pick("assetTurnover").map((v) => ratioCell(v, "times"))} />
        <YearRow label="재무레버리지" hint="평균 자산 ÷ 평균 자본" years={years} cells={pick("leverage").map((v) => ratioCell(v, "times", "배"))} />
      </div>
      <p className={`mt-3 ${caption}`}>
        세 요소의 곱이 정확히 ROE가 되도록 당기순이익 ÷ 평균 자본총계로 계산해, 지배주주 기준인 재무비율 탭의 ROE와 다를 수 있습니다.
      </p>
    </section>
  );
}

const DRIVER_HINT: Record<string, Record<"up" | "down", string>> = {
  netMargin: { up: "같은 매출에서 더 많이 남겼습니다.", down: "매출 대비 이익이 줄었습니다." },
  assetTurnover: { up: "같은 자산으로 매출을 더 많이 냈습니다.", down: "자산에 비해 매출이 덜 늘었습니다." },
  leverage: { up: "부채를 더 활용했습니다 — 수익성 개선과는 구분해서 봐야 합니다.", down: "부채 의존이 줄었습니다." },
};

function CashSection({ analysis }: { analysis: Analysis }) {
  const { years, cash } = analysis;
  const latest = cash[cash.length - 1];
  return (
    <section aria-labelledby="cash-title" className={card}>
      <h2 id="cash-title" className="font-semibold">
        이익의 질 · 현금흐름 유형
      </h2>
      <p className={`mt-0.5 ${caption}`}>순이익이 실제 현금으로 들어오는지, 번 돈을 어디에 쓰는지</p>
      {latest?.pattern && (
        <div className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
          <p className="text-sm">
            <span className="text-neutral-500">{latest.year}년 유형</span> <b>{latest.pattern.label}</b>{" "}
            <span className="font-mono text-xs text-neutral-500" aria-label={`영업 ${latest.pattern.code[0]}, 투자 ${latest.pattern.code[1]}, 재무 ${latest.pattern.code[2]}`}>
              영업{latest.pattern.code[0]} 투자{latest.pattern.code[1]} 재무{latest.pattern.code[2]}
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">{latest.pattern.description}</p>
        </div>
      )}
      <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
        <YearRow label="당기순이익" years={years} cells={cash.map((c) => wonCell(c.netIncome))} />
        <YearRow label="영업활동현금흐름" years={years} cells={cash.map((c) => wonCell(c.operatingCashFlow))} />
        <YearRow
          label="현금 전환"
          hint="영업현금흐름 ÷ 순이익, 1배 이상이면 양호"
          years={years}
          cells={cash.map((c) => ratioCell(c.cashConversion, "times", "배"))}
        />
        <YearRow label="유형자산 취득" hint="설비 투자(CAPEX)" years={years} cells={cash.map((c) => wonCell(c.capex))} />
        <YearRow label="잉여현금흐름(FCF)" hint="영업현금흐름 − 유형자산 취득" years={years} cells={cash.map((c) => wonCell(c.fcf))} />
        <YearRow label="FCF 마진" hint="FCF ÷ 매출액" years={years} cells={cash.map((c) => ratioCell(c.fcfMargin, "percent"))} />
        <YearRow
          label="유형"
          years={years}
          cells={cash.map((c) =>
            c.pattern ? (
              <span className="block text-[11px] leading-tight break-keep" title={c.pattern.description}>
                {c.pattern.label}
              </span>
            ) : (
              <span className="text-neutral-400">–</span>
            ),
          )}
        />
      </div>
      <p className={`mt-3 ${caption}`}>
        순이익이 적자인 해는 현금 전환을 계산하지 않습니다. 유형자산 취득은 현금흐름표의 &ldquo;유형자산의 취득&rdquo;이며 무형자산·리스 투자는
        포함하지 않습니다.
      </p>
    </section>
  );
}

function SignalsSection({ analysis }: { analysis: Analysis }) {
  const byYear = new Map<number, Analysis["signals"]>();
  for (const s of analysis.signals) byYear.set(s.year, [...(byYear.get(s.year) ?? []), s]);

  return (
    <section aria-labelledby="signals-title" className={card}>
      <h2 id="signals-title" className="font-semibold">
        주요 신호
      </h2>
      <p className={`mt-0.5 ${caption}`}>흑자·적자 전환, 급변, 3년 이상 연속 추세</p>
      {byYear.size === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">최근 5년간 눈에 띄는 변화가 없습니다.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {[...byYear].map(([year, list]) => (
            <li key={year} className="flex gap-3">
              <span className="w-10 shrink-0 text-sm font-semibold tabular-nums">{year}</span>
              <ToneList items={list} className="min-w-0 pt-0.5" />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function IndustrySection({ analysis, industryName }: { analysis: Analysis; industryName: string | null }) {
  const ind = analysis.industry;
  return (
    <section aria-labelledby="industry-title" className={card}>
      <h2 id="industry-title" className="font-semibold">
        업종 대비 강점·약점
      </h2>
      {!ind ? (
        <p className="mt-2 text-sm text-neutral-500">업종 비교 데이터를 불러오지 못했습니다.</p>
      ) : (
        <>
          <p className={`mt-0.5 ${caption}`}>
            {industryName ? `${industryName} 상장사` : "같은 업종"} 중 상위 25% 이내는 강점, 하위 25%는 약점 · {analysis.latestYear}년
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <IndustryList title="강점" points={ind.strengths} tone="positive" empty="업종 상위권인 지표가 없습니다." />
            <IndustryList title="약점" points={ind.weaknesses} tone="negative" empty="업종 하위권인 지표가 없습니다." />
          </div>
        </>
      )}
    </section>
  );
}

function IndustryList({ title, points, tone, empty }: { title: string; points: IndustryPoint[]; tone: Tone; empty: string }) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
        <span className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
        {title}
      </h3>
      {points.length === 0 ? (
        <p className="text-xs text-neutral-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {points.map((p) => (
            <li key={p.key} className="flex flex-wrap items-baseline justify-between gap-x-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                {p.label}
                {!p.higherIsBetter && <span className="ml-1 text-[11px] text-neutral-500">낮을수록 좋음</span>}
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
                <b className="text-sm text-neutral-900 dark:text-neutral-100">{formatRatio(p.value, p.unit)}</b> · 중앙값{" "}
                {formatRatio(p.median, p.unit)} · 상위 {p.topPercent}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
