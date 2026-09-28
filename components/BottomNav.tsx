"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "검색", icon: "M21 21l-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z" },
  { href: "/statements", label: "재무제표", icon: "M4 4h16v16H4zM4 9h16M4 14h16M10 9v11", also: "/company" },
  { href: "/analysis", label: "분석", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/compare", label: "비교", icon: "M8 3v18M16 3v18M3 8h5M16 16h5" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <ul className="mx-auto grid h-16 max-w-screen-md grid-cols-4">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href) || ("also" in tab && pathname.startsWith(tab.also));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-xs ${
                  active
                    ? "font-semibold text-blue-600 dark:text-blue-400"
                    : "text-neutral-500 dark:text-neutral-400"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.2 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
