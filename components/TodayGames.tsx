import type { GameEvent } from "@/lib/types";

export function TodayGames({ games }: { games: GameEvent[] }) {
  const firstGame = games[0];
  const subtitle = firstGame
    ? `${firstGame.tag || "KBL"} · ${games.length}경기`
    : "예정된 경기 없음";
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">다음 경기</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">{subtitle}</p>
        </div>
        <span className="chip border-buzzer-500/40 bg-buzzer-500/10 text-buzzer-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buzzer-500" />
          LIVE SOON
        </span>
      </div>

      <ul className="space-y-3">
        {games.map((g) => (
          <li
            key={g.id}
            className="group grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-lg border border-court-700/60 bg-court-900/40 p-3 transition hover:border-court-600 hover:bg-court-800/60"
          >
            <div className="flex flex-col items-end">
              <span className="text-[14px] font-semibold text-ink-50">
                {g.home.name}
              </span>
              <span className="text-[12px] text-ink-500">HOME</span>
            </div>

            <div className="flex flex-col items-center gap-1 px-3">
              <span className="stat-num text-sm font-bold text-flame-400">
                {g.when}
              </span>
              <span className="chip border-flame-500/30 bg-flame-500/10 px-2 py-0.5 text-[11px] text-flame-400">
                {g.tag}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[14px] font-semibold text-ink-50">
                {g.away.name}
              </span>
              <span className="text-[12px] text-ink-500">AWAY</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
