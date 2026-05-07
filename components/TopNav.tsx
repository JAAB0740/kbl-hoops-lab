"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSeasonStatus } from "@/lib/seasonStatus";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/standings", label: "순위" },
  { href: "/team", label: "팀" },
  { href: "/players", label: "선수" },
  { href: "/games", label: "일정" },
  { href: "/compare", label: "비교" },
  { href: "/playoffs", label: "플레이오프" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function TopNav() {
  const pathname = usePathname() || "/";
  const status = getSeasonStatus();

  return (
    <header className="sticky top-0 z-30 border-b border-court-700/70 bg-court-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-flame-500/15 ring-1 ring-flame-500/40">
              <span className="h-2.5 w-2.5 rounded-full bg-flame-500 shadow-[0_0_10px_2px_rgba(245,158,11,0.6)]" />
            </span>
            <span className="text-sm font-semibold tracking-[0.08em] text-ink-50">
              KBL HOOPS LAB
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                  isActive(pathname, item.href)
                    ? "bg-court-700/70 text-ink-50"
                    : "text-ink-300 hover:bg-court-700/40 hover:text-ink-50",
                ].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] font-medium tracking-widest text-ink-500 sm:inline">
            2025-26 정규리그
          </span>
          <div className="flex items-center gap-1.5 rounded-md border border-court-700 bg-court-800/70 px-2.5 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buzzer-500" />
            <span className="text-[11px] font-medium text-ink-100">{status.shortChip}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
