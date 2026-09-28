import type { Metadata } from "next";
import Link from "next/link";
import RecentCompanies from "@/components/RecentCompanies";

export const metadata: Metadata = { title: "재무제표" };

/** 하단 "재무제표" 탭: 회사를 고르기 전 진입점 — 최근 본 기업으로 바로 이동 */
export default function StatementsPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">재무제표</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          최근 본 기업을 고르거나{" "}
          <Link href="/" className="font-medium text-blue-700 underline dark:text-blue-400">
            기업을 검색
          </Link>
          하세요.
        </p>
      </section>
      <RecentCompanies />
    </div>
  );
}
