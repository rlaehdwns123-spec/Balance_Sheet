import Link from "next/link";
import WatchStar from "@/components/WatchStar";
import type { SecSubmissions } from "@/lib/sec/types";
import ExportButton from "./ExportButton";

/** 미국 기업 헤더: SEC submissions 기준 회사명·티커·결산월·업종(SIC) */
export default function UsCompanyHeader({ company }: { company: SecSubmissions }) {
  const ticker = company.tickers[0] ?? "";
  const fyMonth = Number(company.fiscalYearEnd?.slice(0, 2));
  const edgarUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}`;

  return (
    <section className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <h1 className="truncate text-xl font-bold">{company.name}</h1>
          <WatchStar corpCode={company.cik} name={company.name} stockCode={ticker} market="us" />
        </div>
        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          {company.exchanges[0] ? `미국 ${company.exchanges[0]}` : "미국"}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div className="min-w-0">
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">티커</dt>
          <dd className="truncate tabular-nums">{company.tickers.join(" · ") || "–"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">결산월</dt>
          <dd>{fyMonth >= 1 && fyMonth <= 12 ? `${fyMonth}월` : "–"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">업종</dt>
          <dd className="break-words">
            {company.sicDescription || "–"}
            {company.sic && <span className="ml-1 text-xs text-neutral-400 tabular-nums">(SIC {company.sic})</span>}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/compare?corps=${company.cik}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          다른 회사와 비교 →
        </Link>
        <ExportButton corpCode={company.cik} market="us" />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-xs dark:border-neutral-800">
        <span className="text-neutral-500 tabular-nums dark:text-neutral-400">CIK {company.cik}</span>
        <a
          href={edgarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          SEC EDGAR에서 보기 ↗<span className="sr-only"> (새 창)</span>
        </a>
      </div>
    </section>
  );
}
