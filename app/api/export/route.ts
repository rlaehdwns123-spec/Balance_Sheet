import { NextResponse, type NextRequest } from "next/server";
import { analyze } from "@/lib/analysis";
import { riskChecks, type AuditInput } from "@/lib/analysis/risk";
import { getAuditOpinions, getCompany, getRecentAnnualReports } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { parseAuditOpinions } from "@/lib/disclosure";
import { ratiosForExport, statementForExport, type ExportPayload } from "@/lib/export/payload";
import { buildStandardYears } from "@/lib/normalize";
import { buildStatementTable, statementYears } from "@/lib/normalize/statement";
import { computeRatios } from "@/lib/ratios";

const DISPLAY_YEARS = 5;

/**
 * GET /api/export?corp=00126380&fs=CFS|OFS → 엑셀 내보내기용 데이터 (재무제표·재무비율·분석·위험 신호).
 * 파일은 클라이언트에서 exceljs로 만든다. 업종 비교는 넣지 않는다.
 */
export async function GET(req: NextRequest) {
  const corp = req.nextUrl.searchParams.get("corp") ?? "";
  const fs = (req.nextUrl.searchParams.get("fs") ?? "CFS").toUpperCase();
  if (!/^\d{8}$/.test(corp)) return NextResponse.json({ error: "corp는 8자리 고유번호여야 합니다." }, { status: 400 });
  if (fs !== "CFS" && fs !== "OFS") return NextResponse.json({ error: "fs는 CFS 또는 OFS여야 합니다." }, { status: 400 });

  try {
    const [company, reports] = await Promise.all([getCompany(corp), getRecentAnnualReports(corp, fs as FsDiv)]);
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
    const payload: ExportPayload = {
      company: { corpCode: corp, name: company.stock_name || company.corp_name, stockCode: company.stock_code },
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
    return NextResponse.json(payload);
  } catch (err) {
    if (isDartError(err)) {
      return NextResponse.json({ error: err.message, dartStatus: err.status, kind: err.kind }, { status: err.httpStatus });
    }
    console.error(err);
    return NextResponse.json({ error: "내보내기 데이터를 만드는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
