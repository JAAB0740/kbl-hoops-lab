import type { PlayoffSeries } from "@/lib/types";
import { summarizeSeries } from "@/lib/seasonStatus";
import { TEAM_COLORS } from "@/lib/data";

/**
 * 4강 PO 두 시리즈 결과 카드 — 메인 대시보드용
 */
export function SemiHighlights({
  semiSeries,
}: {
  semiSeries: PlayoffSeries[];
}) {
  if (semiSeries.length === 0) return null;
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-court-700/60 bg-court-800/40 px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-ink-50">
              4강 플레이오프 하이라이트
            </h3>
            <p className="mt-1 text-[11px] text-ink-500">
              두 시리즈 결과와 분기점이 된 경기
            </p>
          </div>
          <a
            href="/playoffs"
            className="text-[11px] text-ink-500 hover:text-flame-400"
          >
            브래킷 →
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-court-700/60 md:grid-cols-2 md:divide-x md:divide-y-0">
        {semiSeries.map((s) => (
          <SeriesCard key={s.slot} series={s} />
        ))}
      </div>
    </div>
  );
}

function SeriesCard({ series }: { series: PlayoffSeries }) {
  const sum = summarizeSeries(series);
  const winnerColor =
    sum.winner && TEAM_COLORS[sum.winner]
      ? TEAM_COLORS[sum.winner]
      : "#94a3b8";

  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between">
        <span
          className="stat-num text-base font-bold"
          style={{ color: winnerColor }}
        >
          {sum.scoreLine}
        </span>
        <span
          className={[
            "chip",
            series.status === "final"
              ? "border-flame-500/30 bg-flame-500/10 text-flame-400"
              : "border-court-600 bg-court-700/40 text-ink-300",
          ].join(" ")}
        >
          {series.status === "final" ? "종료" : "진행 중"}
        </span>
      </div>

      {/* 두 팀 */}
      <div className="mt-3 space-y-1.5">
        <TeamLine
          short={series.topShort}
          name={series.topName}
          seed={series.topSeed}
          wins={series.topWins}
          isWinner={sum.winner === series.topShort}
          isLoser={sum.loser === series.topShort}
        />
        <TeamLine
          short={series.bottomShort}
          name={series.bottomName}
          seed={series.bottomSeed}
          wins={series.bottomWins}
          isWinner={sum.winner === series.bottomShort}
          isLoser={sum.loser === series.bottomShort}
        />
      </div>

      {/* 분기점 경기 */}
      {sum.bestGame && (
        <div className="mt-4 rounded-md border border-court-700/60 bg-court-900/40 p-3">
          <div className="text-[10px] uppercase tracking-[0.12em] text-ink-500">
            가장 큰 점수차 경기
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="stat-num text-[12px] text-ink-300">
              G{sum.bestGame.no} · {fmtMd(sum.bestGame.date)}
            </span>
            <span className="stat-num text-[13px] font-semibold text-ink-50">
              {sum.bestGame.homeShort}{" "}
              <span className="text-flame-400">{sum.bestGame.homeScore}</span>
              <span className="mx-1 text-ink-500">:</span>
              <span className="text-flame-400">{sum.bestGame.awayScore}</span>{" "}
              {sum.bestGame.awayShort}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamLine({
  short,
  name,
  seed,
  wins,
  isWinner,
  isLoser,
}: {
  short: string;
  name: string;
  seed?: number;
  wins: number;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const color = TEAM_COLORS[short] ?? "#94a3b8";
  return (
    <div
      className={[
        "flex items-center justify-between rounded-md px-2 py-1.5",
        isWinner ? "bg-flame-500/10" : "",
        isLoser ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {seed != null && (
          <span
            className="stat-num inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold"
            style={{
              backgroundColor: isWinner ? color : "#1b1e24",
              color: isWinner ? "#07080a" : "#a1a1aa",
            }}
          >
            {seed}
          </span>
        )}
        <span
          className={[
            "text-[13px]",
            isWinner ? "font-semibold text-ink-50" : "text-ink-300",
          ].join(" ")}
        >
          {name}
        </span>
      </div>
      <span
        className={[
          "stat-num text-[13px] font-bold",
          isWinner ? "text-flame-400" : "text-ink-500",
        ].join(" ")}
      >
        {wins}
      </span>
    </div>
  );
}

function fmtMd(date: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${parseInt(m[1], 10)}월 ${parseInt(m[2], 10)}일`;
}
