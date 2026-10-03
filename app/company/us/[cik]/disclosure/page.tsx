import Link from "next/link";
import { secErrorView } from "@/components/company/secError";
import { companyPath } from "@/lib/market";
import { getUsCompany } from "@/lib/sec/company";
import { FILING_TYPES, pageFilings, parseFilingType, type FilingPage, type FilingType } from "@/lib/sec/filings";

type Props = {
  params: Promise<{ cik: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const card = "rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800";
const caption = "text-xs text-neutral-500 dark:text-neutral-400";

/** 미국 기업 공시 탭: SEC 최근 제출 목록 (배당·감사의견은 없음). 누르면 SEC 원문 */
export default async function UsDisclosurePage({ params, searchParams }: Props) {
  const { cik } = await params;
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const type = parseFilingType(get("ty"));
  const page = Math.max(1, Number(get("page")) || 1);

  let result: FilingPage;
  try {
    // 레이아웃과 같은 요청이라 React cache로 한 번만 불러온다
    const company = await getUsCompany(cik);
    result = pageFilings(cik, company.filings, type, page);
  } catch (err) {
    return secErrorView(err);
  }

  const href = (patch: { ty?: FilingType; page?: number }) => {
    const q = new URLSearchParams();
    const ty = patch.ty ?? type;
    if (ty !== "main") q.set("ty", ty);
    const p = patch.page ?? 1;
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `${companyPath(cik, "us", "disclosure")}${s ? `?${s}` : ""}`;
  };

  return (
    <section aria-labelledby="list-title" className={card}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="list-title" className="font-semibold">
          최근 공시
        </h2>
        <span className={caption}>SEC 최근 제출 · {result.total.toLocaleString("ko-KR")}건</span>
      </div>

      <nav aria-label="공시 유형" className="-mx-4 mt-3 overflow-x-auto px-4">
        <ul className="flex w-max gap-1.5">
          {FILING_TYPES.map((t) => {
            const active = t.value === type;
            return (
              <li key={t.value}>
                <Link
                  href={href({ ty: t.value })}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={`block rounded-full border px-3 py-1 text-xs whitespace-nowrap ${
                    active
                      ? "border-neutral-900 bg-neutral-900 font-semibold text-white dark:border-white dark:bg-white dark:text-neutral-900"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400"
                  }`}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {result.items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">해당 유형의 최근 공시가 없습니다.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
          {result.items.map((f) => (
            <li key={f.accessionNumber}>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="-mx-2 block rounded-lg px-2 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <p className="text-sm leading-snug font-medium break-words">
                  {f.amended && (
                    <span className="mr-1 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                      정정
                    </span>
                  )}
                  <span className="tabular-nums">{f.form}</span>
                  {f.label && <span className="font-normal text-neutral-600 dark:text-neutral-400"> · {f.label}</span>}
                  <span className="sr-only"> (SEC 원문, 새 창)</span>
                </p>
                {f.description && <p className="mt-0.5 text-xs break-words text-neutral-600 dark:text-neutral-400">{f.description}</p>}
                <p className="mt-0.5 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                  제출 {f.filingDate}
                  {f.reportDate && ` · 기준일 ${f.reportDate}`}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 && (
        <nav aria-label="공시 목록 페이지" className="mt-3 flex items-center justify-between text-sm">
          {result.page > 1 ? (
            <Link href={href({ page: result.page - 1 })} scroll={false} className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950">
              ← 이전
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-neutral-500 tabular-nums">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={href({ page: result.page + 1 })} scroll={false} className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950">
              다음 →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      <p className={`mt-3 ${caption}`}>제목을 누르면 SEC 원문이 새 창으로 열립니다. 문서는 영문입니다.</p>
    </section>
  );
}
