import { describe, expect, it } from "vitest";
import type { AuditOpinionRow, DisclosureRow, DividendRow } from "@/lib/dart/types";
import { dartViewerUrl, parseAuditOpinions, parseDisclosures, parseDisclosureType, parseDividends } from "./disclosure";

const div = (se: string, stock: string, values: [string, string, string]): DividendRow => ({
  rcept_no: "1",
  corp_code: "00126380",
  se,
  stock_knd: stock,
  thstrm: values[0],
  frmtrm: values[1],
  lwfr: values[2],
  stlm_dt: "2025-12-31",
});

// 삼성전자 2025 사업보고서 alotMatter 응답 일부
const DIVIDEND_ROWS: DividendRow[] = [
  div("주당액면가액(원)", "-", ["100", "100", "100"]),
  div("(연결)당기순이익(백만원)", "-", ["44,260,956", "33,621,363", "14,473,401"]),
  div("현금배당금총액(백만원)", "-", ["11,107,906", "9,810,767", "9,809,438"]),
  div("(연결)현금배당성향(%)", "-", ["25.10", "29.20", "67.80"]),
  div("(별도)현금배당성향(%)", "-", ["33.00", "41.60", "38.60"]),
  div("현금배당수익률(%)", "보통주", ["1.50", "2.70", "1.90"]),
  div("현금배당수익률(%)", "우선주", ["1.90", "3.30", "2.40"]),
  div("주식배당수익률(%)", "보통주", ["-", "-", "-"]),
  div("주당 현금배당금(원)", "보통주", ["1,668", "1,446", "1,444"]),
  div("주당 현금배당금(원)", "우선주", ["1,669", "1,447", "1,445"]),
];

describe("parseDividends", () => {
  it("당기·전기·전전기 연도와 주요 항목 (퍼센트는 소수, 총액은 원)", () => {
    const s = parseDividends(DIVIDEND_ROWS, "CFS")!;
    expect(s.years).toEqual([2025, 2024, 2023]);
    const byKey = Object.fromEntries(s.items.map((i) => [i.key, i.values]));
    expect(byKey.dpsCommon).toEqual([1668, 1446, 1444]);
    expect(byKey.dpsPreferred).toEqual([1669, 1447, 1445]);
    expect(byKey.payout[0]).toBeCloseTo(0.251, 12);
    expect(byKey.yieldCommon[1]).toBeCloseTo(0.027, 12);
    expect(byKey.total[0]).toBe(11107906e6);
  });

  it("배당성향은 재무제표 구분에 맞는 줄을 먼저", () => {
    const payout = (fs: "CFS" | "OFS") => parseDividends(DIVIDEND_ROWS, fs)!.items.find((i) => i.key === "payout")!.values[0];
    expect(payout("CFS")).toBeCloseTo(0.251, 12);
    expect(payout("OFS")).toBeCloseTo(0.33, 12);
  });

  it("값이 모두 비어 있는 항목은 빼고, 응답이 비면 null", () => {
    const s = parseDividends([div("주당 현금배당금(원)", "보통주", ["-", "-", "-"]), div("현금배당금총액(백만원)", "-", ["-", "-", "-"])], "CFS")!;
    expect(s.items).toEqual([]);
    expect(parseDividends([], "CFS")).toBeNull();
  });
});

const audit = (period: string, opinion: string, core: string, emphasis = "해당사항 없음"): AuditOpinionRow => ({
  rcept_no: "1",
  corp_code: "00164779",
  bsns_year: `제78기\n(${period})`,
  adtor: "삼정회계법인",
  adt_opinion: opinion,
  adt_reprt_spcmnt_matter: "-",
  emphs_matter: emphasis,
  core_adt_matter: core,
  stlm_dt: "2025-12-31",
});

describe("parseAuditOpinions", () => {
  it("당기·전기·전전기를 결산 연도에서 계산, 최신순", () => {
    const list = parseAuditOpinions([audit("전전기", "적정의견", "-"), audit("당기", "적정의견", "-"), audit("전기", "적정의견", "-")]);
    expect(list.map((a) => a.year)).toEqual([2025, 2024, 2023]);
    expect(list[0]).toMatchObject({ auditor: "삼정회계법인", opinion: "적정의견", emphasis: null, keyMatters: null, special: null });
  });

  it("같은 연도의 연결·별도 두 줄은 합치고 핵심감사사항은 이어 붙인다", () => {
    const list = parseAuditOpinions([
      audit("당기", "적정의견", "가. (별도재무제표) 감가상각"),
      audit("당기", "적정의견", "가. (연결재무제표) 감가상각"),
      audit("전기", "적정의견", "가. 공정가치"),
      audit("전기", "적정의견", "가. 공정가치"),
    ]);
    expect(list).toHaveLength(2);
    expect(list[0].keyMatters).toBe("가. (별도재무제표) 감가상각\n가. (연결재무제표) 감가상각");
    expect(list[1].keyMatters).toBe("가. 공정가치");
  });

  it("의견이 다르면 따로 둔다", () => {
    expect(parseAuditOpinions([audit("당기", "적정의견", "-"), audit("당기", "한정의견", "-")])).toHaveLength(2);
  });
});

describe("parseDisclosures", () => {
  const rows: DisclosureRow[] = [
    {
      corp_code: "00126380",
      corp_name: "삼성전자",
      report_nm: "[기재정정]사업보고서 (2025.12)   ",
      rcept_no: "20260310002820",
      flr_nm: "삼성전자",
      rcept_dt: "20260310",
      rm: "정",
    },
    { corp_code: "00126380", corp_name: "삼성전자", report_nm: "임원ㆍ주요주주특정증권등소유상황보고서", rcept_no: "20261001000251", flr_nm: "나현수", rcept_dt: "20261001", rm: "" },
  ];

  it("제목 공백 정리, 날짜 형식, 정정 표시, 원문 링크", () => {
    const [a, b] = parseDisclosures(rows);
    expect(a).toEqual({
      rceptNo: "20260310002820",
      title: "[기재정정]사업보고서 (2025.12)",
      date: "2026-03-10",
      filer: "삼성전자",
      corrected: true,
      url: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260310002820",
    });
    expect(b.corrected).toBe(false);
    expect(dartViewerUrl("1")).toBe("https://dart.fss.or.kr/dsaf001/main.do?rcpNo=1");
  });

  it("공시유형 쿼리는 알려진 값만", () => {
    expect(parseDisclosureType("A")).toBe("A");
    expect(parseDisclosureType("Z")).toBeNull();
    expect(parseDisclosureType(null)).toBeNull();
  });
});
