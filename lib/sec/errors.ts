export type SecErrorKind =
  | "NO_DATA" // 404 — 없는 CIK, XBRL 재무 데이터가 없는 회사
  | "AUTH" // 403 또는 SEC_USER_AGENT 미설정 — User-Agent 규칙 위반으로 차단
  | "RATE_LIMIT" // 429 — 초당 10건 초과
  | "BAD_REQUEST" // CIK 형식 오류
  | "UPSTREAM"; // 그 밖의 HTTP 오류

const HTTP_BY_KIND: Record<SecErrorKind, number> = {
  NO_DATA: 404,
  AUTH: 500, // 서버 설정 문제라 클라이언트 탓이 아님
  RATE_LIMIT: 429,
  BAD_REQUEST: 400,
  UPSTREAM: 502,
};

export class SecError extends Error {
  readonly kind: SecErrorKind;

  constructor(kind: SecErrorKind, message: string) {
    super(message);
    this.name = "SecError";
    this.kind = kind;
  }

  get httpStatus(): number {
    return HTTP_BY_KIND[this.kind];
  }

  static fromHttp(status: number): SecError {
    if (status === 404) return new SecError("NO_DATA", "SEC에 해당 회사 데이터가 없습니다.");
    if (status === 403) return new SecError("AUTH", "SEC가 요청을 거부했습니다 (User-Agent 확인 필요, HTTP 403).");
    if (status === 429) return new SecError("RATE_LIMIT", "SEC 요청 한도를 초과했습니다 (HTTP 429).");
    return new SecError("UPSTREAM", `SEC 서버 응답 오류 (HTTP ${status})`);
  }
}

export const isSecError = (err: unknown, kind?: SecErrorKind): err is SecError =>
  err instanceof SecError && (kind === undefined || err.kind === kind);
