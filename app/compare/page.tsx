import type { Metadata } from "next";
import { Suspense } from "react";
import CompareSelector from "@/components/compare/CompareSelector";
import CompareView from "@/components/compare/CompareView";
import FsToggle from "@/components/company/FsToggle";
import { CompareSkeleton } from "@/components/company/Skeletons";
import {
  COMPARE_ACCOUNTS,
  COMPARE_RATIOS,
  parseCorpList,
  type CompareCompany,
  type CompareCorp,
} from "@/lib/compare";
import { getRecentAnnualReports } from "@/lib/dart/client";
import { loadCorps } from "@/lib/dart/corpList";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { buildStandardYears } from "@/lib/normalize";
import { computeRatios } from "@/lib/ratios";
import { parseStatementParams } from "@/lib/statementParams";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = {
  title: "기업 비교",
  description: "최대 3개 상장사의 주요 계정과 재무비율을 기준 연도별로 비교합니다.",
};

const DISPLAY_YEARS = 5;

export default async function ComparePage({ searchParams }: Props) {
  const sp = await searchParams;
  const codes = parseCorpList(sp.corps);
  const { fs } = parseStatementParams((k) => (typeof sp[k] === "string" ? (sp[k] as string) : null));

  // 회사명은 로컬 목록에서 (API 호출 없이). 목록에 없는 코드는 제외
  const corpList = await loadCorps().catch(() => []);
  const selected: CompareCorp[] = codes.flatMap((code) => {
    const corp = corpList.find((c) => c.corp_code === code);
    return corp ? [{ corpCode: code, name: corp.corp_name, stockCode: corp.stock_code }] : [];
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">기업 비교</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">최대 3개사의 주요 계정과 재무비율을 비교합니다.</p>
      </div>

      <CompareSelector selected={selected} />
      {codes.length > selected.length && (
        <p className="text-xs text-neutral-500">목록에 없는 고유번호 {codes.length - selected.length}개는 제외했습니다.</p>
      )}

      {selected.length > 0 && (
        <>
          <FsToggle />
          {/* 회사 구성이나 연결/별도가 바뀌면 비교 영역만 스켈레톤으로 */}
          <Suspense key={`${selected.map((c) => c.corpCode).join(",")}|${fs}`} fallback={<CompareSkeleton />}>
            <CompareData selected={selected} fs={fs} />
          </Suspense>
        </>
      )}
    </div>
  );
}

async function CompareData({ selected, fs }: { selected: CompareCorp[]; fs: FsDiv }) {
  // 회사별 호출을 병렬로. 각 회사가 자기 에러를 잡으므로 한 곳이 실패해도 나머지는 표시된다
  const companies = await Promise.all(selected.map((corp) => loadCompany(corp, fs)));
  return <CompareView companies={companies} fs={fs} />;
}

const METRIC_KEYS = [...COMPARE_ACCOUNTS, ...COMPARE_RATIOS].map((m) => m.key);

async function loadCompany(corp: CompareCorp, fs: FsDiv): Promise<CompareCompany> {
  try {
    const reports = await getRecentAnnualReports(corp.corpCode, fs);
    // 비율의 평균잔액·증가율을 위해 1년 더 넣어 계산
    const standard = buildStandardYears(reports, DISPLAY_YEARS + 1);
    const ratios = new Map(computeRatios(standard).map((r) => [r.year, r.values]));
    const years = standard.slice(-DISPLAY_YEARS).map((y) => {
      const merged: Record<string, number | null> = { ...y, ...ratios.get(y.year) };
      return { year: y.year, values: Object.fromEntries(METRIC_KEYS.map((k) => [k, merged[k] ?? null])) };
    });
    return { ...corp, years, error: null };
  } catch (err) {
    if (isDartError(err)) return { ...corp, years: [], error: { kind: err.kind, status: err.status, message: err.message } };
    console.error(err);
    return { ...corp, years: [], error: { kind: "UPSTREAM", status: "ERR", message: "불러오지 못했습니다." } };
  }
}
