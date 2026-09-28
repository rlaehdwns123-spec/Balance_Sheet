"use client";

import { useSearchParams } from "next/navigation";
import { useChartTheme } from "@/components/charts/theme";
import Segmented from "@/components/Segmented";
import {
  COMPARE_ACCOUNTS,
  COMPARE_RATIOS,
  maxIndices,
  pickDefaultYear,
  type CompareCompany,
  type CompareMetric,
} from "@/lib/compare";
import { formatAmount, formatRatio } from "@/lib/format";
import dynamic from "next/dynamic";

// 차트(Recharts)는 표 아래라 첫 화면에 필요 없음 → 별도 청크로 늦게 로드
const CompareChart = dynamic(() => import("./CompareChart"), {
  ssr: false,
  loading: () => <div className="h-[330px] animate-pulse rounded-lg bg-neutral-100 dark:bg-neutral-900" />,
});

const SECTIONS = [
  { title: "주요 계정", note: "억원", metrics: COMPARE_ACCOUNTS },
  { title: "재무비율", note: null, metrics: COMPARE_RATIOS },
];

function formatMetric(metric: CompareMetric, value: number | null): { text: string; negative: boolean } {
  if (metric.kind === "amount") return formatAmount(value, "eok");
  return { text: formatRatio(value, metric.unit), negative: value != null && value < 0 };
}

export default function CompareView({ companies, fs }: { companies: CompareCompany[]; fs: "CFS" | "OFS" }) {
  const theme = useChartTheme();
  const searchParams = useSearchParams();

  const allYears = [...new Set(companies.flatMap((c) => c.years.map((y) => y.year)))].sort((a, b) => a - b);
  const defaultYear = pickDefaultYear(companies.map((c) => c.years.map((y) => y.year)));
  const requested = Number(searchParams.get("year"));
  const year = allYears.includes(requested) ? requested : defaultYear;
  const failed = companies.filter((c) => c.error);

  // 기준 연도는 표시만 바뀌므로 서버 요청 없이 URL만 갱신
  function setYear(y: number) {
    const params = new URLSearchParams(window.location.search);
    params.set("year", String(y));
    window.history.replaceState(null, "", `?${params.toString().replace(/%2C/g, ",")}`);
  }

  const valuesFor = (metric: CompareMetric) =>
    companies.map((c) => c.years.find((y) => y.year === year)?.values[metric.key] ?? null);

  return (
    <div className="space-y-4">
      {failed.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          {failed.map((c) => (
            <li key={c.corpCode}>
              <span className="font-medium">{c.name}</span>: {errorText(c.error!, fs)}{" "}
              <span className="text-xs text-neutral-500">({c.error!.status})</span>
            </li>
          ))}
        </ul>
      )}

      {year === null ? null : (
        <>
          <div>
            <p className="mb-1.5 text-xs text-neutral-500 dark:text-neutral-400">기준 연도</p>
            <Segmented
              label="기준 연도"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={allYears.map((y) => ({ value: String(y), label: String(y) }))}
            />
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {year}년 · {fs === "CFS" ? "연결" : "별도"} · 사업보고서 기준 ·{" "}
            <mark className="rounded bg-blue-100 px-1 text-inherit dark:bg-blue-900/60">강조</mark> = 회사 중 최댓값
          </p>

          {/* 모바일: 항목별 카드 */}
          <div className="space-y-4 md:hidden">
            {SECTIONS.map((section) => (
              <section key={section.title} className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
                <h2 className="mb-3 font-semibold">
                  {section.title}
                  {section.note && <span className="ml-1 text-xs font-normal text-neutral-500">({section.note})</span>}
                </h2>
                <div className="space-y-3">
                  {section.metrics.map((metric) => {
                    const values = valuesFor(metric);
                    const maxes = maxIndices(values);
                    return (
                      <div key={metric.key}>
                        <p className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">{metric.label}</p>
                        <ul className="space-y-0.5">
                          {companies.map((c, i) => {
                            const isMax = maxes.includes(i);
                            const { text, negative } = formatMetric(metric, values[i]);
                            return (
                              <li
                                key={c.corpCode}
                                className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm ${
                                  isMax ? "bg-blue-100 font-semibold dark:bg-blue-900/60" : ""
                                }`}
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: theme.series[i] }} />
                                  <span className="truncate">{c.name}</span>
                                </span>
                                <span className={`shrink-0 tabular-nums ${negative ? "text-red-600 dark:text-red-400" : ""}`}>
                                  {text}
                                  {isMax && <span className="sr-only"> (최댓값)</span>}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* 데스크톱: 표 */}
          <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 md:block dark:border-neutral-800">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th scope="col" className="w-40 px-4 py-3 text-left text-xs font-medium text-neutral-500">
                    항목
                  </th>
                  {companies.map((c, i) => (
                    <th key={c.corpCode} scope="col" className="px-4 py-3 text-right font-semibold">
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: theme.series[i] }} />
                        {c.name}
                      </span>
                      <span className="block text-xs font-normal text-neutral-500">{c.stockCode}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              {SECTIONS.map((section) => (
                <tbody key={section.title}>
                  <tr className="bg-neutral-50 dark:bg-neutral-900">
                    <th colSpan={companies.length + 1} scope="colgroup" className="px-4 py-2 text-left text-xs font-semibold">
                      {section.title}
                      {section.note && <span className="ml-1 font-normal text-neutral-500">({section.note})</span>}
                    </th>
                  </tr>
                  {section.metrics.map((metric) => {
                    const values = valuesFor(metric);
                    const maxes = maxIndices(values);
                    return (
                      <tr key={metric.key} className="border-t border-neutral-100 dark:border-neutral-900">
                        <th scope="row" className="px-4 py-2 text-left font-normal text-neutral-700 dark:text-neutral-300">
                          {metric.label}
                        </th>
                        {companies.map((c, i) => {
                          const isMax = maxes.includes(i);
                          const { text, negative } = formatMetric(metric, values[i]);
                          return (
                            <td
                              key={c.corpCode}
                              className={`px-4 py-2 text-right ${isMax ? "bg-blue-100 font-semibold dark:bg-blue-900/60" : ""} ${
                                negative ? "text-red-600 dark:text-red-400" : ""
                              }`}
                            >
                              {text}
                              {isMax && <span className="sr-only"> (최댓값)</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>

          <figure className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
            <figcaption className="mb-3">
              <h2 className="font-semibold">추이 비교</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">회사별로 겹쳐 보기 · 기준 연도와 무관하게 5개년</p>
            </figcaption>
            <CompareChart companies={companies.filter((c) => !c.error)} colorIndex={companies.map((c) => c.corpCode)} years={allYears} />
          </figure>
        </>
      )}
    </div>
  );
}

function errorText(error: NonNullable<CompareCompany["error"]>, fs: "CFS" | "OFS"): string {
  switch (error.kind) {
    case "NO_DATA":
      return fs === "CFS" ? "연결재무제표가 없습니다. 별도로 전환해 보세요." : "사업보고서 재무제표가 없습니다.";
    case "RATE_LIMIT":
      return "DART 조회 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.";
    case "MAINTENANCE":
      return "DART 점검 중입니다.";
    default:
      return error.message;
  }
}
