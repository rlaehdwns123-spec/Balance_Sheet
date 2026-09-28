import { Suspense } from "react";
import DartErrorView from "@/components/company/DartErrorView";
import { TableSkeleton } from "@/components/company/Skeletons";
import StatementControls from "@/components/company/StatementControls";
import StatementView from "@/components/company/StatementView";
import { getRecentAnnualReports } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { buildStatementTable, statementYears } from "@/lib/normalize/statement";
import { parseStatementParams } from "@/lib/statementParams";

type Props = {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StatementsPage({ params, searchParams }: Props) {
  const { corp_code } = await params;
  const sp = await searchParams;
  const { fs } = parseStatementParams((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));

  return (
    <div className="space-y-4">
      <StatementControls />
      {/* fs가 바뀌면 key가 바뀌어 표 영역만 스켈레톤으로 전환 */}
      <Suspense key={fs} fallback={<TableSkeleton />}>
        <Statements corpCode={corp_code} fs={fs} />
      </Suspense>
    </div>
  );
}

async function Statements({ corpCode, fs }: { corpCode: string; fs: FsDiv }) {
  try {
    const reports = await getRecentAnnualReports(corpCode, fs);
    const years = statementYears(reports, 5);
    const tables = {
      BS: buildStatementTable(reports, "BS", years),
      IS: buildStatementTable(reports, "IS", years),
      CF: buildStatementTable(reports, "CF", years),
    };
    return <StatementView years={years} tables={tables} />;
  } catch (err) {
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} fs={fs} />;
    throw err;
  }
}
