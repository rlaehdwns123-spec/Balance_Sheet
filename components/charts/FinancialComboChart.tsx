"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { alignedTicks, niceTicks } from "@/lib/chartTicks";
import { formatAmount, formatRatio, formatWonCompact } from "@/lib/format";
import ChartTooltip from "./ChartTooltip";
import { useChartTheme } from "./theme";

export type ComboPoint = {
  year: number;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  /** 영업이익률 (소수, 0.131 = 13.1%) */
  operatingMargin: number | null;
};

const BARS = [
  { key: "revenue", label: "매출액", slot: 0 },
  { key: "operatingIncome", label: "영업이익", slot: 1 },
  { key: "netIncome", label: "당기순이익", slot: 2 },
] as const;

const MARGIN_LABEL = "영업이익률(우축)";

/** 매출·영업이익·순이익 막대(좌축, 원) + 영업이익률 선(우축, %) */
export default function FinancialComboChart({ data }: { data: ComboPoint[] }) {
  const theme = useChartTheme();
  const amounts = data.flatMap((d) => [d.revenue, d.operatingIncome, d.netIncome]).filter((v) => v != null);
  const margins = data.map((d) => d.operatingMargin).filter((v) => v != null);
  // 우축은 좌축과 칸 수·0선을 맞춰 격자선 하나로 두 축을 읽게 한다
  const amountAxis = niceTicks(amounts);
  const marginAxis = alignedTicks(amountAxis, margins);
  const amountStep = amountAxis.ticks[1] - amountAxis.ticks[0];
  const axisTick = { fill: theme.muted, fontSize: 11 };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={2} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: theme.axis }} />
        <YAxis
          yAxisId="amount"
          domain={amountAxis.domain}
          ticks={amountAxis.ticks}
          width={44}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatWonCompact(v, amountStep)}
        />
        <YAxis
          yAxisId="margin"
          orientation="right"
          domain={marginAxis.domain}
          ticks={marginAxis.ticks}
          width={40}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
        />
        <ReferenceLine yAxisId="amount" y={0} stroke={theme.axis} />
        <Tooltip
          cursor={{ fill: theme.cursor }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <ChartTooltip
                title={`${label}년`}
                items={[
                  ...BARS.map((b) => {
                    const v = payload[0].payload[b.key] as number | null;
                    return {
                      key: b.key,
                      label: b.label,
                      color: theme.series[b.slot],
                      value: v == null ? "–" : `${formatAmount(v, "eok").text}억`,
                    };
                  }),
                  {
                    key: "margin",
                    label: "영업이익률",
                    color: theme.inkSecondary,
                    marker: "line" as const,
                    value: formatRatio(payload[0].payload.operatingMargin, "percent"),
                  },
                ]}
              />
            ) : null
          }
        />
        <Legend
          verticalAlign="bottom"
          itemSorter={null}
          iconSize={10}
          wrapperStyle={{ fontSize: 12, paddingTop: 8, color: theme.inkSecondary }}
          formatter={(value) => <span style={{ color: theme.inkSecondary }}>{value}</span>}
        />
        {BARS.map((b) => (
          <Bar
            key={b.key}
            yAxisId="amount"
            dataKey={b.key}
            name={b.label}
            fill={theme.series[b.slot]}
            maxBarSize={16}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
        <Line
          yAxisId="margin"
          dataKey="operatingMargin"
          name={MARGIN_LABEL}
          type="linear"
          stroke={theme.inkSecondary}
          strokeWidth={2}
          dot={{ r: 4, fill: theme.inkSecondary, stroke: theme.surface, strokeWidth: 2 }}
          activeDot={{ r: 5, fill: theme.inkSecondary, stroke: theme.surface, strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
