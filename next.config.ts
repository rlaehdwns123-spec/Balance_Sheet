import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

const nextConfig: NextConfig = {
  // data/*.json(상장사 목록·업종코드)은 런타임에 fs로 읽으므로 서버리스 번들에 명시적으로 포함 (Vercel)
  outputFileTracingIncludes: {
    "/**": ["./data/corps.json", "./data/industries.json"],
  },
  // 링크 미리보기 크롤러에는 metadata를 스트리밍하지 않고 <head>에 넣는다.
  // Next 기본 목록(구글·네이버 Yeti·페이스북 등)에 카카오톡 크롤러를 추가.
  // 주의: /.*/처럼 일반 브라우저까지 넣으면 봇 모드로 렌더돼 페이지 본문이 hydrate되지 않는다.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|kakaotalk-scrap`, "i"),
  // v1.1에서 하단 탭이 검색 / 관심기업 / 비교로 바뀜 — 예전 하단 탭 주소(홈 화면 바로가기 등)는 관심기업으로
  async redirects() {
    return [
      { source: "/statements", destination: "/watchlist", permanent: false },
      { source: "/analysis", destination: "/watchlist", permanent: false },
    ];
  },
};

export default nextConfig;
