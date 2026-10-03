import { Suspense } from "react";
import AnalysisView from "@/components/company/AnalysisView";
import RatioSubNav from "@/components/company/RatioSubNav";
import { secErrorView } from "@/components/company/secError";
import { AnalysisSkeleton } from "@/components/company/Skeletons";
import { analyze } from "@/lib/analysis";
import { riskChecks } from "@/lib/analysis/risk";
import { formatMoneyCompact } from "@/lib/format";
import { getUsStandard } from "@/lib/sec/company";

type Props = { params: Promise<{ cik: string }> };

const DISPLAY_YEARS = 5;

export default async function UsAnalysisPage({ params }: Props) {
  const { cik } = await params;
  return (
    <div className="space-y-4">
      <RatioSubNav corpCode={cik} market="us" />
      <Suspense fallback={<AnalysisSkeleton />}>
        <Analysis cik={cik} />
      </Suspense>
    </div>
  );
}

async function Analysis({ cik }: { cik: string }) {
  try {
    const std = await getUsStandard(cik);
    if (!std.years.length) {
      return <p className="py-10 text-center text-sm text-neutral-500">분석할 재무 데이터가 없습니다.</p>;
    }
    // 업종 비교 없음, 감사의견은 미국 기업에서 점검하지 않는다
    const analysis = analyze(std.years, null, DISPLAY_YEARS);
    const risks = riskChecks(std.years, null, { money: (v) => formatMoneyCompact(v, std.currency), skip: ["audit"] });
    return <AnalysisView analysis={analysis} risks={risks} fs="CFS" corpCode={cik} industryName={null} us={{ currency: std.currency }} />;
  } catch (err) {
    return secErrorView(err);
  }
}
