/** 관심기업 (브라우저 localStorage). 저장 실패·손상된 값에도 앱이 깨지지 않도록 모두 try/catch */

export type WatchCorp = { corpCode: string; name: string; stockCode: string; addedAt: number };

const KEY = "dart:watchlist";
export const MAX_WATCH = 50;
const CHANGE_EVENT = "dart:watchlist-change";

function isWatchCorp(v: unknown): v is WatchCorp {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.corpCode === "string" &&
    /^\d{8}$/.test(r.corpCode) &&
    typeof r.name === "string" &&
    typeof r.stockCode === "string" &&
    typeof r.addedAt === "number"
  );
}

/** 저장된 JSON을 검증해 읽는다. 형식이 틀린 항목·중복은 버린다 */
export function parseWatchlist(raw: string | null): WatchCorp[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .filter(isWatchCorp)
      .filter((c) => !seen.has(c.corpCode) && !!seen.add(c.corpCode))
      .slice(0, MAX_WATCH);
  } catch {
    return [];
  }
}

/** 있으면 빼고 없으면 맨 앞에 추가 (최대 개수 유지) */
export function toggleIn(list: WatchCorp[], corp: Omit<WatchCorp, "addedAt">, now: number): WatchCorp[] {
  if (list.some((c) => c.corpCode === corp.corpCode)) return list.filter((c) => c.corpCode !== corp.corpCode);
  return [{ ...corp, addedAt: now }, ...list].slice(0, MAX_WATCH);
}

export function readWatchlist(): WatchCorp[] {
  try {
    return parseWatchlist(window.localStorage.getItem(KEY));
  } catch {
    return []; // 사생활 보호 모드·저장소 차단 등
  }
}

/** 저장 성공 여부를 돌려준다 (실패하면 화면에서 알려 준다) */
function write(list: WatchCorp[]): boolean {
  let ok = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    ok = false;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return ok;
}

export function toggleWatch(corp: Omit<WatchCorp, "addedAt">): boolean {
  return write(toggleIn(readWatchlist(), corp, Date.now()));
}

export function removeWatch(corpCode: string): boolean {
  return write(readWatchlist().filter((c) => c.corpCode !== corpCode));
}

/** 같은 탭(커스텀 이벤트)과 다른 탭(storage 이벤트)의 변경을 구독 */
export function subscribeWatchlist(onChange: () => void): () => void {
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
