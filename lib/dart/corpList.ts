import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Corp } from "./corps";

const CORPS_FILE = path.join(process.cwd(), "data", "corps.json");

let cache: Promise<Corp[]> | null = null;

/** data/corps.json을 읽어 메모리에 캐시. 파일이 없으면 npm run build:corps 안내 에러. */
export function loadCorps(): Promise<Corp[]> {
  cache ??= readFile(CORPS_FILE, "utf8")
    .then((text) => JSON.parse(text) as Corp[])
    .catch((err) => {
      cache = null;
      if (err.code === "ENOENT") throw new Error("data/corps.json이 없습니다. npm run build:corps를 먼저 실행하세요.");
      throw err;
    });
  return cache;
}

export async function findCorp(corpCode: string): Promise<Corp | undefined> {
  return (await loadCorps()).find((c) => c.corp_code === corpCode);
}
