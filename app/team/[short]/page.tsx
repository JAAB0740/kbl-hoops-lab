import Link from "next/link";
import { notFound } from "next/navigation";
import { STANDINGS, STANDINGS_FILTERS, TEAM_COLORS, type FilteredTeam } from "@/lib/data";
import { ALL_GAMES, teamRecentForm, headToHead, fmtDate, gameToId } from "@/lib/gamesUtil";
import { teamPlayersBefore } from "@/lib/boxscores";
import { teamLogoSrc } from "@/lib/teamLogos";
import { detectPlayerStandouts } from "@/lib/standout";
import { getTeamShotChart } from "@/lib/shotChartsServer";
import { AreaShotChart } from "@/components/AreaShotChart";
import { HexShotMap } from "@/components/HexShotMap";
import teamAdvJson from "../../../data/season/49/team-advanced.json";
import clutchJson from "../../../data/season/49/clutch.json";

interface AdvRow {
  shortName: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  advanced: {
    offRtg: number; defRtg: number; netRtg: number;
    pace: number; efgPct: number; tsPct: number;
    orebPct: number; drebPct: number; rebPct: number;
    astPct: number; tovPct: number;
  };
}

// FilteredTeam (lib/data 정규화) — fgAtt 는 total (2pt + 3pt). raw json 직접 읽지 말 것.
const ADV: AdvRow[] = (teamAdvJson as { filters?: { all?: AdvRow[] } }).filters?.all ?? [];
const FIL_ALL  = STANDINGS_FILTERS.all;
const FIL_HOME = STANDINGS_FILTERS.home;
const FIL_AWAY = STANDINGS_FILTERS.away;
const FIL_Q4   = STANDINGS_FILTERS.q4;

const ROUND_KEYS = ["r1", "r2", "r3", "r4", "r5", "r6"] as const;
const FIL_ROUNDS: Record<(typeof ROUND_KEYS)[number], FilteredTeam[]> = {
  r1: STANDINGS_FILTERS.r1, r2: STANDINGS_FILTERS.r2, r3: STANDINGS_FILTERS.r3,
  r4: STANDINGS_FILTERS.r4, r5: STANDINGS_FILTERS.r5, r6: STANDINGS_FILTERS.r6,
};

// ─ 클러치 (선수 단위) ─
interface ClutchPlayer {
  teamName4: string; games: number; wins: number; losses: number;
  points: number;
  fgMade: number; fgAtt: number; threeMade: number; threeAtt: number;
  ftMade: number; ftAtt: number;
  turnovers: number;
}
const CLUTCH_PLAYERS: ClutchPlayer[] =
  (clutchJson as { players?: { regular?: ClutchPlayer[] } }).players?.regular ?? [];

interface Params { params: { short: string } }

export function generateStaticParams() {
  return STANDINGS.map((s) => ({ short: s.shortName }));
}

export function generateMetadata({ params }: Params) {
  const short = decodeURIComponent(params.short);
  const s = STANDINGS.find((t) => t.shortName === short);
  return { title: `${s?.name ?? short} · KBL Hoops Lab` };
}

export default function TeamDetailPage({ params }: Params) {
  const short = decodeURIComponent(params.short);
  const row = STANDINGS.find((s) => s.shortName === short);
  if (!row) notFound();

  const color = TEAM_COLORS[short] ?? "#94a3b8";
  const logo = teamLogoSrc(short);
  const adv = ADV.find((a) => a.shortName === short);
  const filAll = FIL_ALL.find((f) => f.shortName === short);
  const filHome = FIL_HOME.find((f) => f.shortName === short);
  const filAway = FIL_AWAY.find((f) => f.shortName === short);
  const filQ4 = FIL_Q4.find((f) => f.shortName === short);

  // 최근 10경기 폼
  const form = teamRecentForm(short, 10);

  // 로스터 — 평균 (출장 최소 3경기)
  const roster = teamPlayersBefore(short, "9999-12-31", "23:59", 3)
    .sort((a, b) => b.avg.ppg - a.avg.ppg);

  // 상대 팀별 H2H
  const opponents = STANDINGS.filter((s) => s.shortName !== short);
  const h2hRows = opponents.map((opp) => {
    const h = headToHead(short, opp.shortName);
    return {
      opp: opp.shortName,
      games: h.games.length,
      wins: h.aWins,
      losses: h.bWins,
    };
  });

  // 최근 5경기 (링크용)
  const recent5 = ALL_GAMES
    .filter((g) => g.status === "final" && (g.homeShort === short || g.awayShort === short))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, 5);

  // 다가오는 경기 top 3
  const now = new Date().toISOString().slice(0, 10);
  const upcoming = ALL_GAMES
    .filter((g) => g.status !== "final" && g.date >= now && (g.homeShort === short || g.awayShort === short))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 3);

  // 지난 10경기 중 이 팀 선수의 standout 수집, intensity 상위 5개
  const recent10Gmkeys = ALL_GAMES
    .filter((g) => g.status === "final" && (g.homeShort === short || g.awayShort === short) && g.gmkey)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, 10);
  const teamStandouts = recent10Gmkeys
    .flatMap((g) => {
      const items = detectPlayerStandouts(g.gmkey, 9).filter((s) => s.teamShort === short);
      return items.map((s) => ({ ...s, date: g.date, oppShort: g.homeShort === short ? g.awayShort : g.homeShort, gmkey: g.gmkey! }));
    })
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 5);

  // 리그 내 지표 순위
  function leagueRank(valueFn: (r: AdvRow) => number, lowerBetter = false): number | null {
    if (!adv) return null;
    const sorted = [...ADV].sort((a, b) => lowerBetter ? valueFn(a) - valueFn(b) : valueFn(b) - valueFn(a));
    return sorted.findIndex((r) => r.shortName === short) + 1 || null;
  }
  const rankOffRtg = leagueRank((r) => r.advanced.offRtg);
  const rankDefRtg = leagueRank((r) => r.advanced.defRtg, true);
  const rankNetRtg = leagueRank((r) => r.advanced.netRtg);
  const rankPace = leagueRank((r) => r.advanced.pace);
  const rankEfg = leagueRank((r) => r.advanced.efgPct);
  const rankTov = leagueRank((r) => r.advanced.tovPct, true);

  // 3점 의존도 랭킹 — filAll.stats 의 threeAtt / fgAtt 비율
  const threeRateRank = (() => {
    if (!filAll) return null;
    const rows = FIL_ALL
      .filter((r) => r.stats && (r.stats as unknown as { fgAtt: number }).fgAtt > 0)
      .map((r) => {
        const s = r.stats as unknown as { threeAtt: number; fgAtt: number };
        return { short: r.shortName, rate: s.threeAtt / s.fgAtt };
      })
      .sort((a, b) => b.rate - a.rate);
    const idx = rows.findIndex((r) => r.short === short);
    return idx >= 0 ? { rank: idx + 1, rate: rows[idx].rate } : null;
  })();

  // ─ 팀 identity 한 줄 ─ ORtg/DRtg/Pace/3점 비중 랭킹을 조합
  function identityLine(): string | null {
    if (!adv) return null;
    const parts: string[] = [];
    const oTop = rankOffRtg != null && rankOffRtg <= 3;
    const dTop = rankDefRtg != null && rankDefRtg <= 3;
    const oBot = rankOffRtg != null && rankOffRtg >= 8;
    const dBot = rankDefRtg != null && rankDefRtg >= 8;
    if (oTop && dTop) parts.push("리그 정상급 양면 팀");
    else if (oTop) parts.push("공격 특화");
    else if (dTop) parts.push("수비 특화");
    else if (oBot && dBot) parts.push("재건기 하위권");
    else if (adv.advanced.netRtg >= 0) parts.push("밸런스 상위권");
    else parts.push("성장통 중위권");
    if (rankPace != null && rankPace <= 3) parts.push("빠른 템포");
    else if (rankPace != null && rankPace >= 8) parts.push("느린 템포");
    if (threeRateRank && threeRateRank.rank <= 3) {
      parts.push(`3점 의존 (${(threeRateRank.rate * 100).toFixed(0)}%)`);
    } else if (threeRateRank && threeRateRank.rank >= 8) {
      parts.push("페인트 집중");
    }
    return parts.join(" · ");
  }
  const identity = identityLine();

  // 팀 슛 차트 — 로스터 pcode 합산
  const teamShotChart = getTeamShotChart(roster.map((p) => p.player.pcode), short);

  // ─── 팀 내 세부 지표 랭킹 헬퍼 ───
  function filRank(valueFn: (r: FilteredTeam) => number, lowerBetter = false): number | null {
    if (!filAll) return null;
    const sorted = [...FIL_ALL].sort((a, b) => lowerBetter ? valueFn(a) - valueFn(b) : valueFn(b) - valueFn(a));
    const idx = sorted.findIndex((r) => r.shortName === short);
    return idx >= 0 ? idx + 1 : null;
  }

  // ─ 슛 프로필 (team-specific) ─ fgAtt 는 total (2pt+3pt), threeAtt 는 3pt only
  const shotProfile = (() => {
    if (!filAll) return null;
    const s = filAll.stats;
    const fgAtt = s.fgAtt;
    const threeAtt = s.threeAtt;
    const ftAtt = s.ftAtt;
    const twoAtt = Math.max(0, fgAtt - threeAtt);
    const total = twoAtt + threeAtt + ftAtt;
    if (total <= 0) return null;
    const shareRank = (fn: (r: FilteredTeam) => number) => {
      const sorted = [...FIL_ALL].filter((r) => r.stats.fgAtt > 0).sort((a, b) => fn(b) - fn(a));
      const idx = sorted.findIndex((r) => r.shortName === short);
      return idx >= 0 ? idx + 1 : null;
    };
    const twoShare   = (twoAtt / total) * 100;
    const threeShare = (threeAtt / total) * 100;
    const ftShare    = (ftAtt / total) * 100;
    const rankTwo = shareRank((r) => {
      const a = r.stats.fgAtt, t = r.stats.threeAtt, f = r.stats.ftAtt;
      const tot = Math.max(0, a - t) + t + f;
      return tot > 0 ? (Math.max(0, a - t) / tot) : 0;
    });
    const rankThree = shareRank((r) => {
      const a = r.stats.fgAtt, t = r.stats.threeAtt, f = r.stats.ftAtt;
      const tot = Math.max(0, a - t) + t + f;
      return tot > 0 ? (t / tot) : 0;
    });
    const rankFt = shareRank((r) => {
      const a = r.stats.fgAtt, t = r.stats.threeAtt, f = r.stats.ftAtt;
      const tot = Math.max(0, a - t) + t + f;
      return tot > 0 ? (f / tot) : 0;
    });
    return { twoShare, threeShare, ftShare, total, rankTwo, rankThree, rankFt, twoAtt, threeAtt, ftAtt };
  })();

  // ─ 4팩터 (team-specific) ─
  const fourFactors = (() => {
    if (!adv || !filAll) return null;
    const fga = filAll.stats.fgAtt;
    const fta = filAll.stats.ftAtt;
    const ftaRate = fga > 0 ? (fta / fga) * 100 : 0;
    return {
      efg: adv.advanced.efgPct,  rankEfg: leagueRank((r) => r.advanced.efgPct),
      tov: adv.advanced.tovPct,  rankTov: leagueRank((r) => r.advanced.tovPct, true),
      oreb: adv.advanced.orebPct, rankOreb: leagueRank((r) => r.advanced.orebPct),
      ftaRate, rankFta: filRank((r) => (r.stats.fgAtt > 0 ? r.stats.ftAtt / r.stats.fgAtt : 0)),
    };
  })();

  // ─ 리바운드 (team-specific) ─
  const rebBlock = (() => {
    if (!filAll) return null;
    const s = filAll.stats;
    const oReb = s.oReb;
    const dReb = s.dReb;
    const total = oReb + dReb;
    return {
      oReb, dReb, total,
      rankO: filRank((r) => r.stats.oReb),
      rankD: filRank((r) => r.stats.dReb),
      rankT: filRank((r) => r.stats.oReb + r.stats.dReb),
      orebPct: adv?.advanced.orebPct, drebPct: adv?.advanced.drebPct, rebPct: adv?.advanced.rebPct,
    };
  })();

  // ─ 클러치 (team-specific) ─ 승률 ≤5점차 game-level + 선수 slash 합산
  const clutchBlock = (() => {
    if (!filAll) return null;
    let cWins = 0, cLosses = 0;
    for (const g of ALL_GAMES) {
      if (g.status !== "final" || g.homeScore == null || g.awayScore == null) continue;
      if (Math.abs(g.homeScore - g.awayScore) > 5) continue;
      const isHome = g.homeShort === short, isAway = g.awayShort === short;
      if (!isHome && !isAway) continue;
      const homeWon = g.homeScore > g.awayScore;
      const teamWon = (isHome && homeWon) || (isAway && !homeWon);
      if (teamWon) cWins++; else cLosses++;
    }
    const cGames = cWins + cLosses;
    if (cGames === 0) return null;
    const rows = CLUTCH_PLAYERS.filter((p) => p.teamName4 === short);
    const sum = (pick: (r: ClutchPlayer) => number) => rows.reduce((n, r) => n + pick(r) * r.games, 0);
    const totFgMade = sum((r) => r.fgMade);
    const totFgAtt  = sum((r) => r.fgAtt);
    const tot3Made  = sum((r) => r.threeMade);
    const tot3Att   = sum((r) => r.threeAtt);
    const totFtMade = sum((r) => r.ftMade);
    const totFtAtt  = sum((r) => r.ftAtt);
    const totPts    = sum((r) => r.points);
    const realMade = totFgMade + tot3Made;
    const realAtt  = totFgAtt + tot3Att;
    const clutchWinPct = cWins / cGames;
    const clutchFgPct = realAtt > 0 ? (realMade / realAtt) * 100 : 0;
    const clutch3Pct = tot3Att > 0 ? (tot3Made / tot3Att) * 100 : 0;
    const clutchFtPct = totFtAtt > 0 ? (totFtMade / totFtAtt) * 100 : 0;
    const clutchPPG = totPts / cGames;
    const regWinPct = filAll.winPct ?? (filAll.games > 0 ? filAll.wins / filAll.games : 0);
    return {
      cGames, cWins, cLosses,
      clutchWinPct, dWinPct: clutchWinPct - regWinPct,
      clutchFgPct, dFgPct: clutchFgPct - (filAll.stats.fgPct ?? 0),
      clutch3Pct,  d3Pct:  clutch3Pct  - (filAll.stats.threePct ?? 0),
      clutchFtPct, dFtPct: clutchFtPct - (filAll.stats.ftPct ?? 0),
      clutchPPG,   dPPG:   clutchPPG   - (filAll.stats.points ?? 0),
    };
  })();

  // ─ 라운드별 추이 (team-specific) ─ r1~r6 그 팀 row 만
  const roundTrend = ROUND_KEYS.map((k, i) => {
    const row = FIL_ROUNDS[k].find((r) => r.shortName === short);
    if (!row || row.games === 0) return { round: i + 1, has: false as const };
    return {
      round: i + 1, has: true as const,
      games: row.games, wins: row.wins, losses: row.losses,
      winPct: row.winPct,
      netRtg: row.advanced?.netRtg ?? null,
      offRtg: row.advanced?.offRtg ?? null,
      defRtg: row.advanced?.defRtg ?? null,
      efgPct: row.advanced?.efgPct ?? row.stats.fgPct,
      points: row.stats.points,
    };
  });

  // 팀 리더 — PPG/APG/RPG 1위 (출장 5경기 이상)
  const eligibleForLeader = roster.filter((p) => p.avg.games >= 5);
  const topScorer = [...eligibleForLeader].sort((a, b) => b.avg.ppg - a.avg.ppg)[0];
  const topAssist = [...eligibleForLeader].sort((a, b) => b.avg.apg - a.avg.apg)[0];
  const topReb = [...eligibleForLeader].sort((a, b) => b.avg.rpg - a.avg.rpg)[0];

  const wins = row.wins, losses = row.losses, games = wins + losses;
  const winPct = games > 0 ? (wins / games) * 100 : 0;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-3 py-8 md:px-6">
        {/* 뒤로가기 */}
        <Link
          href="/team"
          className="mb-4 inline-flex items-center gap-1 text-[15px] text-ink-400 hover:text-ink-100"
        >
          ← 팀 스탯 탐색
        </Link>

        {/* Sticky 식별 스트립 — 스크롤 시에도 어느 팀 페이지인지 인지 */}
        <div className="sticky top-14 z-40 -mx-3 mb-4 flex items-center gap-2 border-y border-court-700/60 bg-court-900/95 px-3 py-2 backdrop-blur md:-mx-6 md:px-6">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
          )}
          <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color }}>{short}</span>
          <span className="truncate text-[14px] font-semibold text-ink-100">{row.name}</span>
          <span className="ml-auto stat-num text-[13px] text-ink-400">
            {wins}-{losses}
            {adv && (
              <span className={`ml-2 ${adv.advanced.netRtg >= 0 ? "text-hoop-400" : "text-buzzer-400"}`}>
                Net {adv.advanced.netRtg >= 0 ? "+" : ""}{adv.advanced.netRtg.toFixed(1)}
              </span>
            )}
          </span>
        </div>

        {/* 헤더 */}
        <header className="mb-8 card p-6">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={short} className="h-full w-full object-contain" />
              ) : (
                <div
                  className="h-full w-full rounded-full opacity-70"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] uppercase tracking-[0.12em] text-ink-500">
                {row.rank != null ? `${row.rank}위` : "순위 미정"}
              </div>
              <h1 className="mt-1 text-2xl font-bold" style={{ color }}>
                {row.name}
              </h1>
              <div className="mt-1 stat-num text-[15px] text-ink-300">
                {wins}승 {losses}패 · 승률 {winPct.toFixed(1)}%
                {adv && (
                  <>
                    <span className="mx-2 text-ink-600">·</span>
                    Net <span className={adv.advanced.netRtg >= 0 ? "text-hoop-400" : "text-buzzer-400"}>
                      {adv.advanced.netRtg >= 0 ? "+" : ""}{adv.advanced.netRtg.toFixed(1)}
                    </span>
                    <span className="mx-2 text-ink-600">·</span>
                    Pace {adv.advanced.pace.toFixed(1)}
                  </>
                )}
              </div>
              {identity && (
                <p className="mt-2 text-[14px] font-medium" style={{ color }}>
                  {identity}
                </p>
              )}
            </div>
            {/* 최근 10경기 폼 */}
            <div className="flex flex-col items-end gap-1">
              <div className="text-[11px] uppercase tracking-wider text-ink-500">최근 10경기</div>
              <div className="flex gap-0.5">
                {form.length > 0 ? (
                  form.map((r, i) => (
                    <span
                      key={i}
                      className={[
                        "inline-flex h-5 w-5 items-center justify-center rounded text-[12px] font-bold",
                        r === "W"
                          ? "bg-hoop-500/30 text-hoop-300"
                          : "bg-buzzer-500/30 text-buzzer-300",
                      ].join(" ")}
                    >
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-ink-500">데이터 없음</span>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 분할 성적 */}
          <section className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-50">분할 성적</h3>
            <div className="space-y-2.5">
              <SplitRow label="전체" row={filAll} color={color} />
              <SplitRow label="홈" row={filHome} color={color} />
              <SplitRow label="원정" row={filAway} color={color} />
              {filQ4 && (
                <div className="mt-3 border-t border-court-700/60 pt-3">
                  <div className="flex items-baseline justify-between text-[14px]">
                    <span className="text-ink-300">Q4 평균 마진</span>
                    <span
                      className={`stat-num font-semibold ${(filQ4.stats.margin ?? 0) >= 0 ? "text-hoop-400" : "text-buzzer-400"}`}
                    >
                      {(filQ4.stats.margin ?? 0) >= 0 ? "+" : ""}
                      {(filQ4.stats.margin ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-ink-500">4쿼터 득실 마진 평균</p>
                </div>
              )}
            </div>
          </section>

          {/* 어드밴스드 */}
          <section className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-ink-50">
              어드밴스드 지표 <span className="ml-2 text-[11px] font-normal text-ink-500">리그 N위 표시</span>
            </h3>
            {adv ? (
              <div className="grid grid-cols-2 gap-3 text-[14px]">
                <AdvStat label="ORtg" value={adv.advanced.offRtg.toFixed(1)} caption="공격 효율" rank={rankOffRtg} />
                <AdvStat label="DRtg" value={adv.advanced.defRtg.toFixed(1)} caption="수비 효율 (↓ 좋음)" rank={rankDefRtg} />
                <AdvStat label="Net"  value={`${adv.advanced.netRtg >= 0 ? "+" : ""}${adv.advanced.netRtg.toFixed(1)}`} caption="순위 지표" rank={rankNetRtg} />
                <AdvStat label="Pace" value={adv.advanced.pace.toFixed(1)} caption="경기 속도" rank={rankPace} />
                <AdvStat label="eFG%" value={`${adv.advanced.efgPct.toFixed(1)}%`} caption="유효 야투율" rank={rankEfg} />
                <AdvStat label="TOV%" value={`${adv.advanced.tovPct.toFixed(1)}%`} caption="턴오버율 (↓ 좋음)" rank={rankTov} />
              </div>
            ) : (
              <p className="text-[14px] text-ink-500">데이터 없음</p>
            )}
          </section>
        </div>

        {/* 팀 리더 + 다가오는 경기 */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {(topScorer || topAssist || topReb) && (
            <section className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink-50">팀 리더</h3>
              <div className="space-y-2">
                <LeaderRow label="득점" tone="text-flame-400" entry={topScorer} key1="ppg" unit="PPG" />
                <LeaderRow label="어시스트" tone="text-hoop-400" entry={topAssist} key1="apg" unit="APG" />
                <LeaderRow label="리바운드" tone="text-neon-400" entry={topReb} key1="rpg" unit="RPG" />
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-ink-50">다가오는 경기</h3>
              <div className="space-y-1.5">
                {upcoming.map((g) => {
                  const isHome = g.homeShort === short;
                  const oppShort = isHome ? g.awayShort : g.homeShort;
                  const oppColor = TEAM_COLORS[oppShort] ?? "#94a3b8";
                  return (
                    <Link
                      key={gameToId(g)}
                      href={`/games/${gameToId(g)}`}
                      className="flex items-center justify-between rounded-md border border-court-700 bg-court-800/40 px-3 py-2 text-[14px] transition hover:border-court-600"
                    >
                      <span className="text-ink-400">
                        {fmtDate(g.date)} · {g.time} · {isHome ? "홈" : "원정"}
                      </span>
                      <span>
                        <span className="text-ink-500">vs </span>
                        <span className="font-semibold" style={{ color: oppColor }}>{oppShort}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* 슛 프로필 — 이 팀의 2P/3P/FT 시도 비중 + 각 리그 랭킹 */}
        {shotProfile && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">슛 프로필</h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                시도 비중 · 경기당 총 {shotProfile.total.toFixed(1)}회 · 괄호는 리그 N위
              </p>
            </div>
            {/* 100% stacked bar */}
            <div className="mb-3 h-4 w-full overflow-hidden rounded bg-court-700/40">
              <div className="flex h-full w-full">
                <div className="h-full bg-neon-500/80"   style={{ width: `${shotProfile.twoShare}%` }}   title={`2점 ${shotProfile.twoShare.toFixed(1)}%`} />
                <div className="h-full bg-buzzer-500/80" style={{ width: `${shotProfile.threeShare}%` }} title={`3점 ${shotProfile.threeShare.toFixed(1)}%`} />
                <div className="h-full bg-flame-400/80"  style={{ width: `${shotProfile.ftShare}%` }}    title={`FT ${shotProfile.ftShare.toFixed(1)}%`} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-[14px]">
              <ProfileTile label="2점 비중"   value={`${shotProfile.twoShare.toFixed(1)}%`}   rank={shotProfile.rankTwo}   tone="text-neon-400"   sub={`${shotProfile.twoAtt.toFixed(1)}회`} />
              <ProfileTile label="3점 의존도" value={`${shotProfile.threeShare.toFixed(1)}%`} rank={shotProfile.rankThree} tone="text-buzzer-400" sub={`${shotProfile.threeAtt.toFixed(1)}회`} />
              <ProfileTile label="자유투 의존" value={`${shotProfile.ftShare.toFixed(1)}%`}  rank={shotProfile.rankFt}    tone="text-flame-400"  sub={`${shotProfile.ftAtt.toFixed(1)}회`} />
            </div>
          </section>
        )}

        {/* 팀 슛 차트 — 로스터 합산 */}
        {teamShotChart && teamShotChart.totalShots > 0 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <AreaShotChart
              chart={teamShotChart}
              title="팀 슛 차트 — 방사형 14존"
              subtitle="로스터 합산 · 색은 zone 별 리그 평균 대비 ±%p"
            />
            <HexShotMap
              chart={teamShotChart}
              title="팀 헥스빈 — 시도량 × 효율"
              subtitle="크기 = 시도수, 색 = 리그 zone 평균 대비 FG%"
            />
          </div>
        )}

        {/* 4팩터 — 이 팀만 + 각 리그 랭킹 + 간단 설명 */}
        {fourFactors && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">4팩터 분석</h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                Dean Oliver 4팩터 · 괄호는 리그 N위
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <FactorTile label="eFG%"     value={`${fourFactors.efg.toFixed(1)}%`}     rank={fourFactors.rankEfg}  caption="슈팅 효율 (3점 가중)" />
              <FactorTile label="TOV%"     value={`${fourFactors.tov.toFixed(1)}%`}     rank={fourFactors.rankTov}  caption="턴오버 비율 (↓ 좋음)" />
              <FactorTile label="OREB%"    value={`${fourFactors.oreb.toFixed(1)}%`}    rank={fourFactors.rankOreb} caption="공격 리바운드 획득률" />
              <FactorTile label="FTA Rate" value={`${fourFactors.ftaRate.toFixed(1)}%`} rank={fourFactors.rankFta}  caption="FT/FG 자유투 의존도" />
            </div>
          </section>
        )}

        {/* 리바운드 — 이 팀만 + 각 리그 랭킹 */}
        {rebBlock && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">리바운드 분해</h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                경기당 평균 · 괄호는 리그 N위
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-[14px]">
              <ProfileTile label="공격 리바"
                value={rebBlock.oReb.toFixed(1)}
                rank={rebBlock.rankO}
                tone="text-flame-400"
                sub={rebBlock.orebPct != null ? `OREB% ${rebBlock.orebPct.toFixed(1)}` : undefined}
              />
              <ProfileTile label="수비 리바"
                value={rebBlock.dReb.toFixed(1)}
                rank={rebBlock.rankD}
                tone="text-neon-400"
                sub={rebBlock.drebPct != null ? `DREB% ${rebBlock.drebPct.toFixed(1)}` : undefined}
              />
              <ProfileTile label="총 리바"
                value={rebBlock.total.toFixed(1)}
                rank={rebBlock.rankT}
                tone="text-ink-100"
                sub={rebBlock.rebPct != null ? `REB% ${rebBlock.rebPct.toFixed(1)}` : undefined}
              />
            </div>
          </section>
        )}

        {/* 클러치 — 그 팀의 ≤5점차 경기 성과 + 시즌 대비 Δ */}
        {clutchBlock && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">클러치 (≤5점차 경기)</h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                4쿼터 마지막 5분이 아닌 game-level · {clutchBlock.cGames}경기 · 괄호 Δ = 클러치 − 시즌
              </p>
            </div>
            <div className="mb-3 flex flex-wrap items-baseline gap-3 text-[14px]">
              <span className="stat-num">
                <span className="font-bold text-ink-50">{clutchBlock.cWins}승 {clutchBlock.cLosses}패</span>
                <span className="mx-2 text-ink-600">·</span>
                <span className="font-semibold" style={{ color }}>승률 {(clutchBlock.clutchWinPct * 100).toFixed(1)}%</span>
                <span className={`ml-1 ${clutchBlock.dWinPct >= 0 ? "text-hoop-400" : "text-buzzer-400"}`}>
                  ({clutchBlock.dWinPct >= 0 ? "+" : ""}{(clutchBlock.dWinPct * 100).toFixed(1)}%p)
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ClutchTile label="FG%"  value={`${clutchBlock.clutchFgPct.toFixed(1)}%`} delta={clutchBlock.dFgPct} suffix="%p" />
              <ClutchTile label="3P%"  value={`${clutchBlock.clutch3Pct.toFixed(1)}%`}  delta={clutchBlock.d3Pct}  suffix="%p" />
              <ClutchTile label="FT%"  value={`${clutchBlock.clutchFtPct.toFixed(1)}%`} delta={clutchBlock.dFtPct} suffix="%p" />
              <ClutchTile label="PPG"  value={clutchBlock.clutchPPG.toFixed(1)}        delta={clutchBlock.dPPG}   suffix=""  caption="게임당 득점은 클러치 시간 짧아 시즌보다 작음" />
            </div>
          </section>
        )}

        {/* 라운드별 추이 — 이 팀의 1~6R 아크 */}
        {roundTrend.some((r) => r.has) && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">라운드별 추이</h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                정규시즌 라운드 단위 · NetRtg = ORtg − DRtg
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-court-700/60 text-[12px] uppercase tracking-wider text-ink-500">
                    <th className="py-2 pr-2 font-medium">R</th>
                    <th className="py-2 pr-2 text-right font-medium">G</th>
                    <th className="py-2 pr-2 text-right font-medium">W-L</th>
                    <th className="py-2 pr-2 text-right font-medium">승률</th>
                    <th className="py-2 pr-2 text-right font-medium">PPG</th>
                    <th className="py-2 pr-2 text-right font-medium">eFG%</th>
                    <th className="py-2 pr-2 text-right font-medium">ORtg</th>
                    <th className="py-2 pr-2 text-right font-medium">DRtg</th>
                    <th className="py-2 pr-2 text-right font-medium">NetRtg</th>
                  </tr>
                </thead>
                <tbody>
                  {roundTrend.map((r) => {
                    if (!r.has) {
                      return (
                        <tr key={r.round} className="border-b border-court-800/50 text-ink-600">
                          <td className="py-2 pr-2">{r.round}R</td>
                          <td colSpan={8} className="py-2 pr-2 text-right text-[12px]">미진행</td>
                        </tr>
                      );
                    }
                    const netTone =
                      r.netRtg != null
                        ? r.netRtg > 0 ? "text-hoop-400" : r.netRtg < 0 ? "text-buzzer-400" : "text-ink-300"
                        : "text-ink-500";
                    return (
                      <tr key={r.round} className="border-b border-court-800/50">
                        <td className="py-2 pr-2 font-semibold text-ink-100">{r.round}R</td>
                        <td className="stat-num py-2 pr-2 text-right text-ink-300">{r.games}</td>
                        <td className="stat-num py-2 pr-2 text-right text-ink-100">{r.wins}-{r.losses}</td>
                        <td className="stat-num py-2 pr-2 text-right text-ink-200">{(r.winPct * 100).toFixed(1)}%</td>
                        <td className="stat-num py-2 pr-2 text-right text-ink-300">{r.points.toFixed(1)}</td>
                        <td className="stat-num py-2 pr-2 text-right text-ink-300">{r.efgPct.toFixed(1)}</td>
                        <td className="stat-num py-2 pr-2 text-right text-ink-300">{r.offRtg != null ? r.offRtg.toFixed(1) : "—"}</td>
                        <td className="stat-num py-2 pr-2 text-right text-ink-300">{r.defRtg != null ? r.defRtg.toFixed(1) : "—"}</td>
                        <td className={`stat-num py-2 pr-2 text-right font-semibold ${netTone}`}>
                          {r.netRtg != null ? `${r.netRtg >= 0 ? "+" : ""}${r.netRtg.toFixed(1)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 최근 눈에 띄는 선수 */}
        {teamStandouts.length > 0 && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">최근 눈에 띄는 선수</h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                지난 10경기 · 시즌 평균 대비 Δ 큰 순
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {teamStandouts.map((s, i) => {
                const deltaColor = s.goodOrBad === "good" ? "text-hoop-400" : "text-buzzer-400";
                const arrow = s.direction === "up" ? "↑" : "↓";
                return (
                  <div
                    key={`${s.playerNo}-${i}`}
                    className="rounded-md border border-court-700/60 bg-court-800/40 p-3"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        href={`/players/${s.playerNo}`}
                        className="text-[15px] font-semibold text-ink-50 hover:text-flame-400"
                      >
                        {s.pname}
                      </Link>
                      <Link
                        href={`/games/${encodeURIComponent(s.gmkey)}`}
                        className="text-[11px] text-ink-500 hover:text-ink-300"
                      >
                        {fmtDate(s.date)} vs {s.oppShort} →
                      </Link>
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="stat-num text-xl font-bold text-ink-50">{s.fmtValue(s.gameValue)}</span>
                      <span className={`stat-num text-[13px] font-semibold ${deltaColor}`}>
                        {arrow} {s.fmtValue(Math.abs(s.delta))}
                      </span>
                      <span className="text-[11px] text-ink-500">{s.stat}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 로스터 — 평균 */}
        {roster.length > 0 && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">로스터</h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                시즌 누적 평균 · 출장 3경기 이상 · 선수명 클릭 시 프로필
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-court-700/60 text-[12px] uppercase tracking-wider text-ink-500">
                    <th className="py-2 pr-2 font-medium">선수</th>
                    <th className="py-2 pr-2 text-right font-medium">G</th>
                    <th className="py-2 pr-2 text-right font-medium">MIN</th>
                    <th className="py-2 pr-2 text-right font-medium">PPG</th>
                    <th className="py-2 pr-2 text-right font-medium">RPG</th>
                    <th className="py-2 pr-2 text-right font-medium">APG</th>
                    <th className="py-2 pr-2 text-right font-medium">FG%</th>
                    <th className="py-2 pr-2 text-right font-medium">3P%</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p) => (
                    <tr key={p.player.pcode} className="border-b border-court-800/50">
                      <td className="py-2 pr-2">
                        <Link
                          href={`/players/${p.player.pcode}`}
                          className="font-medium text-ink-50 hover:text-flame-400"
                        >
                          {p.player.pname}
                        </Link>
                        {p.player.pos && (
                          <span className="ml-2 text-[11px] text-ink-500">{p.player.pos}</span>
                        )}
                      </td>
                      <td className="stat-num py-2 pr-2 text-right text-ink-400">{p.avg.games}</td>
                      <td className="stat-num py-2 pr-2 text-right text-ink-400">{p.avg.mpg.toFixed(1)}</td>
                      <td className="stat-num py-2 pr-2 text-right font-semibold text-ink-100">{p.avg.ppg.toFixed(1)}</td>
                      <td className="stat-num py-2 pr-2 text-right text-ink-200">{p.avg.rpg.toFixed(1)}</td>
                      <td className="stat-num py-2 pr-2 text-right text-ink-200">{p.avg.apg.toFixed(1)}</td>
                      <td className="stat-num py-2 pr-2 text-right text-ink-300">{p.avg.fgPct.toFixed(1)}</td>
                      <td className="stat-num py-2 pr-2 text-right text-ink-300">{p.avg.threePct.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 상대팀별 H2H */}
        <section className="card mt-6 p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-50">상대팀별 성적</h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {h2hRows.map((h) => {
              const oppColor = TEAM_COLORS[h.opp] ?? "#94a3b8";
              const pct = h.games > 0 ? ((h.wins / h.games) * 100).toFixed(0) : "—";
              return (
                <Link
                  key={h.opp}
                  href={`/team/${encodeURIComponent(h.opp)}`}
                  className="rounded-md border border-court-700/60 bg-court-800/40 p-3 transition hover:border-court-600"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium" style={{ color: oppColor }}>
                      vs {h.opp}
                    </span>
                    {h.games > 0 && (
                      <span className="text-[11px] text-ink-500">{pct}%</span>
                    )}
                  </div>
                  <div className="stat-num mt-1 text-[16px] font-bold text-ink-50">
                    {h.games > 0 ? `${h.wins}-${h.losses}` : "—"}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 최근 5경기 링크 */}
        {recent5.length > 0 && (
          <section className="card mt-6 p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-50">최근 5경기</h3>
            <div className="space-y-1.5">
              {recent5.map((g) => {
                const isHome = g.homeShort === short;
                const my = isHome ? g.homeScore : g.awayScore;
                const opp = isHome ? g.awayScore : g.homeScore;
                const oppShort = isHome ? g.awayShort : g.homeShort;
                const won = my != null && opp != null && my > opp;
                return (
                  <Link
                    key={gameToId(g)}
                    href={`/games/${gameToId(g)}`}
                    className="flex items-center justify-between rounded-md border border-court-700 bg-court-800/40 px-3 py-2 text-[14px] transition hover:border-court-600"
                  >
                    <span className="text-ink-400">
                      {fmtDate(g.date)} · {isHome ? "홈" : "원정"} vs {oppShort}
                    </span>
                    <span className="stat-num font-medium">
                      <span className={won ? "text-hoop-400" : "text-buzzer-400"}>
                        {won ? "W" : "L"}
                      </span>
                      <span className="ml-2 text-ink-200">{my} - {opp}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <footer className="mt-8 text-center text-[13px] text-ink-500">
          데이터 출처: KBL 공식 API · 2026-27 정규리그
        </footer>
      </main>
    </div>
  );
}

function SplitRow({ label, row, color }: { label: string; row?: FilteredTeam; color: string }) {
  if (!row) {
    return (
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="text-ink-300">{label}</span>
        <span className="text-ink-500">데이터 없음</span>
      </div>
    );
  }
  const pct = (row.winPct * 100).toFixed(1);
  return (
    <div className="flex items-baseline justify-between text-[14px]">
      <span className="text-ink-300">{label}</span>
      <span className="stat-num">
        <span className="font-semibold text-ink-100">{row.wins}승 {row.losses}패</span>
        <span className="ml-2 font-semibold" style={{ color }}>{pct}%</span>
      </span>
    </div>
  );
}

function AdvStat({ label, value, caption, rank }: { label: string; value: string; caption: string; rank?: number | null }) {
  const rankChip = rank != null ? (rank <= 3 ? "text-flame-400" : rank >= 8 ? "text-buzzer-400" : "text-ink-400") : "text-ink-500";
  return (
    <div className="rounded-md border border-court-700/60 bg-court-800/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] uppercase tracking-wider text-ink-500">{label}</span>
        {rank != null && (
          <span className={`stat-num text-[11px] font-semibold ${rankChip}`}>리그 {rank}위</span>
        )}
      </div>
      <div className="stat-num mt-1 text-xl font-bold text-ink-50">{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-500">{caption}</div>
    </div>
  );
}

function ProfileTile({
  label, value, rank, tone, sub,
}: { label: string; value: string; rank: number | null; tone: string; sub?: string }) {
  const rankTone = rank != null ? (rank <= 3 ? "text-flame-400" : rank >= 8 ? "text-buzzer-400" : "text-ink-400") : "text-ink-500";
  return (
    <div className="rounded-md border border-court-700/60 bg-court-800/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] uppercase tracking-wider text-ink-500">{label}</span>
        {rank != null && <span className={`stat-num text-[11px] font-semibold ${rankTone}`}>리그 {rank}위</span>}
      </div>
      <div className={`stat-num mt-1 text-xl font-bold ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

function FactorTile({
  label, value, rank, caption,
}: { label: string; value: string; rank: number | null; caption: string }) {
  const rankTone = rank != null ? (rank <= 3 ? "text-flame-400" : rank >= 8 ? "text-buzzer-400" : "text-ink-400") : "text-ink-500";
  return (
    <div className="rounded-md border border-court-700/60 bg-court-800/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] uppercase tracking-wider text-ink-500">{label}</span>
        {rank != null && <span className={`stat-num text-[11px] font-semibold ${rankTone}`}>리그 {rank}위</span>}
      </div>
      <div className="stat-num mt-1 text-xl font-bold text-ink-50">{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-500">{caption}</div>
    </div>
  );
}

function ClutchTile({
  label, value, delta, suffix, caption,
}: { label: string; value: string; delta: number; suffix: string; caption?: string }) {
  const tone = delta > 0 ? "text-hoop-400" : delta < 0 ? "text-buzzer-400" : "text-ink-400";
  return (
    <div className="rounded-md border border-court-700/60 bg-court-800/40 p-3">
      <div className="text-[12px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="stat-num text-xl font-bold text-ink-50">{value}</span>
        <span className={`stat-num text-[13px] font-semibold ${tone}`}>
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}{suffix}
        </span>
      </div>
      {caption && <div className="mt-0.5 text-[11px] text-ink-500">{caption}</div>}
    </div>
  );
}

function LeaderRow({
  label, tone, entry, key1, unit,
}: {
  label: string;
  tone: string;
  entry?: { player: { pcode: string; pname: string }; avg: { ppg: number; apg: number; rpg: number; games: number } };
  key1: "ppg" | "apg" | "rpg";
  unit: string;
}) {
  if (!entry) {
    return (
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="w-20 text-ink-500">{label}</span>
        <span className="text-ink-500">—</span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-2 text-[14px]">
      <span className="w-20 shrink-0 text-[12px] uppercase tracking-wider text-ink-500">{label}</span>
      <Link href={`/players/${entry.player.pcode}`} className="flex-1 truncate text-ink-100 hover:text-flame-400">
        {entry.player.pname}
      </Link>
      <span className="stat-num">
        <span className={`font-semibold ${tone}`}>{entry.avg[key1].toFixed(1)}</span>
        <span className="ml-0.5 text-[12px] text-ink-500">{unit}</span>
        <span className="ml-1.5 text-[12px] text-ink-600">({entry.avg.games}G)</span>
      </span>
    </div>
  );
}
