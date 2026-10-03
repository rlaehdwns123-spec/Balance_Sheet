import { Suspense } from "react";
import FinancialComboChart from "@/components/charts/FinancialComboChart";
import RatioTrendChart, { type RatioSeries } from "@/components/charts/RatioTrendChart";
import DartErrorView from "@/components/company/DartErrorView";
import RatioSubNav from "@/components/company/RatioSubNav";
import { ChartSkeleton } from "@/components/company/Skeletons";
import { getRecentAnnualReports } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { buildStandardYears } from "@/lib/normalize";
import { computeRatios, RATIOS } from "@/lib/ratios";
import { parseStatementParams } from "@/lib/statementParams";

type Props = {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DISPLAY_YEARS = 5;

export default async function ChartsPage({ params, searchParams }: Props) {
  const { corp_code } = await params;
  const sp = await searchParams;
  const { fs } = parseStatementParams((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));

  return (
    <div className="space-y-4">
      <RatioSubNav corpCode={corp_code} />
      <Suspense key={fs} fallback={<ChartSkeleton />}>
        <Charts corpCode={corp_code} fs={fs} />
      </Suspense>
    </div>
  );
}

async function Charts({ corpCode, fs }: { corpCode: string; fs: FsDiv }) {
  try {
    const reports = await getRecentAnnualReports(corpCode, fs);
    // 비율은 첫 표시 연도의 평균잔액·증가율을 위해 1년 더 넣어 계산
    const standard = buildStandardYears(reports, DISPLAY_YEARS + 1);
    const ratios = computeRatios(standard).slice(-DISPLAY_YEARS);
    const shown = standard.slice(-DISPLAY_YEARS);
    const years = shown.map((y) => y.year);

    const combo = shown.map((y, i) => ({
      year: y.year,
      revenue: y.revenue,
      operatingIncome: y.operatingIncome,
      netIncome: y.netIncome,
      operatingMargin: ratios[i]?.values.operatingMargin ?? null,
    }));
    // 한 카테고리는 축 하나를 쓰므로 %·회 지표만 (이자보상배율·순차입금·현금전환주기는 비율 화면에서)
    const series: RatioSeries[] = RATIOS.filter((r) => r.unit === "percent" || r.unit === "times").map((r) => ({
      key: r.key,
      label: r.label,
      category: r.category,
      unit: r.unit,
      values: ratios.map((y) => y.values[r.key] ?? null),
    }));
    const basis = `${fs === "CFS" ? "연결" : "별도"} · 사업보고서 기준`;

    return (
      <div className="space-y-4">
        <figure className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <figcaption className="mb-3">
            <h2 className="font-semibold">매출·이익 추이</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              막대 금액(좌축) · 선 영업이익률(우축) · {basis}
            </p>
          </figcaption>
          <FinancialComboChart data={combo} />
        </figure>

        <figure className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <figcaption className="mb-3">
            <h2 className="font-semibold">재무비율 추이</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              카테고리 안에서 최대 3개 지표 · {basis} · 정확한 값은 비율 화면
            </p>
          </figcaption>
          <RatioTrendChart years={years} series={series} />
        </figure>
      </div>
    );
  } catch (err) {
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} fs={fs} />;
    throw err;
  }
}
