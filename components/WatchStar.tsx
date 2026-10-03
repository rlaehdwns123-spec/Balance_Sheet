"use client";

import { useEffect, useState } from "react";
import type { Market } from "@/lib/market";
import { readWatchlist, subscribeWatchlist, toggleWatch } from "@/lib/watchlist";

/** 관심기업 별표 토글. 저장소를 쓸 수 없으면 눌렀을 때 안내 */
export default function WatchStar({
  corpCode,
  name,
  stockCode,
  market,
}: {
  corpCode: string;
  name: string;
  stockCode: string;
  /** 미국 기업이면 "us" (한국은 생략 — 예전 저장 형식과 같게) */
  market?: Market;
}) {
  // 서버 렌더와 일치시키기 위해 마운트 후에 읽는다
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = () => setOn(readWatchlist().some((c) => c.corpCode === corpCode));
    load();
    return subscribeWatchlist(load);
  }, [corpCode]);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `${name} 관심기업에서 빼기` : `${name} 관심기업에 추가`}
        title={on ? "관심기업에서 빼기" : "관심기업에 추가"}
        onClick={() => setFailed(!toggleWatch({ corpCode, name, stockCode, ...(market ? { market } : {}) }))}
        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-amber-500 dark:hover:bg-neutral-800"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-6 w-6 ${on ? "text-amber-400" : ""}`}
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
        </svg>
      </button>
      {failed && (
        <span role="status" className="absolute top-full right-0 z-20 mt-1 w-48 rounded-lg bg-neutral-900 px-2 py-1.5 text-xs text-white shadow-lg">
          브라우저 저장소를 쓸 수 없어 관심기업을 저장하지 못했습니다.
        </span>
      )}
    </span>
  );
}
