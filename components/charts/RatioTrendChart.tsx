"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Segmented from "@/components/Segmented";
import { niceTicks } from "@/lib/chartTicks";
import { formatRatio } from "@/lib/format";
import { CATEGORY_LABEL, type RatioCategory, type RatioUnit } from "@/lib/ratios";
import ChartTooltip from "./ChartTooltip";
import { useChartTheme } from "./theme";

export type RatioSeries = {
  key: string;
  label: string;
  category: RatioCategory;
  unit: RatioUnit;
  /** years와 같은 순서 */
  values: (number | null)[];
};

const CATEGORIES: RatioCategory[] = ["profitability", "stability", "growth", "activity"];
const MAX_SELECTED = 3;
const DEFAULT_SELECTED: Record<RatioCategory, string[]> = {
  profitability: ["operatingMargin", "roe"],
  stability: ["debtRatio", "currentRatio"],
  growth: ["revenueGrowth", "operatingIncomeGrowth"],
  activity: ["assetTurnover"],
};

/**
 * 비율 추이 선차트. 카테고리를 고르고 그 안에서 최대 3개 지표를 켜고 끈다.
 * 한 카테고리는 단위가 같아 축이 하나로 충분하다(%와 회를 한 축에 섞지 않음).
 * 색은 선택 순서가 아니라 카테고리 안 지표 위치로 고정 — 켜고 꺼도 다른 선 색이 바뀌지 않는다.
 */
export default function RatioTrendChart({ years, series }: { years: number[]; series: RatioSeries[] }) {
  const theme = useChartTheme();
  const [category, setCategory] = useState<RatioCategory>("profitability");
  const [selected, setSelected] = useState(DEFAULT_SELECTED);

  const inCategory = series.filter((s) => s.category === category);
  const active = inCategory.filter((s) => selected[category].includes(s.key));
  const unit = inCategory[0]?.unit ?? "percent";
  const colorOf = (key: string) => theme.series[inCategory.findIndex((s) => s.key === key) % theme.series.length];

  const data = years.map((year, i) => ({
    year,
    ...Object.fromEntries(active.map((s) => [s.key, s.values[i]])),
  }));

  function toggle(key: string) {
    setSelected((prev) => {
      const cur = prev[category];
      if (cur.includes(key)) return { ...prev, [category]: cur.filter((k) => k !== key) };
      if (cur.length >= MAX_SELECTED) return prev;
      return { ...prev, [category]: [...cur, key] };
    });
  }

  const axis = niceTicks(active.flatMap((s) => s.values).filter((v) => v != null));
  const axisTick = { fill: theme.muted, fontSize: 11 };
  const tickFormat = (v: number) => (unit === "percent" ? `${Number((v * 100).toFixed(1))}%` : `${Number(v.toFixed(2))}회`);

  return (
    <div>
      <Segmented
        label="비율 카테고리"
        value={category}
        onChange={setCategory}
        options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
      />

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`표시할 지표 (최대 ${MAX_SELECTED}개)`}>
        {inCategory.map((s) => {
          const on = selected[category].includes(s.key);
          const disabled = !on && selected[category].length >= MAX_SELECTED;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(s.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-40 ${
                on
                  ? "border-neutral-400 bg-neutral-100 font-medium text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
                  : "border-neutral-200 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
              }`}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: on ? colorOf(s.key) : "transparent", boxShadow: `inset 0 0 0 1.5px ${colorOf(s.key)}` }}
              />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {active.length === 0 ? (
          <p className="flex h-60 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-500 dark:border-neutral-700">
            지표를 하나 이상 선택하세요
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={theme.grid} />
              <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: theme.axis }} padding={{ left: 12, right: 12 }} />
              <YAxis domain={axis.domain} ticks={axis.ticks} width={44} tick={axisTick} tickLine={false} axisLine={false} tickFormatter={tickFormat} />
              <ReferenceLine y={0} stroke={theme.axis} />
              <Tooltip
                cursor={{ stroke: theme.axis, strokeWidth: 1 }}
                content={({ active: on, label }) => {
                  if (!on) return null;
                  const i = years.indexOf(Number(label));
                  return (
                    <ChartTooltip
                      title={`${label}년`}
                      items={active.map((s) => ({
                        key: s.key,
                        label: s.label,
                        color: colorOf(s.key),
                        marker: "line" as const,
                        value: formatRatio(s.values[i] ?? null, s.unit),
                      }))}
                    />
                  );
                }}
              />
              <Legend
                verticalAlign="bottom"
                itemSorter={null}
                iconSize={10}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: theme.inkSecondary }}>{value}</span>}
              />
              {active.map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stroke={colorOf(s.key)}
                  strokeWidth={2}
                  dot={{ r: 4, fill: colorOf(s.key), stroke: theme.surface, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colorOf(s.key), stroke: theme.surface, strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
