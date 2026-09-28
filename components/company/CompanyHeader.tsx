import Link from "next/link";
import type { DartCompany } from "@/lib/dart/types";
import { industryName } from "@/lib/ksic";

const MARKET: Record<DartCompany["corp_cls"], string> = { Y: "유가증권", K: "코스닥", N: "코넥스", E: "기타" };

export default function CompanyHeader({ company }: { company: DartCompany }) {
  const industry = industryName(company.induty_code);
  const name = company.stock_name || company.corp_name;

  return (
    <section className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{name}</h1>
          {company.corp_name !== name && (
            <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{company.corp_name}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          {MARKET[company.corp_cls] ?? company.corp_cls}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">종목코드</dt>
          <dd className="tabular-nums">{company.stock_code || "–"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">결산월</dt>
          <dd>{company.acc_mt ? `${Number(company.acc_mt)}월` : "–"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-neutral-500 dark:text-neutral-400">업종</dt>
          <dd className="break-keep" title={`KSIC ${company.induty_code}`}>
            {industry ?? "–"}
            <span className="ml-1 text-xs text-neutral-400 tabular-nums">({company.induty_code})</span>
          </dd>
        </div>
      </dl>

      <Link
        href={`/compare?corps=${company.corp_code}`}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        다른 회사와 비교 →
      </Link>
    </section>
  );
}
