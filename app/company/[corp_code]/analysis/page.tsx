import { Suspense } from "react";
import AnalysisView from "@/components/company/AnalysisView";
import DartErrorView from "@/components/company/DartErrorView";
import FsToggle from "@/components/company/FsToggle";
import { AnalysisSkeleton } from "@/components/company/Skeletons";
import { analyze } from "@/lib/analysis";
import { getCompany, getRecentAnnualReports } from "@/lib/dart/client";
import { getIndustryBenchmark } from "@/lib/dart/industryBenchmark";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { buildStandardYears } from "@/lib/normalize";
import { parseStatementParams } from "@/lib/statementParams";

type Props = {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DISPLAY_YEARS = 5;

export default async function AnalysisPage({ params, searchParams }: Props) {
  const { corp_code } = await params;
  const sp = await searchParams;
  const { fs } = parseStatementParams((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));

  return (
    <div className="space-y-4">
      <FsToggle />
      <Suspense key={fs} fallback={<AnalysisSkeleton />}>
        <Analysis corpCode={corp_code} fs={fs} />
      </Suspense>
    </div>
  );
}

async function Analysis({ corpCode, fs }: { corpCode: string; fs: FsDiv }) {
  try {
    const [reports, company] = await Promise.all([getRecentAnnualReports(corpCode, fs), getCompany(corpCode)]);
    // 첫 표시 연도의 평균잔액·증가율을 위해 1년 더 가져와 계산
    const standard = buildStandardYears(reports, DISPLAY_YEARS + 1);
    const latestYear = standard.at(-1)?.year;

    // 업종 비교는 부가 정보 — 실패해도 나머지 진단은 보여준다
    const industry = latestYear
      ? await getIndustryBenchmark(corpCode, company.induty_code, latestYear).catch((err) => {
          console.error("업종 비교 실패", err);
          return null;
        })
      : null;

    if (!latestYear) {
      return <p className="py-10 text-center text-sm text-neutral-500">분석할 재무 데이터가 없습니다.</p>;
    }

    const analysis = analyze(standard, industry?.byRatio ?? null, DISPLAY_YEARS);
    return <AnalysisView analysis={analysis} fs={fs} corpCode={corpCode} industryName={industry?.name ?? null} />;
  } catch (err) {
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} fs={fs} />;
    throw err;
  }
}
