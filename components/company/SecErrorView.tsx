"use client";

import { useRouter } from "next/navigation";
import type { SecErrorKind } from "@/lib/sec/errors";

export type SecErrorInfo = { kind: SecErrorKind; message: string };

/** 미국 기업(SEC) 조회 오류 */
export default function SecErrorView({ error }: { error: SecErrorInfo }) {
  const router = useRouter();

  let title: string;
  let body: string;
  switch (error.kind) {
    case "NO_DATA":
      title = "데이터 없음";
      body =
        "SEC에 이 회사의 연간 재무 데이터(XBRL)가 없습니다. 펀드·신탁처럼 재무제표를 내지 않는 종목이거나 최근 상장한 회사일 수 있습니다.";
      break;
    case "RATE_LIMIT":
      title = "조회 한도 초과";
      body = "SEC 요청 한도(초당 10건)를 넘었습니다. 잠시 후 다시 시도해 주세요.";
      break;
    case "AUTH":
      title = "SEC 접속 설정 오류";
      body = "서버의 SEC_USER_AGENT 설정(앱 이름과 연락처)을 확인해 주세요.";
      break;
    default:
      title = "불러오지 못했습니다";
      body = error.message;
  }

  return (
    <div role="alert" className="rounded-xl border border-neutral-200 px-4 py-8 text-center dark:border-neutral-800">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
      {error.kind !== "NO_DATA" && error.kind !== "AUTH" && error.kind !== "BAD_REQUEST" && (
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
