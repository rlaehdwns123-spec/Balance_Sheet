import "server-only";
import { cache } from "react";
import { normalizeSec, type SecStandard } from "@/lib/normalize/sec";
import { getCompanyFacts, getSubmissions } from "./client";
import { SecError } from "./errors";
import type { SecSubmissions } from "./types";

/**
 * 미국 기업 화면용 데이터. React cache로 한 요청 안의 중복 호출(레이아웃·메타데이터·페이지)을 합친다
 * (unstable_cache는 캐시가 비어 있을 때 동시에 들어온 호출을 합치지 않는다).
 */
export const getUsCompany = cache((cik: string): Promise<SecSubmissions> => getSubmissions(cik));

/** 연도별 표준 계정 (화면 5년 + 비율 계산용 1년). 연간 XBRL 재무 데이터가 없으면 NO_DATA */
export const getUsStandard = cache(async (cik: string): Promise<SecStandard> => {
  const std = normalizeSec(await getCompanyFacts(cik));
  if (!std) throw new SecError("NO_DATA", "SEC에 연간 재무 데이터(XBRL)가 없습니다.");
  return std;
});
