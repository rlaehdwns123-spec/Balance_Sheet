import { Suspense } from "react";
import RatioCards, { type RatioRow } from "@/components/company/RatioCards";
import RatioSubNav from "@/components/company/RatioSubNav";
import { secErrorView } from "@/components/company/secError";
import { RatioSkeleton } from "@/components/company/Skeletons";
import { computeRatios, interestBasis, RATIOS } from "@/lib/ratios";
import { RATIO_GUIDE } from "@/lib/ratios/guide";
import { usAmountNote, usBasis } from "@/lib/sec/basis";
import { getUsStandard } from "@/lib/sec/company";

type Props = { params: Promise<{ cik: string }> };

const DISPLAY_YEARS = 5;

export default async function UsRatiosPage({ params }: Props) {
  const { cik } = await params;
  return (
    <div className="space-y-4">
      <RatioSubNav corpCode={cik} market="us" />
      <Suspense fallback={<RatioSkeleton />}>
        <Ratios cik={cik} />
      </Suspense>
    </div>
  );
}

async function Ratios({ cik }: { cik: string }) {
  try {
    const std = await getUsStandard(cik);
    // 첫 표시 연도의 평균잔액·증가율·증감을 위해 1년 더 들어 있다 (normalizeSec 기본 6년)
    const ratioYears = computeRatios(std.years);
    const byYear = new Map(ratioYears.map((r) => [r.year, r.values]));
    const years = ratioYears.slice(-DISPLAY_YEARS).map((r) => r.year);

    // 이자비용이 따로 없어 금융비용으로 대신 계산한 연도 (IFRS 20-F 회사)
    const proxyYears = std.years.filter((y) => years.includes(y.year) && interestBasis(y).proxy).map((y) => y.year);
    const notes: Record<string, string> = {
      netDebt: usAmountNote(std.currency),
      ...(proxyYears.length && {
        interestCoverage:
          proxyYears.length === years.length
            ? "이자비용이 따로 공시되지 않아 금융비용으로 계산했습니다."
            : `${proxyYears.join("·")}년은 이자비용이 따로 없어 금융비용으로 계산했습니다.`,
      }),
    };

    const rows: RatioRow[] = RATIOS.map(({ compute: _compute, ...def }) => ({
      ...def,
      ...RATIO_GUIDE[def.key],
      note: notes[def.key] ?? null,
      values: years.map((y) => byYear.get(y)?.[def.key] ?? null),
      previous: byYear.get(years[0] - 1)?.[def.key] ?? null,
      benchmark: null,
    }));

    return (
      <RatioCards
        years={years}
        rows={rows}
        fs="CFS"
        industry={null}
        basis={usBasis(std)}
        industryNote="미국 기업은 업종 비교를 제공하지 않습니다."
      />
    );
  } catch (err) {
    return secErrorView(err);
  }
}
