import Link from "next/link";
import type { TeamStanding } from "@/lib/types";

interface Props {
  rows: TeamStanding[];
  /** 위에 보여줄 팀 수 (기본 6) */
  take?: number;
}

export function StandingsTable({ rows, take = 6 }: Props) {
  const data = rows.slice(0, take);
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">정규리그 TOP {take}</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">
            2025-26 · 주황색은 4강 직행, 청록은 6강 PO
          </p>
        </div>
        <Link
          href="/standings"
          className="chip hover:border-court-600 hover:text-ink-100"
        >
          전체 순위 보기 →
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-court-700/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-court-900/70 text-[12px] uppercase tracking-[0.1em] text-ink-500">
              <th className="py-2.5 pl-3 text-left font-medium">#</th>
              <th className="py-2.5 text-left font-medium">팀</th>
              <th className="py-2.5 text-right font-medium">승</th>
              <th className="py-2.5 text-right font-medium">패</th>
              <th className="py-2.5 text-right font-medium">승률</th>
              <th className="py-2.5 pr-3 text-right font-medium">연속</th>
            </tr>
          </thead>
          <tbody className="divider-y">
            {data.map((t) => (
              <tr
                key={t.code}
                className="group transition hover:bg-court-700/30"
              >
                <td className="py-2.5 pl-3 align-middle">
                  <span className={`stat-num text-[14px] font-semibold ${t.accent}`}>
                    {t.rank}
                  </span>
                </td>
                <td className="py-2.5 align-middle">
                  <div className="flex items-center gap-2.5">
                    <TeamBadge code={t.code} />
                    <span className="text-[14px] font-medium text-ink-50">
                      {t.name}
                    </span>
                    {t.status === "regular-champ" && (
                      <span className="chip border-flame-500/40 bg-flame-500/10 text-flame-400">
                        우승
                      </span>
                    )}
                    {t.status === "bye" && (
                      <span className="chip border-flame-400/30 bg-flame-500/5 text-flame-400">
                        4강 직행
                      </span>
                    )}
                  </div>
                </td>
                <td className="stat-num py-2.5 text-right text-ink-100">{t.wins}</td>
                <td className="stat-num py-2.5 text-right text-ink-300">{t.losses}</td>
                <td className="stat-num py-2.5 text-right font-medium text-ink-50">
                  {t.winPct.toFixed(3).replace(/^0/, "")}
                </td>
                <td className="py-2.5 pr-3 text-right">
                  <StreakChip streak={t.streak} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamBadge({ code }: { code: string }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-court-700 bg-court-900 text-[11px] font-bold tracking-wider text-ink-100">
      {code.slice(0, 3)}
    </span>
  );
}

function StreakChip({ streak }: { streak: string }) {
  const isWin = streak.startsWith("W");
  return (
    <span
      className={[
        "inline-flex min-w-[2.25rem] justify-center rounded-md px-2 py-0.5 text-[12px] font-semibold stat-num",
        isWin
          ? "bg-hoop-500/15 text-hoop-400 ring-1 ring-inset ring-hoop-500/30"
          : "bg-buzzer-500/15 text-buzzer-400 ring-1 ring-inset ring-buzzer-500/30",
      ].join(" ")}
    >
      {streak}
    </span>
  );
}
