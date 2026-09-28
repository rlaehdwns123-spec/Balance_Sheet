"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearRecent, readRecent, removeRecent, subscribeRecent, type RecentCorp } from "@/lib/recent";

/** 최근 본 기업 목록. 기록이 없거나 저장소를 못 쓰면 아무것도 그리지 않는다 */
export default function RecentCompanies({ title = "최근 본 기업" }: { title?: string }) {
  // 서버 렌더와 일치시키기 위해 마운트 후에 읽는다
  const [items, setItems] = useState<RecentCorp[]>([]);

  useEffect(() => {
    const load = () => setItems(readRecent());
    load();
    return subscribeRecent(load);
  }, []);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="recent-title" className="text-sm font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={clearRecent}
          className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          전체 삭제
        </button>
      </div>
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {items.map((c) => (
          <li key={c.corpCode} className="flex items-center">
            <Link
              href={`/company/${c.corpCode}`}
              className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
            >
              <span className="truncate font-medium">{c.name}</span>
              <span className="ml-3 shrink-0 text-sm text-neutral-600 tabular-nums dark:text-neutral-400">{c.stockCode}</span>
            </Link>
            <button
              type="button"
              onClick={() => removeRecent(c.corpCode)}
              aria-label={`${c.name} 최근 기록에서 삭제`}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
