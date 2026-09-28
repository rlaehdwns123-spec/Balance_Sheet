import CorpSearch from "@/components/CorpSearch";
import RecentCompanies from "@/components/RecentCompanies";

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-bold">기업 검색</h1>
        <p className="mt-1 mb-4 text-sm text-neutral-600 dark:text-neutral-400">회사명 또는 종목코드로 상장사를 찾습니다.</p>
        <CorpSearch />
      </section>
      <RecentCompanies />
    </div>
  );
}
