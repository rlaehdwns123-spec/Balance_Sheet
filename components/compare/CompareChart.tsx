"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartTooltip from "@/components/charts/ChartTooltip";
import { useChartTheme } from "@/components/charts/theme";
import Segmented from "@/components/Segmented";
import { niceTicks } from "@/lib/chartTicks";
import type { CompareCompany } from "@/lib/compare";
import { currencyName, formatAmount, formatRatio, formatWonCompact } from "@/lib/format";

type Metric = "revenue" | "operatingMargin";

/**
 * 회사별 매출(막대) 또는 영업이익률(선)을 한 차트에 겹쳐 본다.
 * 두 지표를 한 차트에 넣으면 이중축 + 계열 6개가 되어 전환형으로 나눴다.
 * colorIndex: 전체 비교 목록 순서 — 실패한 회사가 빠져도 나머지 색이 바뀌지 않게.
 * currency: 회사들의 공통 통화. null이면(통화가 섞임) 매출액은 비교하지 않고 영업이익률만.
 */
export default function CompareChart({
  companies,
  colorIndex,
  years,
  currency = "KRW",
}: {
  companies: CompareCompany[];
  colorIndex: string[];
  years: number[];
  currency?: string | null;
}) {
  const theme = useChartTheme();
  const [picked, setMetric] = useState<Metric>("revenue");
  const metric: Metric = currency === null ? "operatingMargin" : picked;
  const unitSuffix = !currency || currency === "KRW" ? "억" : `억 ${currencyName(currency)}`;

  const colorOf = (corpCode: string) => theme.series[colorIndex.indexOf(corpCode)];
  const valueOf = (c: CompareCompany, year: number) => c.years.find((y) => y.year === year)?.values[metric] ?? null;
  const data = years.map((year) => ({
    year,
    ...Object.fromEntries(companies.map((c) => [c.corpCode, valueOf(c, year)])),
  }));
  const axis = niceTicks(companies.flatMap((c) => years.map((y) => valueOf(c, y))).filter((v) => v != null));
  const step = axis.ticks[1] - axis.ticks[0];
  const format = (v: number | null) =>
    metric === "revenue" ? (v == null ? "–" : `${formatAmount(v, "eok").text}${unitSuffix}`) : formatRatio(v, "percent");

  const axisTick = { fill: theme.muted, fontSize: 11 };
  const common = {
    xAxis: <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: theme.axis }} />,
    yAxis: (
      <YAxis
        domain={axis.domain}
        ticks={axis.ticks}
        width={44}
        tick={axisTick}
        tickLine={false}
        axisLine={false}
        tickFormatter={(v: number) => (metric === "revenue" ? formatWonCompact(v, step) : `${Number((v * 100).toFixed(1))}%`)}
      />
    ),
    tooltip: (
      <Tooltip
        cursor={metric === "revenue" ? { fill: theme.cursor } : { stroke: theme.axis, strokeWidth: 1 }}
        content={({ active, label }) =>
          active ? (
            <ChartTooltip
              title={`${label}년 ${metric === "revenue" ? "매출액" : "영업이익률"}`}
              items={companies.map((c) => ({
                key: c.corpCode,
                label: c.name,
                color: colorOf(c.corpCode),
                marker: metric === "revenue" ? "bar" : "line",
                value: format(valueOf(c, Number(label))),
              }))}
            />
          ) : null
        }
      />
    ),
    legend: (
      <Legend
        verticalAlign="bottom"
        itemSorter={null}
        iconSize={10}
        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        formatter={(value) => <span style={{ color: theme.inkSecondary }}>{value}</span>}
      />
    ),
  };

  return (
    <div>
      {currency !== null && (
        <Segmented
          label="비교 지표"
          className="mb-3 w-fit"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "revenue", label: "매출액" },
            { value: "operatingMargin", label: "영업이익률" },
          ]}
        />
      )}
      {companies.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">표시할 데이터가 없습니다.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          {metric === "revenue" ? (
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke={theme.grid} />
              {common.xAxis}
              {common.yAxis}
              <ReferenceLine y={0} stroke={theme.axis} />
              {common.tooltip}
              {common.legend}
              {companies.map((c) => (
                <Bar
                  key={c.corpCode}
                  dataKey={c.corpCode}
                  name={c.name}
                  fill={colorOf(c.corpCode)}
                  maxBarSize={16}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={theme.grid} />
              {common.xAxis}
              {common.yAxis}
              <ReferenceLine y={0} stroke={theme.axis} />
              {common.tooltip}
              {common.legend}
              {companies.map((c) => (
                <Line
                  key={c.corpCode}
                  dataKey={c.corpCode}
                  name={c.name}
                  stroke={colorOf(c.corpCode)}
                  strokeWidth={2}
                  dot={{ r: 4, fill: colorOf(c.corpCode), stroke: theme.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colorOf(c.corpCode), stroke: theme.surface, strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
