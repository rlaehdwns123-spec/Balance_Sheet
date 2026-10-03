import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CompanyTabs from "@/components/company/CompanyTabs";
import RecordRecent from "@/components/company/RecordRecent";
import { secErrorView } from "@/components/company/secError";
import UsCompanyHeader from "@/components/company/UsCompanyHeader";
import { companyPath } from "@/lib/market";
import { getUsCompany } from "@/lib/sec/company";
import { padCik } from "@/lib/sec/corps";
import { isSecError } from "@/lib/sec/errors";
import type { SecSubmissions } from "@/lib/sec/types";

type Props = { children: React.ReactNode; params: Promise<{ cik: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { cik } = await params;
  const company = /^\d{10}$/.test(cik) ? await getUsCompany(cik).catch(() => null) : null;
  if (!company) return { title: "기업 정보" };
  const ticker = company.tickers[0];
  return {
    title: ticker ? `${company.name} (${ticker})` : company.name,
    description: `${company.name}의 5개년 재무제표, 재무비율, 추이 차트 — SEC 연간 보고서 기준`,
  };
}

/** 미국 기업 공통: SEC 기업 정보 헤더 + 재무제표 / 비율·분석 / 공시 탭 */
export default async function UsCompanyLayout({ children, params }: Props) {
  const { cik } = await params;
  const padded = padCik(cik);
  if (!padded) notFound();
  if (padded !== cik) redirect(companyPath(padded, "us"));

  let company: SecSubmissions;
  try {
    company = await getUsCompany(cik);
  } catch (err) {
    if (isSecError(err, "NO_DATA")) notFound();
    return secErrorView(err);
  }

  return (
    <div className="space-y-4">
      <RecordRecent corpCode={cik} name={company.name} stockCode={company.tickers[0] ?? ""} market="us" />
      <UsCompanyHeader company={company} />
      <CompanyTabs corpCode={cik} market="us" />
      {children}
    </div>
  );
}
