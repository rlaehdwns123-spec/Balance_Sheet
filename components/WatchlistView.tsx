"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readWatchlist, removeWatch, subscribeWatchlist, type WatchCorp } from "@/lib/watchlist";

/** 관심기업 목록 (최근 추가 순). 비어 있으면 안내 */
export default function WatchlistView() {
  // 서버 렌더와 일치시키기 위해 마운트 후에 읽는다
  const [items, setItems] = useState<WatchCorp[] | null>(null);

  useEffect(() => {
    const load = () => setItems(readWatchlist());
    load();
    return subscribeWatchlist(load);
  }, []);

  if (items === null) return null;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center dark:border-neutral-700">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">아직 관심기업이 없습니다.</p>
        <p className="mt-1 text-xs text-neutral-500">기업 화면 이름 옆의 별표를 누르면 여기에 모입니다.</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-blue-700 underline dark:text-blue-400">
          기업 검색하기
        </Link>
      </div>
    );
  }

  const compareHref = `/compare?corps=${items
    .slice(0, 3)
    .map((c) => c.corpCode)
    .join(",")}`;

  return (
    <section aria-labelledby="watch-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="watch-title" className="text-sm font-semibold">
          {items.length}개 기업
        </h2>
        {items.length >= 2 && (
          <Link href={compareHref} className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950">
            앞의 {Math.min(3, items.length)}개 비교 →
          </Link>
        )}
      </div>
      <ul className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {items.map((c) => (
          <li key={c.corpCode} className="flex items-center">
            <Link
              href={`/company/${c.corpCode}`}
              className="flex min-w-0 flex-1 items-center justify-between px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
            >
              <span className="flex min-w-0 items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-amber-400" fill="currentColor" aria-hidden>
                  <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
                </svg>
                <span className="truncate font-medium">{c.name}</span>
              </span>
              <span className="ml-3 shrink-0 text-sm text-neutral-600 tabular-nums dark:text-neutral-400">{c.stockCode}</span>
            </Link>
            <button
              type="button"
              onClick={() => removeWatch(c.corpCode)}
              aria-label={`${c.name} 관심기업에서 빼기`}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">이 브라우저에만 저장됩니다. 다른 기기와 동기화되지 않습니다.</p>
    </section>
  );
}
