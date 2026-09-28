import { NextResponse, type NextRequest } from "next/server";
import { getCompany, getRecentAnnualReports } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import { buildStandardYears } from "@/lib/normalize";
import { computeRatios } from "@/lib/ratios";

/** GET /api/financials?corp=00126380&fs=CFS|OFS → 기업개황 + 원본 사업보고서 + 5개년 표준 계정·재무비율 */
export async function GET(req: NextRequest) {
  const corp = req.nextUrl.searchParams.get("corp") ?? "";
  const fs = (req.nextUrl.searchParams.get("fs") ?? "CFS").toUpperCase();

  if (!/^\d{8}$/.test(corp)) {
    return NextResponse.json({ error: "corp는 8자리 고유번호여야 합니다." }, { status: 400 });
  }
  if (fs !== "CFS" && fs !== "OFS") {
    return NextResponse.json({ error: "fs는 CFS 또는 OFS여야 합니다." }, { status: 400 });
  }

  try {
    const [company, reports] = await Promise.all([getCompany(corp), getRecentAnnualReports(corp, fs as FsDiv)]);
    // 비율은 첫 해의 평균잔액·증가율을 위해 6개년으로 계산 후 5개년만 반환
    const sixYears = buildStandardYears(reports, 6);
    return NextResponse.json({
      company,
      fs,
      standard: sixYears.slice(-5),
      ratios: computeRatios(sixYears).slice(-5),
      raw: reports.map((r) => ({ bsnsYear: r.bsnsYear, rceptNo: r.rows[0]?.rcept_no ?? null, rows: r.rows })),
    });
  } catch (err) {
    if (isDartError(err)) {
      const hint = err.kind === "NO_DATA" && fs === "CFS" ? " 연결재무제표가 없는 회사면 fs=OFS로 조회하세요." : "";
      return NextResponse.json(
        { error: err.message + hint, dartStatus: err.status, kind: err.kind },
        { status: err.httpStatus },
      );
    }
    console.error(err);
    return NextResponse.json({ error: "재무제표 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
