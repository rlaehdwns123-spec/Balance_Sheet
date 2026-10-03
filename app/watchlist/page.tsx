import type { Metadata } from "next";
import RecentCompanies from "@/components/RecentCompanies";
import WatchlistView from "@/components/WatchlistView";

export const metadata: Metadata = { title: "관심기업" };

/** 하단 "관심기업" 탭: 별표한 기업 목록 + 최근 본 기업 */
export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">관심기업</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">별표한 기업을 모아 봅니다.</p>
      </section>
      <WatchlistView />
      <RecentCompanies />
    </div>
  );
}
