/** 최근 본 기업 (브라우저 localStorage). 저장 실패·손상된 값에도 앱이 깨지지 않도록 모두 try/catch */

export type RecentCorp = { corpCode: string; name: string; stockCode: string; viewedAt: number };

const KEY = "dart:recent-corps";
export const MAX_RECENT = 8;
const CHANGE_EVENT = "dart:recent-change";

function isRecentCorp(v: unknown): v is RecentCorp {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.corpCode === "string" &&
    /^\d{8}$/.test(r.corpCode) &&
    typeof r.name === "string" &&
    typeof r.stockCode === "string" &&
    typeof r.viewedAt === "number"
  );
}

/** 저장된 JSON을 검증해 읽는다. 형식이 틀린 항목은 버린다 */
export function parseRecent(raw: string | null): RecentCorp[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isRecentCorp).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** 맨 앞에 추가, 같은 회사는 중복 제거, 최대 개수 유지 */
export function addRecent(list: RecentCorp[], corp: RecentCorp): RecentCorp[] {
  return [corp, ...list.filter((c) => c.corpCode !== corp.corpCode)].slice(0, MAX_RECENT);
}

export function readRecent(): RecentCorp[] {
  try {
    return parseRecent(window.localStorage.getItem(KEY));
  } catch {
    return []; // 사생활 보호 모드·저장소 차단 등
  }
}

function write(list: RecentCorp[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 용량 초과·차단 시 조용히 무시 (기록은 편의 기능)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function recordRecent(corp: Omit<RecentCorp, "viewedAt">) {
  write(addRecent(readRecent(), { ...corp, viewedAt: Date.now() }));
}

export function removeRecent(corpCode: string) {
  write(readRecent().filter((c) => c.corpCode !== corpCode));
}

export function clearRecent() {
  write([]);
}

/** 같은 탭(커스텀 이벤트)과 다른 탭(storage 이벤트)의 변경을 구독 */
export function subscribeRecent(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
