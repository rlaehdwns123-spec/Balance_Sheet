import type { Workbook, Worksheet } from "exceljs";
import { AREA_LABEL, DUPONT_LABEL, type Analysis } from "@/lib/analysis";
import { currencyName, type MetricUnit } from "@/lib/format";
import type { ExportPayload } from "./payload";

/** 엑셀 숫자 서식 (값은 원 단위·소수 비율 그대로 넣고 서식으로 보여 준다) */
const NUM_FMT: Record<MetricUnit | "amount", string> = {
  amount: '#,##0;[Red]-#,##0',
  won: '#,##0;[Red]-#,##0',
  percent: '0.0%;[Red]-0.0%',
  times: '0.00"회"',
  multiple: '0.00"배";[Red]-0.00"배"',
  days: '0"일";[Red]-0"일"',
};

const FILL_SUBTOTAL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F1F1" } } as const;
const FILL_TOTAL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E2E2" } } as const;
const FILL_HEADER = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } } as const;

const STATUS_LABEL = { hit: "해당", clear: "해당 없음", na: "확인 불가" } as const;
const GRADE_LABEL = { good: "양호", neutral: "보통", caution: "주의", na: "데이터 없음" } as const;

/** 시트 맨 위 제목 두 줄 */
function title(ws: Worksheet, p: ExportPayload, heading: string, note: string) {
  ws.addRow([`${p.company.name} (${p.company.stockCode}) — ${heading}`]).font = { bold: true, size: 13 };
  ws.addRow([`${p.basis} · ${note} · ${p.generatedAt.slice(0, 10)} 기준`]).font = {
    color: { argb: "FF6B7280" },
    size: 9,
  };
  ws.addRow([]);
}

/** 금액 단위 안내: 원화는 기존 문구, 그 밖은 "단위: 달러(USD)" */
const unitNote = (p: ExportPayload) => (p.currency === "KRW" ? "단위: 원" : `단위: ${currencyName(p.currency)}(${p.currency})`);

function header(ws: Worksheet, cells: (string | number)[]) {
  const row = ws.addRow(cells);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((c) => {
    c.fill = FILL_HEADER;
    c.alignment = { horizontal: "center" };
  });
  return row;
}

function statementSheet(wb: Workbook, p: ExportPayload, s: ExportPayload["statements"][number]) {
  const ws = wb.addWorksheet(s.title, { views: [{ state: "frozen", xSplit: 1, ySplit: 4 }] });
  title(ws, p, s.title, p.currency === "KRW" ? "단위: 원 (주당이익은 원)" : unitNote(p));
  header(ws, ["계정", ...s.years]);
  for (const r of s.rows) {
    const row = ws.addRow([r.label, ...r.values]);
    row.getCell(1).alignment = { indent: r.level * 2 };
    for (let i = 2; i <= s.years.length + 1; i++) row.getCell(i).numFmt = NUM_FMT.amount;
    if (r.tier !== "item") {
      row.font = { bold: true };
      row.eachCell({ includeEmpty: true }, (c) => (c.fill = r.tier === "total" ? FILL_TOTAL : FILL_SUBTOTAL));
    }
  }
  ws.getColumn(1).width = 36;
  for (let i = 2; i <= s.years.length + 1; i++) ws.getColumn(i).width = 20;
}

function ratioSheet(wb: Workbook, p: ExportPayload) {
  const { years, rows } = p.ratios;
  const ws = wb.addWorksheet("재무비율", { views: [{ state: "frozen", xSplit: 2, ySplit: 4 }] });
  title(ws, p, "재무비율", `평균잔액 = (전기말 + 당기말) ÷ 2${p.currency === "KRW" ? "" : ` · 순차입금 ${unitNote(p)}`}`);
  header(ws, ["구분", "비율", ...years, "계산식"]);
  for (const r of rows) {
    const row = ws.addRow([r.category, r.label, ...r.values, r.formula]);
    for (let i = 3; i < 3 + years.length; i++) row.getCell(i).numFmt = NUM_FMT[r.unit];
    row.getCell(3 + years.length).font = { color: { argb: "FF6B7280" }, size: 9 };
  }
  ws.getColumn(1).width = 8;
  ws.getColumn(2).width = 16;
  for (let i = 3; i < 3 + years.length; i++) ws.getColumn(i).width = 14;
  ws.getColumn(3 + years.length).width = 60;
}

/** 표 한 덩어리: 소제목 + 연도 머리행 + 행들 */
function block(ws: Worksheet, heading: string, years: number[], rows: [string, (number | string | null)[], string?][]) {
  ws.addRow([heading]).font = { bold: true, size: 11 };
  header(ws, ["항목", ...years]);
  for (const [label, values, fmt] of rows) {
    const row = ws.addRow([label, ...values]);
    if (fmt) for (let i = 2; i <= years.length + 1; i++) row.getCell(i).numFmt = fmt;
  }
  ws.addRow([]);
}

function analysisSheet(wb: Workbook, p: ExportPayload) {
  const a: Analysis = p.analysis;
  const ws = wb.addWorksheet("분석");
  title(ws, p, "분석", "정해진 규칙에 따른 자동 진단이며 투자 권유가 아님");

  ws.addRow(["위험 신호 점검 (참고용 지표이며 투자 판단의 근거가 아님)"]).font = { bold: true, size: 11 };
  header(ws, ["항목", "결과", "근거"]);
  for (const r of p.risks) {
    const row = ws.addRow([r.label, r.status === "hit" ? `해당 — ${r.badge}` : STATUS_LABEL[r.status], r.evidence ?? ""]);
    if (r.status === "hit") row.font = { bold: true, color: { argb: "FFB91C1C" } };
  }
  ws.addRow([]);

  ws.addRow([`영역 판정 (${a.latestYear}년)`]).font = { bold: true, size: 11 };
  header(ws, ["영역", "판정", "근거"]);
  for (const area of a.areas)
    ws.addRow([AREA_LABEL[area.area], GRADE_LABEL[area.grade], area.findings.map((f) => f.text).join(" / ")]);
  ws.addRow([]);

  block(ws, "ROE 분해 (듀폰) — ROE = 순이익률 × 총자산회전율 × 재무레버리지", a.years, [
    ["ROE (당기순이익 ÷ 평균 자본총계)", a.dupont.years.map((y) => y.roe), NUM_FMT.percent],
    [DUPONT_LABEL.netMargin, a.dupont.years.map((y) => y.netMargin), NUM_FMT.percent],
    [DUPONT_LABEL.assetTurnover, a.dupont.years.map((y) => y.assetTurnover), NUM_FMT.times],
    [`${DUPONT_LABEL.leverage} (평균 자산 ÷ 평균 자본)`, a.dupont.years.map((y) => y.leverage), NUM_FMT.multiple],
  ]);

  block(ws, p.currency === "KRW" ? "현금흐름 품질" : `현금흐름 품질 (${unitNote(p)})`, a.years, [
    ["당기순이익", a.cash.map((c) => c.netIncome), NUM_FMT.amount],
    ["영업활동현금흐름", a.cash.map((c) => c.operatingCashFlow), NUM_FMT.amount],
    ["영업현금흐름 ÷ 순이익", a.cash.map((c) => c.cashConversion), NUM_FMT.multiple],
    ["유형자산의 취득", a.cash.map((c) => c.capex), NUM_FMT.amount],
    ["잉여현금흐름(FCF)", a.cash.map((c) => c.fcf), NUM_FMT.amount],
    ["FCF 마진 (FCF ÷ 매출액)", a.cash.map((c) => c.fcfMargin), NUM_FMT.percent],
    ["현금흐름 유형", a.cash.map((c) => c.pattern?.label ?? null)],
  ]);

  ws.addRow(["주요 신호"]).font = { bold: true, size: 11 };
  header(ws, ["연도", "신호", ""]);
  for (const s of a.signals) ws.addRow([s.year, s.text]);
  if (a.signals.length === 0) ws.addRow(["", "최근 5년간 눈에 띄는 변화 없음"]);

  ws.getColumn(1).width = 40;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 22;
  for (let i = 4; i <= a.years.length + 1; i++) ws.getColumn(i).width = 18;
}

/** 내보내기 데이터 → 통합문서 (시트: 재무상태표·손익계산서·현금흐름표·재무비율·분석) */
export function buildWorkbook(WorkbookClass: new () => Workbook, p: ExportPayload): Workbook {
  const wb = new WorkbookClass();
  wb.creator = "DART 재무 분석";
  wb.created = new Date(p.generatedAt);
  for (const s of p.statements) statementSheet(wb, p, s);
  ratioSheet(wb, p);
  analysisSheet(wb, p);
  return wb;
}

export const exportFileName = (p: ExportPayload) =>
  `${p.company.name}${p.market === "us" ? "" : `_${p.fs === "CFS" ? "연결" : "별도"}`}_재무분석_${p.generatedAt.slice(0, 10)}.xlsx`.replace(/[\\/:*?"<>|]/g, "_");
