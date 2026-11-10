import Link from "next/link";
import type { PlayerInfo, PlayerSeasonAvg } from "@/lib/boxscores";
import type { TeamStyle, TeamSplits } from "@/lib/teamStyle";

type PlayerEntry = { player: PlayerInfo; avg: PlayerSeasonAvg };

/**
 * 관전 포인트 — 경기 시작 전까지의 데이터로 "뭘 지켜볼지" 요약.
 *
 *   1) 핫/콜드 선수 — 양 팀 1명씩, 최근 3G 평균이 시즌 평균 대비 가장 많이 튄 선수.
 *   2) 팀 스타일 상충 — Pace / ORtg / DRtg / 3PA 비중 리그 내 상대 위치 비교.
 *
 * 입력은 pre-game (teamPlayersBefore + teamPlayersRecentBefore) 결과와
 * team-advanced / team-filtered 에서 뽑아낸 team style. 없으면 null section 리턴.
 */
export function GamePreviewPoints({
  homeShort, awayShort, homeColor, awayColor,
  homeSeason, awaySeason, homeRecent, awayRecent,
  homeStyle, awayStyle, leagueRange,
  homeSplits, awaySplits,
}: {
  homeShort: string; awayShort: string;
  homeColor: string; awayColor: string;
  homeSeason: PlayerEntry[]; awaySeason: PlayerEntry[];
  homeRecent: PlayerEntry[]; awayRecent: PlayerEntry[];
  homeStyle: TeamStyle | null; awayStyle: TeamStyle | null;
  leagueRange: Record<keyof TeamStyle, { min: number; max: number }>;
  homeSplits: TeamSplits; awaySplits: TeamSplits;
}) {
  const homePick = pickHotCold(homeSeason, homeRecent);
  const awayPick = pickHotCold(awaySeason, awayRecent);
  const hasPlayers = homePick || awayPick;
  const hasStyle = homeStyle && awayStyle;

  if (!hasPlayers && !hasStyle) return null;

  return (
    <section className="card mb-6 p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-50">관전 포인트</h3>
        <span className="text-[12px] text-ink-500">경기 직전까지의 데이터</span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* 1) 핫/콜드 선수 */}
        {hasPlayers && (
          <div>
            <div className="mb-2 text-[13px] uppercase tracking-wider text-ink-500">
              주목할 컨디션 — 최근 3경기
            </div>
            <div className="space-y-2">
              <HotColdBlock short={homeShort} color={homeColor} pick={homePick} align="left" />
              <HotColdBlock short={awayShort} color={awayColor} pick={awayPick} align="right" />
            </div>
            <p className="mt-2 text-[12px] text-ink-500">
              최근 3경기 평균 vs 시즌 평균 Δ 가장 큰 선수 (출장 15분+ · 시즌 5경기+).
            </p>
          </div>
        )}

        {/* 2) 팀 스타일 상충 */}
        {hasStyle && (
          <div>
            <div className="mb-2 text-[13px] uppercase tracking-wider text-ink-500">
              팀 스타일 — 리그 내 위치
            </div>
            <div className="space-y-2.5">
              <StyleRow
                label="페이스" hint="poss/48"
                home={homeStyle.pace} away={awayStyle.pace}
                range={leagueRange.pace}
                homeColor={homeColor} awayColor={awayColor}
                fmt={(v) => v.toFixed(1)}
              />
              <StyleRow
                label="공격 ORtg" hint="100poss당"
                home={homeStyle.offRtg} away={awayStyle.offRtg}
                range={leagueRange.offRtg}
                homeColor={homeColor} awayColor={awayColor}
                fmt={(v) => v.toFixed(1)}
              />
              <StyleRow
                label="수비 DRtg" hint="낮을수록 ↑"
                home={homeStyle.defRtg} away={awayStyle.defRtg}
                range={leagueRange.defRtg}
                homeColor={homeColor} awayColor={awayColor}
                fmt={(v) => v.toFixed(1)}
                invert
              />
              <StyleRow
                label="3점 시도 비중" hint="3PA/FGA"
                home={homeStyle.threeRate} away={awayStyle.threeRate}
                range={leagueRange.threeRate}
                homeColor={homeColor} awayColor={awayColor}
                fmt={(v) => `${v.toFixed(1)}%`}
              />
            </div>
            <p className="mt-2 text-[12px] text-ink-500">
              점 위치 = 리그 min…max 내 상대 위치. 멀리 떨어질수록 매치업에서 부각될 축.
            </p>
          </div>
        )}
      </div>

      {/* 3) 분할 약점 — 이 경기 상황별 (홈/원정/Q4) 성적. 양 팀 색 대비로 "어느 쪽 유리"가 즉시 보임. */}
      <SplitsBlock
        homeShort={homeShort} awayShort={awayShort}
        homeColor={homeColor} awayColor={awayColor}
        homeSplits={homeSplits} awaySplits={awaySplits}
      />
    </section>
  );
}

function SplitsBlock({
  homeShort, awayShort, homeColor, awayColor, homeSplits, awaySplits,
}: {
  homeShort: string; awayShort: string;
  homeColor: string; awayColor: string;
  homeSplits: TeamSplits; awaySplits: TeamSplits;
}) {
  const rows: {
    label: string;
    home: number | null;
    away: number | null;
    fmt: (v: number) => string;
    note?: string;
  }[] = [
    // 이 경기에서 home 팀은 홈, away 팀은 원정 — 각각 그 역할 승률.
    {
      label: "역할별 승률",
      home: homeSplits.homeWinPct, away: awaySplits.awayWinPct,
      fmt: (v) => `${v.toFixed(0)}%`,
      note: `${homeShort} 홈 · ${awayShort} 원정`,
    },
    {
      label: "Q4 평균 마진",
      home: homeSplits.q4Margin, away: awaySplits.q4Margin,
      fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`,
      note: "4쿼터 득실차 평균",
    },
  ];
  const hasAny = rows.some((r) => r.home != null || r.away != null);
  if (!hasAny) return null;

  return (
    <div className="mt-5 border-t border-court-700/50 pt-4">
      <div className="mb-2 text-[13px] uppercase tracking-wider text-ink-500">
        분할 약점 — 경기 상황별
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <SplitRow
            key={r.label} label={r.label} note={r.note}
            home={r.home} away={r.away}
            homeColor={homeColor} awayColor={awayColor}
            homeShort={homeShort} awayShort={awayShort}
            fmt={r.fmt}
          />
        ))}
      </div>
    </div>
  );
}

function SplitRow({
  label, note, home, away, homeColor, awayColor, homeShort, awayShort, fmt,
}: {
  label: string; note?: string;
  home: number | null; away: number | null;
  homeColor: string; awayColor: string;
  homeShort: string; awayShort: string;
  fmt: (v: number) => string;
}) {
  const homeBetter = home != null && away != null && home > away;
  const awayBetter = home != null && away != null && away > home;
  return (
    <div className="rounded-md border border-court-700/60 bg-court-800/40 p-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-200">{label}</span>
        {note && <span className="text-[11px] text-ink-500">{note}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px]" style={{ color: homeColor }}>{homeShort}</div>
          <div
            className={`stat-num text-xl font-bold ${homeBetter ? "" : "text-ink-400"}`}
            style={{ color: homeBetter ? homeColor : undefined }}
          >
            {home != null ? fmt(home) : "—"}
          </div>
        </div>
        <span className="text-[11px] text-ink-600">vs</span>
        <div className="min-w-0 flex-1 text-right">
          <div className="truncate text-[11px]" style={{ color: awayColor }}>{awayShort}</div>
          <div
            className={`stat-num text-xl font-bold ${awayBetter ? "" : "text-ink-400"}`}
            style={{ color: awayBetter ? awayColor : undefined }}
          >
            {away != null ? fmt(away) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

/** season/recent 교집합 pcode 중 Δ|ppg| 최대값 선수 반환. */
function pickHotCold(
  season: PlayerEntry[],
  recent: PlayerEntry[],
): { player: PlayerInfo; seasonPpg: number; recentPpg: number; delta: number } | null {
  const seasonByPcode = new Map(season.map((e) => [e.player.pcode, e]));
  let best: { player: PlayerInfo; seasonPpg: number; recentPpg: number; delta: number } | null = null;
  for (const r of recent) {
    const s = seasonByPcode.get(r.player.pcode);
    if (!s) continue;
    // 주전 급만: 시즌 평균 15분+ · 시즌 5경기+
    if (s.avg.mpg < 15 || s.avg.games < 5) continue;
    const delta = r.avg.ppg - s.avg.ppg;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { player: r.player, seasonPpg: s.avg.ppg, recentPpg: r.avg.ppg, delta };
    }
  }
  return best;
}

function HotColdBlock({
  short, color, pick, align,
}: {
  short: string; color: string;
  pick: ReturnType<typeof pickHotCold>;
  align: "left" | "right";
}) {
  const alignRow = align === "right" ? "flex-row-reverse text-right" : "flex-row";
  if (!pick) {
    return (
      <div className={`flex items-center gap-2 ${alignRow}`}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[13px] font-medium" style={{ color }}>{short}</span>
        <span className="text-[13px] text-ink-500">— 데이터 부족</span>
      </div>
    );
  }
  const hot = pick.delta > 0;
  const toneBg = hot ? "bg-flame-500/15 text-flame-300 border-flame-500/30"
                     : "bg-ink-500/15 text-ink-300 border-ink-500/30";
  const label = hot ? "뜨거움" : "식었음";
  const sign = pick.delta >= 0 ? "+" : "";

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${alignRow}`}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[13px] font-medium" style={{ color }}>{short}</span>
      <Link
        href={`/players/${pick.player.pcode}`}
        className="text-[15px] font-semibold text-ink-50 hover:text-flame-400"
      >
        {pick.player.pname}
      </Link>
      <span className={`chip text-[11px] ${toneBg}`}>{label}</span>
      <span className="stat-num whitespace-nowrap text-[13px] text-ink-400">
        최근 <span className="font-semibold text-ink-100">{pick.recentPpg.toFixed(1)}</span>
        {" / 시즌 "}{pick.seasonPpg.toFixed(1)}
        <span className={`ml-1.5 font-semibold ${hot ? "text-flame-400" : "text-ink-300"}`}>
          ({sign}{pick.delta.toFixed(1)})
        </span>
      </span>
    </div>
  );
}

function StyleRow({
  label, hint, home, away, range, homeColor, awayColor, fmt, invert = false,
}: {
  label: string; hint?: string;
  home: number; away: number;
  range: { min: number; max: number };
  homeColor: string; awayColor: string;
  fmt: (v: number) => string;
  invert?: boolean;
}) {
  const span = range.max - range.min;
  // 범위가 0 이면 전부 같은 값 → 정중앙에 찍기
  const pct = (v: number) => (span > 0 ? ((v - range.min) / span) * 100 : 50);
  const homePct = pct(home);
  const awayPct = pct(away);
  // "더 좋은 값" 하이라이트 — invert(낮을수록 ↑)면 반대
  const homeBetter = invert ? home < away : home > away;
  return (
    <div className="grid grid-cols-[72px_1fr_72px] items-center gap-2 text-[13px]">
      <span
        className="stat-num text-right font-semibold"
        style={{ color: homeBetter ? homeColor : "#94a3b8" }}
      >
        {fmt(home)}
      </span>
      <div className="relative">
        <div className="flex items-center justify-between text-[11px] text-ink-500">
          <span className="truncate">{label}</span>
          {hint && <span className="text-ink-600">{hint}</span>}
        </div>
        <div className="relative mt-1 h-1.5 rounded bg-court-800">
          {/* 리그 중앙 틱 */}
          <span className="absolute left-1/2 top-[-2px] h-[9px] w-px bg-court-600" />
          {/* 양 팀 dot */}
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-court-950"
            style={{ left: `${homePct}%`, backgroundColor: homeColor }}
            title={`${fmt(home)}`}
          />
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-court-950"
            style={{ left: `${awayPct}%`, backgroundColor: awayColor }}
            title={`${fmt(away)}`}
          />
        </div>
      </div>
      <span
        className="stat-num font-semibold"
        style={{ color: !homeBetter ? awayColor : "#94a3b8" }}
      >
        {fmt(away)}
      </span>
    </div>
  );
}
