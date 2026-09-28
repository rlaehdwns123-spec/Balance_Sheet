/**
 * DART 고유번호(corpCode.xml) zip을 받아 상장사 목록을 data/corps.json으로 저장.
 * 실행: npm run build:corps  (.env.local 또는 환경변수의 DART_API_KEY 필요)
 *
 * --keep-on-error: 받기에 실패해도 기존 data/corps.json이 있으면 경고만 하고 성공 종료.
 *   배포 빌드(vercel-build)에서 DART 일시 장애가 배포 실패로 번지지 않게 할 때 사용.
 */
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { parseCorpCodeXml } from "../lib/dart/corps";

const OUT_FILE = path.join(process.cwd(), "data", "corps.json");

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {}
  const key = process.env.DART_API_KEY;
  if (!key) throw new Error("DART_API_KEY가 없습니다. .env.local에 설정하세요.");

  const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${key}`);
  if (!res.ok) throw new Error(`corpCode.xml 요청 실패: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());

  // 키 오류 등은 zip 대신 XML/JSON 에러 응답이 옴 (zip은 "PK"로 시작)
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(`zip이 아닌 응답: ${strFromU8(buf.slice(0, 300))}`);
  }

  const files = unzipSync(buf);
  const xmlName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".xml"));
  if (!xmlName) throw new Error(`zip 안에 XML이 없습니다: ${Object.keys(files).join(", ")}`);

  const corps = parseCorpCodeXml(strFromU8(files[xmlName]));
  corps.sort((a, b) => a.stock_code.localeCompare(b.stock_code));

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(corps) + "\n");
  console.log(`상장사 ${corps.length}개 → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  if (process.argv.includes("--keep-on-error")) {
    const exists = await access(OUT_FILE).then(
      () => true,
      () => false,
    );
    if (exists) {
      console.warn(`상장사 목록 갱신 실패, 기존 data/corps.json 사용: ${message}`);
      return;
    }
  }
  console.error(message);
  process.exit(1);
});
