export type DartErrorKind =
  | "NO_DATA" // 013 조회된 데이터 없음, 014 파일 없음
  | "AUTH" // 010/011/012/901 키·IP 문제, 키 미설정
  | "RATE_LIMIT" // 020 요청 제한 초과, 021 조회 회사 수 초과
  | "BAD_REQUEST" // 100 필드 값 부적절, 101 부적절한 접근
  | "MAINTENANCE" // 800 시스템 점검
  | "UPSTREAM"; // 900 정의되지 않은 오류, HTTP 오류, 기타

const KIND_BY_STATUS: Record<string, DartErrorKind> = {
  "010": "AUTH",
  "011": "AUTH",
  "012": "AUTH",
  "901": "AUTH",
  "013": "NO_DATA",
  "014": "NO_DATA",
  "020": "RATE_LIMIT",
  "021": "RATE_LIMIT",
  "100": "BAD_REQUEST",
  "101": "BAD_REQUEST",
  "800": "MAINTENANCE",
  "900": "UPSTREAM",
};

/** 우리 API 라우트가 돌려줄 HTTP 상태 */
const HTTP_BY_KIND: Record<DartErrorKind, number> = {
  NO_DATA: 404,
  AUTH: 500, // 서버 설정 문제라 클라이언트 탓이 아님
  RATE_LIMIT: 429,
  BAD_REQUEST: 400,
  MAINTENANCE: 503,
  UPSTREAM: 502,
};

export class DartError extends Error {
  readonly kind: DartErrorKind;
  /** DART status 코드 ("013" 등) 또는 "HTTP_xxx" / "NO_KEY" */
  readonly status: string;

  constructor(status: string, message: string) {
    super(message);
    this.name = "DartError";
    this.status = status;
    this.kind = status === "NO_KEY" ? "AUTH" : (KIND_BY_STATUS[status] ?? "UPSTREAM");
  }

  get httpStatus(): number {
    return HTTP_BY_KIND[this.kind];
  }
}

export const isDartError = (err: unknown, kind?: DartErrorKind): err is DartError =>
  err instanceof DartError && (kind === undefined || err.kind === kind);
