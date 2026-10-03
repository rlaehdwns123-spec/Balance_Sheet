import { redirect } from "next/navigation";
import { Suspense } from "react";
import DartErrorView from "@/components/company/DartErrorView";
import { TableSkeleton } from "@/components/company/Skeletons";
import StatementControls from "@/components/company/StatementControls";
import StatementView, { type StatementTables } from "@/components/company/StatementView";
import { getRecentAnnualReports } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { buildStatementTable, statementYears } from "@/lib/normalize/statement";
import { parseStatementParams } from "@/lib/statementParams";

type Props = {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** 재무제표 탭: 사업보고서 5개년 (분기·반기 보고서는 분기 탭) */
export default async function StatementsPage({ params, searchParams }: Props) {
  const { corp_code } = await params;
  const sp = await searchParams;
  const { fs, pd, q } = parseStatementParams((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));
  // 예전 주소(?pd=Q)는 분기 탭의 보고서별 재무제표로
  if (pd === "Q") redirect(`/company/${corp_code}/quarterly?${new URLSearchParams({ v: "report", fs, ...(q ? { q } : {}) })}`);

  return (
    <div className="space-y-4">
      <StatementControls />
      {/* 데이터가 바뀌는 값이 바뀌면 key가 바뀌어 표 영역만 스켈레톤으로 전환 */}
      <Suspense key={fs} fallback={<TableSkeleton />}>
        <Statements corpCode={corp_code} fs={fs} />
      </Suspense>
    </div>
  );
}

async function Statements({ corpCode, fs }: { corpCode: string; fs: FsDiv }) {
  try {
    // 컴포넌트로 렌더하면 아래 catch가 DART 에러를 못 잡으므로 직접 기다린다
    const reports = await getRecentAnnualReports(corpCode, fs);
    const years = statementYears(reports, 5);
    const is = buildStatementTable(reports, "IS", years);
    const classic = buildStatementTable(reports, "IS", years, { classic: true });
    const tables: StatementTables = {
      BS: buildStatementTable(reports, "BS", years),
      IS: { ifrs18: { q: is, cum: is }, classic: { q: classic, cum: classic } },
      CF: buildStatementTable(reports, "CF", years),
    };
    return <StatementView tables={tables} />;
  } catch (err) {
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} fs={fs} />;
    throw err;
  }
}
