import { Suspense } from "react";
import DartErrorView from "@/components/company/DartErrorView";
import FsToggle from "@/components/company/FsToggle";
import RatioCards, { type RatioRow } from "@/components/company/RatioCards";
import { RatioSkeleton } from "@/components/company/Skeletons";
import { getCompany, getRecentAnnualReports } from "@/lib/dart/client";
import { getIndustryBenchmark } from "@/lib/dart/industryBenchmark";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { buildStandardYears } from "@/lib/normalize";
import { computeRatios, RATIOS } from "@/lib/ratios";
import { RATIO_GUIDE } from "@/lib/ratios/guide";
import { parseStatementParams } from "@/lib/statementParams";

type Props = {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DISPLAY_YEARS = 5;

export default async function RatiosPage({ params, searchParams }: Props) {
  const { corp_code } = await params;
  const sp = await searchParams;
  const { fs } = parseStatementParams((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));

  return (
    <div className="space-y-4">
      <FsToggle />
      <Suspense key={fs} fallback={<RatioSkeleton />}>
        <Ratios corpCode={corp_code} fs={fs} />
      </Suspense>
    </div>
  );
}

async function Ratios({ corpCode, fs }: { corpCode: string; fs: FsDiv }) {
  try {
    const [reports, company] = await Promise.all([getRecentAnnualReports(corpCode, fs), getCompany(corpCode)]);
    // 첫 표시 연도의 평균잔액·증가율·증감을 위해 1년 더 가져와 계산
    const ratioYears = computeRatios(buildStandardYears(reports, DISPLAY_YEARS + 1));
    const byYear = new Map(ratioYears.map((r) => [r.year, r.values]));
    const years = ratioYears.slice(-DISPLAY_YEARS).map((r) => r.year);

    // 업종 비교는 부가 정보 — 실패해도(한도 초과 등) 비율 자체는 보여준다
    const industry = years.length
      ? await getIndustryBenchmark(corpCode, company.induty_code, years[years.length - 1]).catch((err) => {
          console.error("업종 비교 실패", err);
          return null;
        })
      : null;

    const rows: RatioRow[] = RATIOS.map(({ compute: _compute, ...def }) => ({
      ...def,
      ...RATIO_GUIDE[def.key],
      values: years.map((y) => byYear.get(y)?.[def.key] ?? null),
      previous: byYear.get(years[0] - 1)?.[def.key] ?? null,
      benchmark: industry?.byRatio[def.key] ?? null,
    }));

    const industryMeta = industry && { name: industry.name, code: industry.code, year: industry.year, companies: industry.companies };
    return <RatioCards years={years} rows={rows} fs={fs} industry={industryMeta} />;
  } catch (err) {
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} fs={fs} />;
    throw err;
  }
}
