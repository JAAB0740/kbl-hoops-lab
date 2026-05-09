import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import { ALL_GAMES, gameToId, type RawGame } from "@/lib/gamesUtil";

/**
 * 한 팀의 시즌 전체 일정 요약 — 가로 W/L 시퀀스 + 주요 통계.
 * GamesExplorer 에서 팀 필터 + (전체/달력) 모드일 때 표시.
 */
export function TeamScheduleSummary({ teamShort }: { teamShort: string }) {
  const games = ALL_GAMES.filter(
    (g) => g.homeShort === teamShort || g.awayShort === teamShort,
  ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  if (games.length === 0) return null;

  const finals = games.filter((g) => g.status === "final");
  let wins = 0,
    losses = 0,
    homeW = 0,
    homeL = 0,
    awayW = 0,
    awayL = 0,
    pf = 0,
    pa = 0;
  for (const g of finals) {
    const isHome = g.homeShort === teamShort;
    const my = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
    const opp = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
    const won = my > opp;
    pf += my;
    pa += opp;
    if (won) {
      wins++;
      if (isHome) homeW++;
      else awayW++;
    } else {
      losses++;
      if (isHome) homeL++;
      else awayL++;
    }
  }
  const winPct = finals.length > 0 ? wins / finals.length : 0;
  const avgFor = finals.length > 0 ? pf / finals.length : 0;
  const avgAg = finals.length > 0 ? pa / finals.length : 0;

  // 현재 streak
  let streak = 0;
  let streakKind: "W" | "L" | null = null;
  for (let i = finals.length - 1; i >= 0; i--) {
    const g = finals[i];
    const isHome = g.homeShort === teamShort;
    const my = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
    const opp = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
    const won = my > opp;
    if (streakKind == null) {
      streakKind = won ? "W" : "L";
      streak = 1;
    } else if ((streakKind === "W" && won) || (streakKind === "L" && !won)) {
      streak++;
    } else {
      break;
    }
  }

  const color = TEAM_COLORS[teamShort] ?? "#94a3b8";

  return (
    <section className="card mb-4 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink-50">
            <span style={{ color }}>{teamShort}</span> 시즌 일정 요약
          </h3>
          <p className="mt-0.5 text-[12px] text-ink-500">
            정규+PO 전체 · 총 {games.length}경기 · 종료 {finals.length}경기
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[12px]">
          <Stat label="전체" value={`${wins}-${losses}`} accent={color} />
          <Stat label="승률" value={winPct.toFixed(3).replace(/^0/, "")} />
          <Stat label="홈" value={`${homeW}-${homeL}`} />
          <Stat label="원정" value={`${awayW}-${awayL}`} />
          <Stat
            label="평균 득실"
            value={`${avgFor.toFixed(1)} - ${avgAg.toFixed(1)}`}
          />
          {streakKind && (
            <Stat
              label="현재"
              value={`${streakKind}${streak}`}
              accent={streakKind === "W" ? "#22c55e" : "#ef4444"}
            />
          )}
        </div>
      </div>

      {/* W/L 시퀀스 */}
      <div className="overflow-x-auto">
        <div className="flex gap-0.5 min-w-min">
          {games.map((g, i) => (
            <SequenceCell
              key={i}
              g={g}
              teamShort={teamShort}
              teamColor={color}
            />
          ))}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-500">
        왼쪽 = 시즌 시작 · 색칠된 칸 = 종료 경기 · 회색 = 예정 · 호버하면 상세 정보,
        클릭하면 경기 페이지로 이동
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div
        className="stat-num mt-0.5 text-[13px] font-semibold"
        style={{ color: accent ?? undefined }}
      >
        {value}
      </div>
    </div>
  );
}

function SequenceCell({
  g,
  teamShort,
  teamColor,
}: {
  g: RawGame;
  teamShort: string;
  teamColor: string;
}) {
  const isHome = g.homeShort === teamShort;
  const opp = isHome ? g.awayShort : g.homeShort;
  const isFinal = g.status === "final";
  const my = isHome ? g.homeScore : g.awayScore;
  const them = isHome ? g.awayScore : g.homeScore;
  const won =
    isFinal && my != null && them != null ? my > them : null;

  let bg = "bg-court-800/60 hover:bg-court-700/60";
  if (won === true) bg = "bg-hoop-500/40 hover:bg-hoop-500/55";
  else if (won === false) bg = "bg-buzzer-500/40 hover:bg-buzzer-500/55";

  const ring =
    g.tag !== "정규리그" ? "ring-1 ring-flame-500/40" : "";

  return (
    <Link
      href={`/games/${gameToId(g)}`}
      className={[
        "h-6 w-3 shrink-0 rounded-sm transition cursor-pointer",
        bg,
        ring,
      ].join(" ")}
      title={`${g.date} ${g.time} · ${g.tag}\n${isHome ? "홈" : "원정"} vs ${opp}${
        isFinal ? `\n${my}-${them} ${won ? "W" : "L"}` : "\n예정"
      }`}
    >
      <span className="sr-only">
        {g.date} {opp} {isFinal ? `${my}-${them}` : "예정"}
      </span>
    </Link>
  );
}
