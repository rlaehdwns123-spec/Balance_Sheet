import { Suspense } from "react";
import DartErrorView from "@/components/company/DartErrorView";
import { TableSkeleton } from "@/components/company/Skeletons";
import StatementControls from "@/components/company/StatementControls";
import StatementView, { type StatementTables } from "@/components/company/StatementView";
import { getInterimReport, getRecentAnnualReports } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { previousInterims, type InterimRef } from "@/lib/interim";
import { buildInterimTable, buildStatementTable, statementYears } from "@/lib/normalize/statement";
import { parseInterimKey, parseStatementParams, type Period } from "@/lib/statementParams";

type Props = {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StatementsPage({ params, searchParams }: Props) {
  const { corp_code } = await params;
  const sp = await searchParams;
  const { fs, pd, q } = parseStatementParams((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));

  return (
    <div className="space-y-4">
      <StatementControls />
      {/* 데이터가 바뀌는 값이 바뀌면 key가 바뀌어 표 영역만 스켈레톤으로 전환 */}
      <Suspense key={`${fs}-${pd}-${q}`} fallback={<TableSkeleton />}>
        <Statements corpCode={corp_code} fs={fs} pd={pd} q={q} />
      </Suspense>
    </div>
  );
}

async function Statements({ corpCode, fs, pd, q }: { corpCode: string; fs: FsDiv; pd: Period; q: string | null }) {
  try {
    // 컴포넌트로 렌더하면 아래 catch가 DART 에러를 못 잡으므로 직접 기다린다
    if (pd === "Q") return await interimStatements(corpCode, fs, q ? parseInterimKey(q) : null);

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
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} fs={fs} interim={pd === "Q"} />;
    throw err;
  }
}

/** 최신 분기·반기 보고서(또는 고른 보고서)를 전년 동기와 비교 */
async function interimStatements(corpCode: string, fs: FsDiv, selected: InterimRef | null) {
  // 최신 보고서는 보고서 선택지의 기준이라 다른 보고서를 골라도 먼저 찾는다 (성공 응답은 캐시됨)
  const latest = await getInterimReport(corpCode, fs, null);
  const isLatest = !selected || (selected.year === latest.bsnsYear && selected.code === latest.reprtCode);
  const report = isLatest ? latest : await getInterimReport(corpCode, fs, selected);

  const latestRef: InterimRef = { year: latest.bsnsYear, code: latest.reprtCode };
  const is = (classic: boolean) => ({
    q: buildInterimTable(report, "IS", { basis: "q", classic }),
    cum: buildInterimTable(report, "IS", { basis: "cum", classic }),
  });
  const tables: StatementTables = {
    BS: buildInterimTable(report, "BS"),
    IS: { ifrs18: is(false), classic: is(true) },
    CF: buildInterimTable(report, "CF"),
  };
  return (
    <StatementView
      tables={tables}
      interim={{
        current: { year: report.bsnsYear, code: report.reprtCode },
        options: [latestRef, ...previousInterims(latestRef, 3)],
      }}
    />
  );
}
