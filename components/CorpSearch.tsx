"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Corp } from "@/lib/dart/corps";
import { companyPath, type Market } from "@/lib/market";
import type { UsCorp } from "@/lib/sec/types";

const DEBOUNCE_MS = 200;

/** 검색 결과 한 줄: 고유번호(한국)·CIK(미국), 회사명, 종목코드·티커 */
export type SearchItem = { code: string; name: string; sub: string; market: Market };

const toItem = (market: Market, r: Corp | UsCorp): SearchItem =>
  market === "us"
    ? { code: (r as UsCorp).cik, name: (r as UsCorp).name, sub: (r as UsCorp).ticker, market }
    : { code: (r as Corp).corp_code, name: (r as Corp).corp_name, sub: (r as Corp).stock_code, market };

type Props = {
  /** 검색할 시장 (기본 한국). 미국은 티커·영문 회사명 */
  market?: Market;
  /** 선택 시 동작. 없으면 회사 페이지로 이동 */
  onSelect?: (item: SearchItem) => void;
  /** 결과에서 뺄 고유번호·CIK (이미 비교 중인 회사 등) */
  exclude?: string[];
  autoFocus?: boolean;
  placeholder?: string;
};

export default function CorpSearch({
  market = "kr",
  onSelect,
  exclude = [],
  autoFocus = true,
  placeholder = "회사명 또는 종목코드 (예: 삼성전자, 005930)",
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const endpoint = market === "us" ? "/api/us-corps" : "/api/corps";
        const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setResults((body.results as (Corp | UsCorp)[]).map((r) => toItem(market, r)));
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "검색 실패");
      }
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, market]);

  const shown = results.filter((c) => !exclude.includes(c.code));
  const showEmpty = query.trim() && !loading && !error && shown.length === 0;

  function select(item: SearchItem) {
    if (onSelect) {
      onSelect(item);
      setQuery("");
    } else {
      router.push(companyPath(item.code, market));
    }
  }

  return (
    <div>
      <input
        type="search"
        inputMode="search"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && shown[0]) select(shown[0]);
        }}
        placeholder={placeholder}
        aria-label="기업 검색"
        className="h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-base outline-none placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder:text-neutral-500"
      />

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {showEmpty && <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">검색 결과가 없습니다.</p>}

      {shown.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {shown.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                onClick={() => select(item)}
                className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-900 dark:active:bg-neutral-800"
              >
                <span className="truncate font-medium">{item.name}</span>
                <span className="ml-3 shrink-0 text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
                  {item.sub}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
