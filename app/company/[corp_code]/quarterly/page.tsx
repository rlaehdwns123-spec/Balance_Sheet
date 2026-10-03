import { Suspense } from "react";
import DartErrorView from "@/components/company/DartErrorView";
import FsToggle from "@/components/company/FsToggle";
import QuarterlyView from "@/components/company/QuarterlyView";
import Segmented from "@/components/Segmented";
import { ChartSkeleton, TableSkeleton } from "@/components/company/Skeletons";
import StatementControls from "@/components/company/StatementControls";
import StatementView, { type StatementTables } from "@/components/company/StatementView";
import { getCompany, getInterimReport, getQuarterlyReports } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { previousInterims, type InterimRef } from "@/lib/interim";
import { buildInterimTable } from "@/lib/normalize/statement";
import { buildQuarterly } from "@/lib/quarterly";
import { parseInterimKey, parseStatementParams } from "@/lib/statementParams";

type Props = {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** 분기 탭: 최근 12개 분기 실적(기본) / 분기·반기 보고서별 재무제표(v=report) */
export default async function QuarterlyPage({ params, searchParams }: Props) {
  const { corp_code } = await params;
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const { fs, q } = parseStatementParams(get);
  const report = get("v") === "report";
  const base = `/company/${corp_code}/quarterly`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          label="분기 보기"
          value={report ? "report" : "trend"}
          options={[
            { value: "trend", label: "분기 실적", href: fs === "OFS" ? `${base}?fs=OFS` : base },
            { value: "report", label: "보고서별 재무제표", href: `${base}?v=report${fs === "OFS" ? "&fs=OFS" : ""}` },
          ]}
        />
        {!report && <FsToggle />}
      </div>
      {report ? (
        <>
          <StatementControls />
          <Suspense key={`${fs}-${q}`} fallback={<TableSkeleton />}>
            <InterimStatements corpCode={corp_code} fs={fs} selected={q ? parseInterimKey(q) : null} />
          </Suspense>
        </>
      ) : (
        <Suspense key={fs} fallback={<ChartSkeleton />}>
          <QuarterlyTrend corpCode={corp_code} fs={fs} />
        </Suspense>
      )}
    </div>
  );
}

async function QuarterlyTrend({ corpCode, fs }: { corpCode: string; fs: FsDiv }) {
  try {
    const [{ quarters, reports }, company] = await Promise.all([getQuarterlyReports(corpCode, fs), getCompany(corpCode)]);
    const points = buildQuarterly(reports, quarters);
    return <QuarterlyView points={points} fs={fs} fiscalMonth={Number(company.acc_mt) || 12} />;
  } catch (err) {
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} fs={fs} interim />;
    throw err;
  }
}

/** 최신 분기·반기 보고서(또는 고른 보고서)를 전년 동기와 비교 */
async function InterimStatements({ corpCode, fs, selected }: { corpCode: string; fs: FsDiv; selected: InterimRef | null }) {
  try {
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
  } catch (err) {
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} fs={fs} interim />;
    throw err;
  }
}
