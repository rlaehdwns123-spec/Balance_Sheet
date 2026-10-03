import { NextResponse, type NextRequest } from "next/server";
import { analyze } from "@/lib/analysis";
import { riskChecks, type AuditInput } from "@/lib/analysis/risk";
import { getAuditOpinions, getCompany, getRecentAnnualReports } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { parseAuditOpinions } from "@/lib/disclosure";
import { ratiosForExport, statementForExport, type ExportPayload } from "@/lib/export/payload";
import { formatMoneyCompact } from "@/lib/format";
import { buildStandardYears } from "@/lib/normalize";
import { buildStatementTable, statementYears, type StatementTable } from "@/lib/normalize/statement";
import { computeRatios } from "@/lib/ratios";
import { usBasis } from "@/lib/sec/basis";
import { getUsCompany, getUsStandard } from "@/lib/sec/company";
import { isSecError } from "@/lib/sec/errors";
import { buildSecStatements } from "@/lib/sec/statement";

const DISPLAY_YEARS = 5;

/**
 * GET /api/export?corp=00126380&fs=CFS|OFS → 엑셀 내보내기용 데이터 (재무제표·재무비율·분석·위험 신호).
 * corp가 10자리 CIK면 미국 기업(SEC, 연결/별도 없음 — fs 무시).
 * 파일은 클라이언트에서 exceljs로 만든다. 업종 비교는 넣지 않는다.
 */
export async function GET(req: NextRequest) {
  const corp = req.nextUrl.searchParams.get("corp") ?? "";
  const fs = (req.nextUrl.searchParams.get("fs") ?? "CFS").toUpperCase();
  if (!/^(\d{8}|\d{10})$/.test(corp))
    return NextResponse.json({ error: "corp는 8자리 고유번호 또는 10자리 CIK여야 합니다." }, { status: 400 });
  if (fs !== "CFS" && fs !== "OFS") return NextResponse.json({ error: "fs는 CFS 또는 OFS여야 합니다." }, { status: 400 });

  try {
    return NextResponse.json(corp.length === 10 ? await usPayload(corp) : await krPayload(corp, fs as FsDiv));
  } catch (err) {
    if (isDartError(err)) {
      return NextResponse.json({ error: err.message, dartStatus: err.status, kind: err.kind }, { status: err.httpStatus });
    }
    if (isSecError(err)) return NextResponse.json({ error: err.message, kind: err.kind }, { status: err.httpStatus });
    console.error(err);
    return NextResponse.json({ error: "내보내기 데이터를 만드는 중 오류가 발생했습니다." }, { status: 500 });
  }
}

async function krPayload(corp: string, fs: FsDiv): Promise<ExportPayload> {
  const [company, reports] = await Promise.all([getCompany(corp), getRecentAnnualReports(corp, fs)]);
  const years = statementYears(reports, DISPLAY_YEARS);
  const standard = buildStandardYears(reports, DISPLAY_YEARS + 1);
  const latestYear = standard.at(-1)?.year;
  const audit: AuditInput = latestYear
    ? await getAuditOpinions(corp, latestYear)
        .then((rows) => parseAuditOpinions(rows).find((a) => a.year === latestYear))
        .then((a) => (a ? { year: latestYear, opinion: a.opinion, auditor: a.auditor } : null))
        .catch(() => null)
    : null;

  const ratioYears = computeRatios(standard);
  const shownYears = ratioYears.slice(-DISPLAY_YEARS).map((r) => r.year);
  return {
    company: { corpCode: corp, name: company.stock_name || company.corp_name, stockCode: company.stock_code },
    market: "kr",
    currency: "KRW",
    basis: `${fs === "CFS" ? "연결" : "별도"} · DART 사업보고서`,
    fs,
    generatedAt: new Date().toISOString(),
    statements: [
      statementForExport("재무상태표", years, buildStatementTable(reports, "BS", years), true),
      statementForExport("손익계산서", years, buildStatementTable(reports, "IS", years, { classic: true }), false),
      statementForExport("현금흐름표", years, buildStatementTable(reports, "CF", years), false),
    ],
    ratios: ratiosForExport(ratioYears, shownYears),
    analysis: analyze(standard, null, DISPLAY_YEARS),
    risks: riskChecks(standard, audit),
  };
}

/** 계정명은 SEC 원문에 한글 표준 계정명을 괄호로 붙인다 */
const withKoreanLabels = (table: StatementTable): StatementTable => ({
  ...table,
  rows: table.rows.map((r) => (r.labelKo ? { ...r, label: `${r.label} (${r.labelKo})` } : r)),
});

async function usPayload(cik: string): Promise<ExportPayload> {
  const [company, std] = await Promise.all([getUsCompany(cik), getUsStandard(cik)]);
  const tables = buildSecStatements(std, DISPLAY_YEARS);
  const years = tables.BS.columns.map((c) => Number(c.key));
  const ratioYears = computeRatios(std.years);
  const shownYears = ratioYears.slice(-DISPLAY_YEARS).map((r) => r.year);
  const endMonth = Number(std.periods[0]?.end.slice(5, 7));
  return {
    company: { corpCode: cik, name: company.name, stockCode: company.tickers[0] ?? "" },
    market: "us",
    currency: std.currency,
    basis: `SEC ${usBasis(std)}${endMonth && endMonth !== 12 ? ` · ${endMonth}월 결산(연도는 회사의 회계연도 표기)` : ""}`,
    fs: "CFS",
    generatedAt: new Date().toISOString(),
    statements: [
      statementForExport("재무상태표", years, withKoreanLabels(tables.BS), true),
      statementForExport("손익계산서", years, withKoreanLabels(tables.IS), false),
      statementForExport("현금흐름표", years, withKoreanLabels(tables.CF), false),
    ],
    ratios: ratiosForExport(ratioYears, shownYears),
    analysis: analyze(std.years, null, DISPLAY_YEARS),
    risks: riskChecks(std.years, null, { money: (v) => formatMoneyCompact(v, std.currency), skip: ["audit"] }),
  };
}
