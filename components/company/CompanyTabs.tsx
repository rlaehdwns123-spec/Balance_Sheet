"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/** 재무제표 / 재무비율 / 차트 / 분석 탭. 연결·별도(fs) 선택은 탭을 옮겨도 유지 */
export default function CompanyTabs({ corpCode }: { corpCode: string }) {
  const pathname = usePathname();
  const fs = useSearchParams().get("fs");
  const query = fs ? `?fs=${fs}` : "";

  const tabs = [
    { href: `/company/${corpCode}`, label: "재무제표" },
    { href: `/company/${corpCode}/ratios`, label: "재무비율" },
    { href: `/company/${corpCode}/charts`, label: "차트" },
    { href: `/company/${corpCode}/analysis`, label: "분석" },
  ];

  return (
    <nav className="flex border-b border-neutral-200 dark:border-neutral-800" aria-label="기업 정보">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href + query}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex-1 border-b-2 py-2.5 text-center text-sm ${
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
