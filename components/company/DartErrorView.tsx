"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DartErrorKind } from "@/lib/dart/errors";

export type DartErrorInfo = { kind: DartErrorKind; status: string; message: string };

export default function DartErrorView({ error, fs }: { error: DartErrorInfo; fs?: "CFS" | "OFS" }) {
  const router = useRouter();

  let title: string;
  let body: React.ReactNode;
  switch (error.kind) {
    case "NO_DATA":
      title = "데이터 없음";
      body =
        fs === "CFS" ? (
          <>
            연결재무제표가 없는 회사일 수 있습니다.{" "}
            <Link href="?fs=OFS" className="font-medium text-blue-600 underline dark:text-blue-400">
              별도 재무제표 보기
            </Link>
          </>
        ) : (
          "DART에 사업보고서 재무제표가 없습니다. 신규 상장사이거나 금융업 등 제공되지 않는 회사일 수 있습니다."
        );
      break;
    case "RATE_LIMIT":
      title = "조회 한도 초과";
      body = "DART Open API 조회 한도를 넘었습니다. 한도는 하루 단위로 초기화되니 잠시 후 다시 시도해 주세요.";
      break;
    case "MAINTENANCE":
      title = "DART 점검 중";
      body = "DART 시스템 점검 중입니다. 잠시 후 다시 시도해 주세요.";
      break;
    case "AUTH":
      title = "API 키 오류";
      body = "서버의 DART API 키 설정을 확인해 주세요.";
      break;
    default:
      title = "불러오지 못했습니다";
      body = error.message;
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-neutral-200 px-4 py-8 text-center dark:border-neutral-800"
    >
      <p className="font-semibold">
        {title} <span className="text-sm font-normal text-neutral-400">({error.status})</span>
      </p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
      {error.kind !== "NO_DATA" && error.kind !== "AUTH" && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mt-4 rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
