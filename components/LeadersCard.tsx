import Link from "next/link";
import type { PlayerLeader } from "@/lib/types";

type AccentKey = "flame" | "neon" | "hoop";

interface Props {
  title: string;
  subtitle?: string;
  leaders: PlayerLeader[];
  /** 1위 강조색 — 기본 flame */
  accent?: AccentKey;
}

const ACCENT: Record<AccentKey, { topText: string; topBar: string; bar: string }> = {
  flame: { topText: "text-flame-500", topBar: "bg-flame-500", bar: "bg-flame-500/40" },
  neon:  { topText: "text-neon-400",  topBar: "bg-neon-500",  bar: "bg-neon-500/40" },
  hoop:  { topText: "text-hoop-400",  topBar: "bg-hoop-500",  bar: "bg-hoop-500/40" },
};

export function LeadersCard({ title, subtitle, leaders, accent = "flame" }: Props) {
  const c = ACCENT[accent];
  const max = Math.max(...leaders.map((l) => l.value), 1);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-ink-500">{subtitle}</p>
          )}
        </div>
        <Link
          href="/players"
          className="chip hover:border-court-600 hover:text-ink-100"
        >
          전체 →
        </Link>
      </div>

      <ul className="space-y-2">
        {leaders.map((p) => {
          const pct = (p.value / max) * 100;
          const isTop = p.rank === 1;
          return (
            <li key={`${p.name}-${p.rank}`} className="flex items-center gap-3">
              <span
                className={[
                  "stat-num w-5 text-right text-[13px] font-semibold",
                  isTop ? c.topText : "text-ink-500",
                ].join(" ")}
              >
                {p.rank}
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14px] font-medium text-ink-50">
                    {p.name}
                    <span className="text-[12px] font-normal text-ink-500"> · {p.team}</span>
                  </span>
                  <span className="stat-num text-[14px] font-semibold text-ink-50">
                    {p.value.toFixed(1)}
                    <span className="ml-1 text-[11px] font-normal text-ink-500">
                      {p.unit}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-court-700/60">
                  <div
                    className={`h-full ${isTop ? c.topBar : c.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
