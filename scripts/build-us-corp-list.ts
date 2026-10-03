/**
 * SEC company_tickers.json을 받아 미국 상장사 목록을 data/us-corps.json으로 저장.
 * 실행: npm run build:us-corps  (.env.local 또는 환경변수의 SEC_USER_AGENT 필요 — "앱이름 연락처이메일")
 *
 * --keep-on-error: 받기에 실패해도 기존 data/us-corps.json이 있으면 경고만 하고 성공 종료.
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCompanyTickers } from "../lib/sec/corps";

const OUT_FILE = path.join(process.cwd(), "data", "us-corps.json");

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  const userAgent = process.env.SEC_USER_AGENT;
  if (!userAgent) throw new Error("SEC_USER_AGENT가 없습니다. .env.local에 설정하세요.");

  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": userAgent, "Accept-Encoding": "gzip, deflate" },
  });
  if (!res.ok) throw new Error(`company_tickers.json 요청 실패: HTTP ${res.status}`);

  const corps = parseCompanyTickers(await res.json());
  if (!corps.length) throw new Error("company_tickers.json에 종목이 없습니다.");

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(corps) + "\n");
  console.log(`미국 종목 ${corps.length}개 → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (process.argv.includes("--keep-on-error")) {
    const exists = await access(OUT_FILE).then(
      () => true,
      () => false,
    );
    if (exists) {
      console.warn(`미국 종목 목록 갱신 실패, 기존 data/us-corps.json 사용: ${message}`);
      return;
    }
  }
  console.error(message);
  process.exit(1);
});
