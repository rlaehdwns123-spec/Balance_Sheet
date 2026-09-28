import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

const nextConfig: NextConfig = {
  // data/corps.json은 런타임에 fs로 읽으므로 서버리스 번들에 명시적으로 포함 (Vercel)
  outputFileTracingIncludes: {
    "/**": ["./data/corps.json"],
  },
  // 링크 미리보기 크롤러에는 metadata를 스트리밍하지 않고 <head>에 넣는다.
  // Next 기본 목록(구글·네이버 Yeti·페이스북 등)에 카카오톡 크롤러를 추가.
  // 주의: /.*/처럼 일반 브라우저까지 넣으면 봇 모드로 렌더돼 페이지 본문이 hydrate되지 않는다.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|kakaotalk-scrap`, "i"),
};

export default nextConfig;
