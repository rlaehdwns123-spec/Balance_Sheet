import { Suspense } from "react";
import FinancialComboChart from "@/components/charts/FinancialComboChart";
import RatioTrendChart, { type RatioSeries } from "@/components/charts/RatioTrendChart";
import RatioSubNav from "@/components/company/RatioSubNav";
import { secErrorView } from "@/components/company/secError";
import { ChartSkeleton } from "@/components/company/Skeletons";
import { currencyName } from "@/lib/format";
import { computeRatios, RATIOS } from "@/lib/ratios";
import { usBasis } from "@/lib/sec/basis";
import { getUsStandard } from "@/lib/sec/company";

type Props = { params: Promise<{ cik: string }> };

const DISPLAY_YEARS = 5;

export default async function UsChartsPage({ params }: Props) {
  const { cik } = await params;
  return (
    <div className="space-y-4">
      <RatioSubNav corpCode={cik} market="us" />
      <Suspense fallback={<ChartSkeleton />}>
        <Charts cik={cik} />
      </Suspense>
    </div>
  );
}

async function Charts({ cik }: { cik: string }) {
  try {
    const std = await getUsStandard(cik);
    const ratios = computeRatios(std.years).slice(-DISPLAY_YEARS);
    const shown = std.years.slice(-DISPLAY_YEARS);
    const years = shown.map((y) => y.year);

    const combo = shown.map((y, i) => ({
      year: y.year,
      revenue: y.revenue,
      operatingIncome: y.operatingIncome,
      netIncome: y.netIncome,
      operatingMargin: ratios[i]?.values.operatingMargin ?? null,
    }));
    const series: RatioSeries[] = RATIOS.filter((r) => r.unit === "percent" || r.unit === "times").map((r) => ({
      key: r.key,
      label: r.label,
      category: r.category,
      unit: r.unit,
      values: ratios.map((y) => y.values[r.key] ?? null),
    }));
    const basis = usBasis(std);

    return (
      <div className="space-y-4">
        <figure className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <figcaption className="mb-3">
            <h2 className="font-semibold">매출·이익 추이</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              막대 금액(좌축, 억·조 {currencyName(std.currency)}) · 선 영업이익률(우축) · {basis}
            </p>
          </figcaption>
          <FinancialComboChart data={combo} currency={std.currency} />
        </figure>

        <figure className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <figcaption className="mb-3">
            <h2 className="font-semibold">재무비율 추이</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">카테고리 안에서 최대 3개 지표 · {basis} · 정확한 값은 비율 화면</p>
          </figcaption>
          <RatioTrendChart years={years} series={series} />
        </figure>
      </div>
    );
  } catch (err) {
    return secErrorView(err);
  }
}
