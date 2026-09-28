"use client";

export type TooltipItem = { key: string; label: string; color: string; value: string; marker?: "bar" | "line" };

/** 차트 공용 툴팁 박스 (텍스트는 잉크색, 계열색은 옆의 마커만) */
export default function ChartTooltip({ title, items }: { title: string; items: TooltipItem[] }) {
  return (
    <div className="min-w-40 rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/95">
      <p className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
              <span
                aria-hidden
                className={item.marker === "line" ? "h-0.5 w-3 rounded-full" : "h-2.5 w-2.5 rounded-sm"}
                style={{ background: item.color }}
              />
              {item.label}
            </span>
            <span className="font-medium text-neutral-900 tabular-nums dark:text-neutral-100">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
