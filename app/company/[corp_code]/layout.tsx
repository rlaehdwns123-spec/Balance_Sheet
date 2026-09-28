import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CompanyHeader from "@/components/company/CompanyHeader";
import CompanyTabs from "@/components/company/CompanyTabs";
import DartErrorView from "@/components/company/DartErrorView";
import RecordRecent from "@/components/company/RecordRecent";
import { getCompany } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { DartCompany } from "@/lib/dart/types";

type Props = { children: React.ReactNode; params: Promise<{ corp_code: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { corp_code } = await params;
  // getCompany는 캐시되므로 아래 레이아웃 본문과 중복 호출되지 않음
  const company = /^\d{8}$/.test(corp_code) ? await getCompany(corp_code).catch(() => null) : null;
  if (!company) return { title: "기업 정보" };
  const name = company.stock_name || company.corp_name;
  return {
    title: `${name} (${company.stock_code})`,
    description: `${name}의 5개년 재무제표, 재무비율, 추이 차트 — DART 사업보고서 기준`,
  };
}

/** 회사 공통: 기업개황 헤더 + 재무제표/재무비율 탭 */
export default async function CompanyLayout({ children, params }: Props) {
  const { corp_code } = await params;
  if (!/^\d{8}$/.test(corp_code)) notFound();

  let company: DartCompany;
  try {
    company = await getCompany(corp_code);
  } catch (err) {
    if (isDartError(err, "NO_DATA")) notFound();
    if (isDartError(err)) return <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} />;
    throw err;
  }

  return (
    <div className="space-y-4">
      <RecordRecent corpCode={corp_code} name={company.stock_name || company.corp_name} stockCode={company.stock_code} />
      <CompanyHeader company={company} />
      <CompanyTabs corpCode={corp_code} />
      {children}
    </div>
  );
}
