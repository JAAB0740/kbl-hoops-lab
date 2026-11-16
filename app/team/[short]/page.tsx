import Link from "next/link";
import { notFound } from "next/navigation";
import { STANDINGS, TEAM_COLORS } from "@/lib/data";
import { ALL_GAMES, teamRecentForm, headToHead, fmtDate, gameToId } from "@/lib/gamesUtil";
import { teamPlayersBefore } from "@/lib/boxscores";
import { teamLogoSrc } from "@/lib/teamLogos";
import teamAdvJson from "../../../data/season/49/team-advanced.json";
import teamFilteredJson from "../../../data/season/49/team-filtered.json";

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
interface FilRow {
  shortName: string;
  games: number;
  wins: number;
  losses: number;
  winPct?: number;
  stats: { points: number; margin?: number };
}

const ADV: AdvRow[] = (teamAdvJson as { filters?: { all?: AdvRow[] } }).filters?.all ?? [];
const FIL_ALL: FilRow[] = (teamFilteredJson as { filters?: { all?: FilRow[] } }).filters?.all ?? [];
const FIL_HOME: FilRow[] = (teamFilteredJson as { filters?: { home?: FilRow[] } }).filters?.home ?? [];
const FIL_AWAY: FilRow[] = (teamFilteredJson as { filters?: { away?: FilRow[] } }).filters?.away ?? [];
const FIL_Q4: FilRow[] = (teamFilteredJson as { filters?: { q4?: FilRow[] } }).filters?.q4 ?? [];

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
              어드밴스드 지표
            </h3>
            {adv ? (
              <div className="grid grid-cols-2 gap-3 text-[14px]">
                <AdvStat label="ORtg" value={adv.advanced.offRtg.toFixed(1)} caption="공격 효율" />
                <AdvStat label="DRtg" value={adv.advanced.defRtg.toFixed(1)} caption="수비 효율 (↓ 좋음)" />
                <AdvStat label="eFG%" value={`${adv.advanced.efgPct.toFixed(1)}%`} caption="유효 야투율" />
                <AdvStat label="TS%" value={`${adv.advanced.tsPct.toFixed(1)}%`} caption="진정 야투율" />
                <AdvStat label="OReb%" value={`${adv.advanced.orebPct.toFixed(1)}%`} caption="공격 리바 점유율" />
                <AdvStat label="TOV%" value={`${adv.advanced.tovPct.toFixed(1)}%`} caption="턴오버율 (↓ 좋음)" />
              </div>
            ) : (
              <p className="text-[14px] text-ink-500">데이터 없음</p>
            )}
          </section>
        </div>

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

function SplitRow({ label, row, color }: { label: string; row?: FilRow; color: string }) {
  if (!row) {
    return (
      <div className="flex items-baseline justify-between text-[14px]">
        <span className="text-ink-300">{label}</span>
        <span className="text-ink-500">데이터 없음</span>
      </div>
    );
  }
  const pct = row.winPct != null ? (row.winPct * 100).toFixed(1) : "—";
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

function AdvStat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-md border border-court-700/60 bg-court-800/40 p-3">
      <div className="text-[12px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="stat-num mt-1 text-xl font-bold text-ink-50">{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-500">{caption}</div>
    </div>
  );
}
