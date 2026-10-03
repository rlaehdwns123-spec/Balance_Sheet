import Link from "next/link";
import { Suspense } from "react";
import DartErrorView from "@/components/company/DartErrorView";
import { ListSkeleton } from "@/components/company/Skeletons";
import { isCleanOpinion } from "@/lib/analysis/risk";
import { getAuditOpinions, getDisclosures, getDividends, latestAnnual } from "@/lib/dart/client";
import { isDartError } from "@/lib/dart/errors";
import type { FsDiv } from "@/lib/dart/types";
import {
  DISCLOSURE_TYPES,
  parseAuditOpinions,
  parseDisclosures,
  parseDisclosureType,
  parseDividends,
  yyyymmdd,
  type DisclosureType,
} from "@/lib/disclosure";
import { formatAmount, formatRatio, formatWonCompact } from "@/lib/format";
import { parseStatementParams } from "@/lib/statementParams";

type Props = {
  params: Promise<{ corp_code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const card = "rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800";
const caption = "text-xs text-neutral-500 dark:text-neutral-400";

/** 공시 목록 기간: 최근 1년 */
const LIST_DAYS = 365;

/** 배당·공시 탭: 배당 / 감사의견 / 최근 공시. 섹션마다 따로 불러와 하나가 실패해도 나머지는 보인다 */
export default async function DisclosurePage({ params, searchParams }: Props) {
  const { corp_code } = await params;
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const { fs } = parseStatementParams(get);
  const type = parseDisclosureType(get("ty"));
  const page = Math.max(1, Math.min(500, Number(get("page")) || 1));

  return (
    <div className="space-y-4">
      <Suspense fallback={<ListSkeleton title="배당" />}>
        <Dividends corpCode={corp_code} fs={fs} />
      </Suspense>
      <Suspense fallback={<ListSkeleton title="감사의견" />}>
        <Audit corpCode={corp_code} />
      </Suspense>
      <Suspense key={`${type}-${page}`} fallback={<ListSkeleton title="최근 공시" rows={8} />}>
        <Disclosures corpCode={corp_code} type={type} page={page} fs={fs} />
      </Suspense>
    </div>
  );
}

function SectionError({ title, err }: { title: string; err: unknown }) {
  if (!isDartError(err)) throw err;
  return (
    <section className={card}>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <DartErrorView error={{ kind: err.kind, status: err.status, message: err.message }} />
    </section>
  );
}

// ── 배당 ───────────────────────────────────────────────────────────

async function Dividends({ corpCode, fs }: { corpCode: string; fs: FsDiv }) {
  let summary;
  try {
    const latest = await latestAnnual((year) => getDividends(corpCode, year));
    summary = latest ? parseDividends(latest.rows, fs) : null;
  } catch (err) {
    return <SectionError title="배당" err={err} />;
  }

  return (
    <section aria-labelledby="dividend-title" className={card}>
      <h2 id="dividend-title" className="font-semibold">
        배당
      </h2>
      <p className={`mt-0.5 ${caption}`}>사업보고서 &ldquo;배당에 관한 사항&rdquo; · 결산 기준 연도</p>
      {!summary || summary.items.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">최근 사업보고서에 배당 정보가 없습니다.</p>
      ) : (
        <>
          <div className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
            {summary.items.map((item) => (
              <div key={item.key} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium">{item.label}</p>
                <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
                  {[...summary.years].reverse().map((year, i, arr) => {
                    const v = item.values[summary.years.indexOf(year)];
                    const latest = i === arr.length - 1;
                    return (
                      <div key={year} className={`rounded-lg px-0.5 py-1.5 ${latest ? "bg-neutral-100 dark:bg-neutral-800" : ""}`}>
                        <div className="text-[11px] text-neutral-500 tabular-nums dark:text-neutral-400">{year}</div>
                        <div className={`text-sm tabular-nums ${latest ? "font-semibold" : ""} ${v == null ? "text-neutral-400" : ""}`}>
                          {v == null
                            ? "–"
                            : item.unit === "percent"
                              ? formatRatio(v, "percent")
                              : item.key === "total"
                                ? formatWonCompact(v, 1e11)
                                : `${formatAmount(v, "eok", true).text}원`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className={`mt-3 ${caption}`}>
            현금배당성향 = 현금배당금총액 ÷ 당기순이익, 현금배당수익률 = 주당 배당금 ÷ 주가(배당기준일 전 평균). 회사가 공시한 값 그대로입니다.
          </p>
        </>
      )}
    </section>
  );
}

// ── 감사의견 ───────────────────────────────────────────────────────

async function Audit({ corpCode }: { corpCode: string }) {
  let opinions;
  try {
    const latest = await latestAnnual((year) => getAuditOpinions(corpCode, year));
    opinions = latest ? parseAuditOpinions(latest.rows) : [];
  } catch (err) {
    return <SectionError title="감사의견" err={err} />;
  }

  return (
    <section aria-labelledby="audit-title" className={card}>
      <h2 id="audit-title" className="font-semibold">
        감사의견
      </h2>
      <p className={`mt-0.5 ${caption}`}>사업보고서 &ldquo;회계감사인의 명칭 및 감사의견&rdquo;</p>
      {opinions.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">최근 사업보고서에 감사의견 정보가 없습니다.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {opinions.map((o, i) => {
            const clean = isCleanOpinion(o.opinion);
            return (
              <li key={i} className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums">{o.year}년</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      clean
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                        : "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-200"
                    }`}
                  >
                    {o.opinion}
                  </span>
                </div>
                <dl className="mt-2 space-y-1.5 text-xs">
                  <AuditField label="감사인" value={o.auditor || "–"} />
                  {o.emphasis && <AuditField label="강조사항" value={o.emphasis} />}
                  {o.special && <AuditField label="특기사항" value={o.special} />}
                  <AuditField label="핵심감사사항" value={o.keyMatters ?? "없음"} />
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AuditField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <dt className="text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="leading-relaxed whitespace-pre-line text-neutral-800 dark:text-neutral-200">{value}</dd>
    </div>
  );
}

// ── 최근 공시 ──────────────────────────────────────────────────────

async function Disclosures({
  corpCode,
  type,
  page,
  fs,
}: {
  corpCode: string;
  type: DisclosureType | null;
  page: number;
  fs: FsDiv;
}) {
  const now = new Date();
  const end = yyyymmdd(now);
  const begin = yyyymmdd(new Date(now.getTime() - LIST_DAYS * 86400 * 1000));
  let result;
  try {
    result = await getDisclosures(corpCode, begin, end, type, page);
  } catch (err) {
    return <SectionError title="최근 공시" err={err} />;
  }
  const items = parseDisclosures(result.rows);
  const href = (patch: { ty?: DisclosureType | null; page?: number }) => {
    const q = new URLSearchParams();
    if (fs === "OFS") q.set("fs", "OFS");
    const ty = "ty" in patch ? patch.ty : type;
    if (ty) q.set("ty", ty);
    const p = patch.page ?? 1;
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/company/${corpCode}/disclosure${s ? `?${s}` : ""}`;
  };

  return (
    <section aria-labelledby="list-title" className={card}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="list-title" className="font-semibold">
          최근 공시
        </h2>
        <span className={caption}>최근 1년 · {result.totalCount.toLocaleString("ko-KR")}건</span>
      </div>

      <nav aria-label="공시 유형" className="-mx-4 mt-3 overflow-x-auto px-4">
        <ul className="flex w-max gap-1.5">
          {[{ value: null, label: "전체" }, ...DISCLOSURE_TYPES].map((t) => {
            const active = t.value === type;
            return (
              <li key={t.value ?? "all"}>
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

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">해당 기간에 공시가 없습니다.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
          {items.map((d) => (
            <li key={d.rceptNo}>
              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="-mx-2 block rounded-lg px-2 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <p className="text-sm leading-snug font-medium break-keep">
                  {d.corrected && (
                    <span className="mr-1 rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                      정정
                    </span>
                  )}
                  {d.title}
                  <span className="sr-only"> (DART 원문, 새 창)</span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                  {d.date} · {d.filer}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}

      {result.totalPage > 1 && (
        <nav aria-label="공시 목록 페이지" className="mt-3 flex items-center justify-between text-sm">
          {result.pageNo > 1 ? (
            <Link href={href({ page: result.pageNo - 1 })} scroll={false} className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950">
              ← 이전
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-neutral-500 tabular-nums">
            {result.pageNo} / {result.totalPage}
          </span>
          {result.pageNo < result.totalPage ? (
            <Link href={href({ page: result.pageNo + 1 })} scroll={false} className="rounded-lg px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950">
              다음 →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
      <p className={`mt-3 ${caption}`}>제목을 누르면 DART 공시 원문이 새 창으로 열립니다.</p>
    </section>
  );
}
