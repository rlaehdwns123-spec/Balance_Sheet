"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useChartTheme } from "@/components/charts/theme";
import CorpSearch from "@/components/CorpSearch";
import { MAX_COMPARE, type CompareCorp } from "@/lib/compare";

/** 비교 대상 칩 + 추가 검색. 상태는 URL(?corps=a,b,c)에만 둔다 */
export default function CompareSelector({ selected }: { selected: CompareCorp[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useChartTheme();
  const [adding, setAdding] = useState(selected.length === 0);

  const codes = selected.map((c) => c.corpCode);
  const full = codes.length >= MAX_COMPARE;

  function hrefFor(next: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.length) params.set("corps", next.join(","));
    else params.delete("corps");
    const qs = params.toString();
    return qs ? `/compare?${qs.replace(/%2C/g, ",")}` : "/compare";
  }

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-2" aria-label="비교 중인 회사">
        {selected.map((corp, i) => (
          <li
            key={corp.corpCode}
            className="flex items-center gap-2 rounded-full border border-neutral-200 py-1 pr-1 pl-3 text-sm dark:border-neutral-700"
          >
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: theme.series[i] }} />
            <Link href={`/company/${corp.corpCode}`} className="max-w-36 truncate font-medium hover:underline">
              {corp.name}
            </Link>
            <button
              type="button"
              onClick={() => router.push(hrefFor(codes.filter((c) => c !== corp.corpCode)), { scroll: false })}
              aria-label={`${corp.name} 비교에서 빼기`}
              className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </li>
        ))}
        {!full && !adding && (
          <li>
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex h-9 items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3 text-sm text-neutral-600 hover:border-neutral-400 dark:border-neutral-600 dark:text-neutral-300"
            >
              <span aria-hidden>＋</span> 회사 추가
            </button>
          </li>
        )}
      </ul>

      {full ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">최대 {MAX_COMPARE}개사까지 비교할 수 있습니다.</p>
      ) : (
        adding && (
          <CorpSearch
            autoFocus={selected.length > 0}
            exclude={codes}
            placeholder={`비교할 회사 검색 (${codes.length}/${MAX_COMPARE})`}
            onSelect={(corp) => {
              const next = [...codes, corp.corp_code];
              if (next.length >= MAX_COMPARE) setAdding(false);
              router.push(hrefFor(next), { scroll: false });
            }}
          />
        )
      )}
    </div>
  );
}
