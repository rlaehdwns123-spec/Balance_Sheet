"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { companyPath, type Market } from "@/lib/market";

/**
 * 재무제표 / 비율·분석 / 분기 / 배당·공시 탭. 연결·별도(fs) 선택은 탭을 옮겨도 유지.
 * 비율·분석 탭은 비율·분석·차트 세 화면(하위 선택)을 묶는다.
 * 미국 기업은 연간 데이터만 있고 배당·연결/별도가 없어 재무제표 / 비율·분석 / 공시.
 */
export default function CompanyTabs({ corpCode, market = "kr" }: { corpCode: string; market?: Market }) {
  const pathname = usePathname();
  const fs = useSearchParams().get("fs");
  const query = fs && market === "kr" ? `?fs=${fs}` : "";
  const base = companyPath(corpCode, market);

  const tabs = [
    { href: base, label: "재무제표", match: (p: string) => p === base },
    {
      href: `${base}/ratios`,
      label: "비율·분석",
      match: (p: string) => ["ratios", "analysis", "charts"].some((s) => p.startsWith(`${base}/${s}`)),
    },
    ...(market === "kr"
      ? [
          { href: `${base}/quarterly`, label: "분기", match: (p: string) => p.startsWith(`${base}/quarterly`) },
          { href: `${base}/disclosure`, label: "배당·공시", match: (p: string) => p.startsWith(`${base}/disclosure`) },
        ]
      : [{ href: `${base}/disclosure`, label: "공시", match: (p: string) => p.startsWith(`${base}/disclosure`) }]),
  ];

  return (
    <nav className="flex border-b border-neutral-200 dark:border-neutral-800" aria-label="기업 정보">
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href + query}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex-1 border-b-2 py-2.5 text-center text-sm whitespace-nowrap ${
              active
                ? "border-neutral-900 font-semibold dark:border-white"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
