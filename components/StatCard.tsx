import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  title: string;
  value: ReactNode;
  caption?: string;
  /** 좌측 포인트 라인 색 — tailwind bg-* class */
  accent?: string;
  trend?: "up" | "down" | "flat";
}

export function StatCard({
  label,
  title,
  value,
  caption,
  accent = "bg-flame-500",
  trend,
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden card p-4 transition hover:border-court-600 hover:shadow-card-hover">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${accent}`} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
          {label}
        </span>
        {trend && <TrendIcon trend={trend} />}
      </div>
      <div className="mt-2 text-lg font-semibold text-ink-50">{title}</div>
      <div className="mt-1 stat-num text-2xl font-bold text-ink-50">{value}</div>
      {caption && <div className="mt-2 text-[12px] text-ink-300">{caption}</div>}
    </div>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  const map = {
    up: { color: "text-hoop-400", symbol: "▲" },
    down: { color: "text-buzzer-500", symbol: "▼" },
    flat: { color: "text-ink-500", symbol: "—" },
  } as const;
  const m = map[trend];
  return <span className={`text-[10px] font-semibold ${m.color}`}>{m.symbol}</span>;
}
