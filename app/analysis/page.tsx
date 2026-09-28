import type { Metadata } from "next";
import Link from "next/link";
import RecentCompanies from "@/components/RecentCompanies";

export const metadata: Metadata = { title: "분석" };

/** 하단 "분석" 탭: 회사를 고르기 전 진입점 — 최근 본 기업의 분석 탭으로 바로 이동 */
export default function AnalysisPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">분석</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          수익성·안정성·성장성·현금흐름 진단, ROE 분해, 이익의 질, 주요 신호, 업종 대비 강점·약점을 한 화면에 정리합니다. 최근 본 기업을
          고르거나{" "}
          <Link href="/" className="font-medium text-blue-700 underline dark:text-blue-400">
            기업을 검색
          </Link>
          하세요.
        </p>
      </section>
      <RecentCompanies section="analysis" />
    </div>
  );
}
