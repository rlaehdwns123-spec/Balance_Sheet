import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { UsCorp } from "./types";

const FILE = path.join(process.cwd(), "data", "us-corps.json");

let cache: Promise<UsCorp[]> | null = null;

/** data/us-corps.json을 읽어 메모리에 캐시. 파일이 없으면 npm run build:us-corps 안내 에러. */
export function loadUsCorps(): Promise<UsCorp[]> {
  cache ??= readFile(FILE, "utf8")
    .then((text) => JSON.parse(text) as UsCorp[])
    .catch((err) => {
      cache = null;
      if (err.code === "ENOENT") throw new Error("data/us-corps.json이 없습니다. npm run build:us-corps를 먼저 실행하세요.");
      throw err;
    });
  return cache;
}
