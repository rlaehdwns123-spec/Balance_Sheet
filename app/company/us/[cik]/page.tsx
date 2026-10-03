import { Suspense } from "react";
import { secErrorView } from "@/components/company/secError";
import { TableSkeleton } from "@/components/company/Skeletons";
import StatementControls from "@/components/company/StatementControls";
import StatementView, { type StatementTables } from "@/components/company/StatementView";
import { getUsStandard } from "@/lib/sec/company";
import { buildSecStatements } from "@/lib/sec/statement";

type Props = { params: Promise<{ cik: string }> };

/** 미국 기업 재무제표 탭: SEC 연간 보고서 5개년, 표준 계정 */
export default async function UsStatementsPage({ params }: Props) {
  const { cik } = await params;
  return (
    <div className="space-y-4">
      <StatementControls market="us" />
      <Suspense fallback={<TableSkeleton />}>
        <Statements cik={cik} />
      </Suspense>
    </div>
  );
}

async function Statements({ cik }: { cik: string }) {
  try {
    const std = await getUsStandard(cik);
    const { BS, IS, CF } = buildSecStatements(std);
    // 손익계산서 보기(IFRS 18/기존)·기준(3개월/누적) 구분이 없어 같은 표
    const tables: StatementTables = { BS, IS: { ifrs18: { q: IS, cum: IS }, classic: { q: IS, cum: IS } }, CF };
    return <StatementView tables={tables} us={{ currency: std.currency }} />;
  } catch (err) {
    return secErrorView(err);
  }
}
