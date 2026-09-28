import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: { default: "DART 재무 분석", template: "%s | DART 재무 분석" },
  description: "DART Open API로 상장사 재무제표를 5개년으로 정리하고 재무비율·추이 차트·기업 비교를 제공합니다.",
  applicationName: "DART 분석",
  // iOS 홈 화면 추가 시 전체화면 앱처럼 (아이콘은 app/apple-icon.png)
  appleWebApp: { capable: true, title: "DART 분석", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

// 첫 페인트 전에 테마 클래스를 적용해 깜빡임 방지 (저장값 없으면 시스템 설정 따름)
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
          <div className="mx-auto flex h-14 max-w-screen-md items-center justify-between px-4">
            <span className="text-base font-semibold">DART 재무 분석</span>
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto max-w-screen-md px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
