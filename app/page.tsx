import CorpSearch from "@/components/CorpSearch";
import RecentCompanies from "@/components/RecentCompanies";
import Segmented from "@/components/Segmented";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SearchPage({ searchParams }: Props) {
  const market = (await searchParams).m === "us" ? "us" : "kr";

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">기업 검색</h1>
        <Segmented
          label="시장"
          value={market}
          className="mt-3 w-fit"
          options={[
            { value: "kr", label: "한국", href: "/" },
            { value: "us", label: "미국", href: "/?m=us" },
          ]}
        />
        <p className="mt-3 mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {market === "us"
            ? "티커 또는 영문 회사명으로 미국 상장사(해외 기업 포함)를 찾습니다. SEC 공시 기준 연간 데이터입니다."
            : "회사명 또는 종목코드로 상장사를 찾습니다."}
        </p>
        {/* 시장을 바꾸면 검색어·결과를 비운다 (다른 시장의 결과가 남아 잘못된 주소로 가지 않게) */}
        <CorpSearch
          key={market}
          market={market}
          {...(market === "us" ? { placeholder: "티커 또는 영문 회사명 (예: AAPL, Apple)" } : {})}
        />
      </section>
      <RecentCompanies />
    </div>
  );
}
