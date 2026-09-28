/**
 * 상장사별 업종코드(KSIC, DART 기업개황 induty_code)를 모아 data/industries.json으로 저장.
 * 실행: npm run build:industries  (data/corps.json 먼저 필요)
 *
 * 회사당 기업개황 API 1회 — 약 4,000건이라 몇 분 걸린다. 업종은 거의 바뀌지 않으니 가끔 실행해 커밋한다.
 * 이미 받은 회사는 건너뛰므로 중간에 끊겨도 다시 실행하면 이어서 받는다.
 * DART에 부담을 주지 않도록 동시 3건, 초당 약 5건으로 제한한다.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Corp } from "../lib/dart/corps";

const CORPS_FILE = path.join(process.cwd(), "data", "corps.json");
const OUT_FILE = path.join(process.cwd(), "data", "industries.json");
const CONCURRENCY = 3;
const MIN_INTERVAL_MS = 200; // 전체 요청 간 최소 간격 → 초당 약 5건
const SAVE_EVERY = 200;

type Industries = Record<string, string>; // corp_code → induty_code

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function save(data: Industries) {
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(OUT_FILE, JSON.stringify(sorted) + "\n");
}

class StopError extends Error {}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY가 없습니다. .env.local에 설정하세요.");

  const corps = await readJson<Corp[]>(CORPS_FILE, []);
  if (!corps.length) throw new Error("data/corps.json이 없습니다. npm run build:corps를 먼저 실행하세요.");

  const data = await readJson<Industries>(OUT_FILE, {});
  const todo = corps.filter((c) => !(c.corp_code in data));
  console.log(`상장사 ${corps.length}개 중 ${todo.length}개 업종코드 수집`);

  let next = 0;
  let done = 0;
  let lastRequest = 0;
  let failed = 0;

  // 요청 간격을 전역으로 맞추는 간단한 스로틀
  async function throttle() {
    const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
    lastRequest = Math.max(Date.now(), lastRequest + MIN_INTERVAL_MS);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  async function worker() {
    while (next < todo.length) {
      const corp = todo[next++];
      await throttle();
      const res = await fetch(`https://opendart.fss.or.kr/api/company.json?crtfc_key=${key}&corp_code=${corp.corp_code}`);
      const body = (await res.json()) as { status: string; message: string; induty_code?: string };
      if (body.status === "020" || body.status === "010" || body.status === "011") {
        throw new StopError(`${body.status} ${body.message} — 저장 후 중단`);
      }
      if (body.status === "000") data[corp.corp_code] = body.induty_code ?? "";
      else failed++;
      done++;
      if (done % SAVE_EVERY === 0) {
        await save(data);
        console.log(`  ${done}/${todo.length}`);
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  } finally {
    await save(data);
  }
  console.log(`완료: ${Object.keys(data).length}개 → ${path.relative(process.cwd(), OUT_FILE)} (실패 ${failed}건)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
