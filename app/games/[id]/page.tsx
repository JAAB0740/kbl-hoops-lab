import Link from "next/link";
import { notFound } from "next/navigation";
import { TEAM_COLORS } from "@/lib/data";
import {
  ALL_GAMES,
  fmtDate,
  findGameById,
  gameToId,
  headToHead,
  standingsAsOf,
  teamRecentForm,
  teamScoringBefore,
} from "@/lib/gamesUtil";
import {
  getBoxScore,
  teamPlayersBefore,
  type PlayerInfo,
  type PlayerSeasonAvg,
} from "@/lib/boxscores";
import { BoxScoreTable } from "@/components/BoxScoreTable";
import { QuarterScoreBox } from "@/components/QuarterScoreBox";
import { getMatchDetail, fmtKblTime } from "@/lib/matchDetails";

interface Props {
  params: { id: string };
}

export const dynamicParams = true;

export default function GameDetailPage({ params }: Props) {
  const game = findGameById(params.id);
  if (!game) return notFound();

  const homeColor = TEAM_COLORS[game.homeShort] ?? "#94a3b8";
  const awayColor = TEAM_COLORS[game.awayShort] ?? "#94a3b8";

  // 이 경기 시점 이전의 폼 / H2H (시즌 개막전 등에서 미래 경기 끌어오지 않게)
  const homeForm = teamRecentForm(game.homeShort, 5, game.date, game.time);
  const awayForm = teamRecentForm(game.awayShort, 5, game.date, game.time);
  const h2h = headToHead(
    game.homeShort,
    game.awayShort,
    game.date,
    game.time,
  );

  const isFinal = game.status === "final";

  // 경기 시점 기준 정규시즌 W-L + 순위
  const standingsAtTime = standingsAsOf(game.date, game.time);
  const homeStandingAt = standingsAtTime.find((s) => s.team === game.homeShort);
  const awayStandingAt = standingsAtTime.find((s) => s.team === game.awayShort);

  // 경기 직전까지의 시즌 평균 점수 통계 (전체 + 최근 5경기)
  const homeSeasonScoring = teamScoringBefore(game.homeShort, game.date, game.time);
  const awaySeasonScoring = teamScoringBefore(game.awayShort, game.date, game.time);
  const homeRecent5 = teamScoringBefore(game.homeShort, game.date, game.time, { lastN: 5 });
  const awayRecent5 = teamScoringBefore(game.awayShort, game.date, game.time, { lastN: 5 });

  // 양 팀 게임 시점 누적 평균 기준 주요 선수 (박스스코어 데이터가 있을 때만)
  const homeKeyPlayers = pickKeyPlayers(game.homeShort, game.date, game.time);
  const awayKeyPlayers = pickKeyPlayers(game.awayShort, game.date, game.time);

  // 게임 박스스코어 (있으면 표시)
  const boxScore = getBoxScore(game.gmkey);

  // 시리즈 정보 (PO일 때): 같은 두 팀, 같은 라운드의 다른 경기들
  const seriesGames = game.tag !== "정규리그"
    ? ALL_GAMES.filter(
        (g) =>
          g.tag === game.tag &&
          ((g.homeShort === game.homeShort && g.awayShort === game.awayShort) ||
            (g.homeShort === game.awayShort && g.awayShort === game.homeShort)),
      ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    : [];

  let seriesHomeWins = 0,
    seriesAwayWins = 0;
  for (const g of seriesGames) {
    if (g.status !== "final" || g.homeScore == null || g.awayScore == null)
      continue;
    const homeWonGame = g.homeScore > g.awayScore;
    const winner = homeWonGame ? g.homeShort : g.awayShort;
    if (winner === game.homeShort) seriesHomeWins++;
    else seriesAwayWins++;
  }

  const myIndex = seriesGames.findIndex(
    (g) =>
      g.date === game.date &&
      g.time === game.time &&
      g.homeShort === game.homeShort,
  );

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* 뒤로가기 */}
        <Link
          href="/games"
          className="mb-4 inline-flex items-center gap-1 text-[14px] text-ink-400 hover:text-ink-100"
        >
          ← 경기 목록
        </Link>

        {/* 헤더 */}
        <header className="mb-8 card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "chip",
                  game.tag === "정규리그"
                    ? "border-court-700 bg-court-800/70 text-ink-300"
                    : game.tag === "챔피언결정전"
                      ? "border-flame-500/50 bg-flame-500/15 text-flame-300"
                      : "border-neon-500/40 bg-neon-500/10 text-neon-300",
                ].join(" ")}
              >
                {game.tag}
              </span>
              {seriesGames.length > 1 && (
                <span className="chip border-court-700 bg-court-800/70 text-ink-300">
                  G{myIndex + 1} / {seriesGames.length}
                </span>
              )}
              <span className="text-[14px] text-ink-400">
                {fmtDate(game.date)} · {game.time}
                {game.stadium && (
                  <>
                    <span className="mx-1 text-ink-600">·</span>
                    <span className="text-ink-300">{game.stadium}</span>
                  </>
                )}
              </span>
            </div>
            <span
              className={[
                "chip",
                isFinal
                  ? "border-court-700 bg-court-800/60 text-ink-400"
                  : game.status === "live"
                    ? "border-buzzer-500/40 bg-buzzer-500/10 text-buzzer-400"
                    : "border-flame-500/30 bg-flame-500/10 text-flame-400",
              ].join(" ")}
            >
              {isFinal ? "종료" : game.status === "live" ? "진행 중" : "예정"}
            </span>
          </div>

          {/* 스코어 보드 */}
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <TeamHeader
              full={game.homeTeam}
              short={game.homeShort}
              color={homeColor}
              role="홈"
              standing={homeStandingAt}
              align="right"
            />
            <div className="text-center">
              {isFinal ? (
                <div className="stat-num text-5xl font-bold leading-none md:text-6xl">
                  <span style={{ color: homeColor }}>{game.homeScore}</span>
                  <span className="mx-3 text-ink-500">-</span>
                  <span style={{ color: awayColor }}>{game.awayScore}</span>
                </div>
              ) : (
                <div className="stat-num text-2xl text-ink-300">VS</div>
              )}
              {seriesGames.length > 1 && (
                <div className="mt-3 text-[14px] text-ink-400">
                  시리즈:{" "}
                  <span className="font-semibold" style={{ color: homeColor }}>
                    {seriesHomeWins}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold" style={{ color: awayColor }}>
                    {seriesAwayWins}
                  </span>
                </div>
              )}
            </div>
            <TeamHeader
              full={game.awayTeam}
              short={game.awayShort}
              color={awayColor}
              role="원정"
              standing={awayStandingAt}
              align="left"
            />
          </div>
        </header>

        {/* 쿼터별 스코어 + 관중 (final 게임만, 데이터 있을 때만) */}
        {isFinal && getMatchDetail(game.gmkey) && (
          <section className="card mb-6 p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink-50">쿼터별 스코어</h3>
              <div className="flex items-center gap-3 text-[13px] text-ink-500">
                {(() => {
                  const md = getMatchDetail(game.gmkey)!;
                  const parts: string[] = [];
                  if (md.gameStart) parts.push(`시작 ${fmtKblTime(md.gameStart)}`);
                  if (md.gameEnd)   parts.push(`종료 ${fmtKblTime(md.gameEnd)}`);
                  if (md.crowds != null) parts.push(`관중 ${md.crowds.toLocaleString()}명`);
                  return parts.length > 0 ? <span>{parts.join(" · ")}</span> : null;
                })()}
              </div>
            </div>
            <QuarterScoreBox
              gmkey={game.gmkey}
              homeShort={game.homeShort}
              awayShort={game.awayShort}
              homeFull={game.homeTeam}
              awayFull={game.awayTeam}
              size="md"
            />
          </section>
        )}

        {/* 시리즈 게임 리스트 (PO일 때) */}
        {seriesGames.length > 1 && (
          <section className="card mb-6 p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-50">
              시리즈 ({seriesGames.length}경기)
            </h3>
            <div className="space-y-1.5">
              {seriesGames.map((g, i) => {
                const isCurrent =
                  g.date === game.date &&
                  g.time === game.time &&
                  g.homeShort === game.homeShort;
                const f = g.status === "final";
                const homeWonGame =
                  f && g.homeScore != null && g.awayScore != null && g.homeScore > g.awayScore;
                return (
                  <Link
                    key={i}
                    href={`/games/${gameToId(g)}`}
                    className={[
                      "flex items-center justify-between rounded-md border px-3 py-2 text-[14px] transition",
                      isCurrent
                        ? "border-flame-500/40 bg-flame-500/10"
                        : "border-court-700 bg-court-800/40 hover:border-court-600",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-3">
                      <span className="stat-num text-ink-500">G{i + 1}</span>
                      <span className="text-ink-400">{fmtDate(g.date)}</span>
                    </span>
                    <span className="stat-num font-medium">
                      {f ? (
                        <>
                          <span
                            className={
                              homeWonGame ? "text-ink-50 font-bold" : "text-ink-400"
                            }
                          >
                            {g.homeShort} {g.homeScore}
                          </span>
                          <span className="mx-1 text-ink-500">-</span>
                          <span
                            className={
                              !homeWonGame ? "text-ink-50 font-bold" : "text-ink-400"
                            }
                          >
                            {g.awayScore} {g.awayShort}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-ink-400">
                            {g.homeShort} vs {g.awayShort}
                          </span>
                          <span className="ml-2 text-ink-500">{g.time}</span>
                        </>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 경기 직전까지의 점수 통계 (게임 단위 합산이라 정확) */}
          {(homeSeasonScoring.games > 0 || awaySeasonScoring.games > 0) && (
            <section className="card p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-ink-50">
                  경기 직전까지의 평균
                </h3>
                <p className="mt-0.5 text-[13px] text-ink-500">
                  이 경기 직전까지 치른 모든 경기의 평균 ·{" "}
                  <span style={{ color: homeColor }}>{game.homeShort}</span>{" "}
                  {homeSeasonScoring.games}경기 ·{" "}
                  <span style={{ color: awayColor }}>{game.awayShort}</span>{" "}
                  {awaySeasonScoring.games}경기
                </p>
              </div>

              <div className="space-y-2">
                {/* 시즌 누적 평균 */}
                <div className="text-[12px] uppercase tracking-wider text-ink-500 mt-1">
                  시즌 누적 평균
                </div>
                <CompareRow
                  label="PPG"
                  l={homeSeasonScoring.ppg}
                  r={awaySeasonScoring.ppg}
                  fmt={(v) => v.toFixed(1)}
                  homeColor={homeColor}
                  awayColor={awayColor}
                />
                <CompareRow
                  label="실점 (OPPG)"
                  l={homeSeasonScoring.oppPpg}
                  r={awaySeasonScoring.oppPpg}
                  fmt={(v) => v.toFixed(1)}
                  invert
                  homeColor={homeColor}
                  awayColor={awayColor}
                />
                <CompareRow
                  label="평균 마진"
                  l={homeSeasonScoring.margin}
                  r={awaySeasonScoring.margin}
                  fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`}
                  homeColor={homeColor}
                  awayColor={awayColor}
                />

                {/* 최근 5경기 */}
                {homeRecent5.games > 0 && awayRecent5.games > 0 && (
                  <>
                    <div className="text-[12px] uppercase tracking-wider text-ink-500 mt-3 pt-2 border-t border-court-700/40">
                      최근 5경기 평균 (이 경기 직전)
                    </div>
                    <CompareRow
                      label="PPG"
                      l={homeRecent5.ppg}
                      r={awayRecent5.ppg}
                      fmt={(v) => v.toFixed(1)}
                      homeColor={homeColor}
                      awayColor={awayColor}
                    />
                    <CompareRow
                      label="실점 (OPPG)"
                      l={homeRecent5.oppPpg}
                      r={awayRecent5.oppPpg}
                      fmt={(v) => v.toFixed(1)}
                      invert
                      homeColor={homeColor}
                      awayColor={awayColor}
                    />
                    <CompareRow
                      label="평균 마진"
                      l={homeRecent5.margin}
                      r={awayRecent5.margin}
                      fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`}
                      homeColor={homeColor}
                      awayColor={awayColor}
                    />
                  </>
                )}
              </div>
              <p className="mt-3 text-[12px] text-ink-500">
                ※ 게임 단위 점수만 사용 (KBL API 박스스코어가 없어서 RPG/APG/FG% 등은 시점 기준 계산 불가).
              </p>
            </section>
          )}

          {/* H2H + 최근 폼 — 모두 이 경기 시점 이전 기준 */}
          <section className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-50">
              경기 직전 상대전적 &amp; 폼
            </h3>

            {/* H2H */}
            <div className="mb-4 grid grid-cols-3 items-end gap-2">
              <div className="text-right">
                <div className="text-[12px] uppercase tracking-wider text-ink-500">
                  {game.homeShort}
                </div>
                <div
                  className="stat-num text-3xl font-bold"
                  style={{ color: homeColor }}
                >
                  {h2h.aWins}
                </div>
              </div>
              <div className="text-center text-[14px] text-ink-500">
                이전 H2H<br />
                {h2h.games.length === 0 ? (
                  <span className="text-[12px] text-ink-600">맞대결 없음</span>
                ) : (
                  <>({h2h.games.length}회)</>
                )}
              </div>
              <div className="text-left">
                <div className="text-[12px] uppercase tracking-wider text-ink-500">
                  {game.awayShort}
                </div>
                <div
                  className="stat-num text-3xl font-bold"
                  style={{ color: awayColor }}
                >
                  {h2h.bWins}
                </div>
              </div>
            </div>

            {/* 최근 폼 */}
            <div className="space-y-3 border-t border-court-700/40 pt-3">
              <FormBlock
                short={game.homeShort}
                color={homeColor}
                form={homeForm}
              />
              <FormBlock
                short={game.awayShort}
                color={awayColor}
                form={awayForm}
              />
            </div>
          </section>
        </div>

        {/* 이전 맞대결 — h2h.games 는 이미 game.date+time 기준 필터됨 */}
        {h2h.games.length > 0 && (
          <section className="card mt-6 p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink-50">
                  이 경기 이전 맞대결 ({h2h.games.length}경기)
                </h3>
                <p className="mt-0.5 text-[13px] text-ink-500">
                  이 경기 직전까지의 시즌 H2H ·{" "}
                  <span className="stat-num">
                    <span style={{ color: TEAM_COLORS[game.homeShort] }}>
                      {game.homeShort} {h2h.aWins}
                    </span>
                    {" - "}
                    <span style={{ color: TEAM_COLORS[game.awayShort] }}>
                      {h2h.bWins} {game.awayShort}
                    </span>
                  </span>
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              {[...h2h.games].reverse().slice(0, 8).map((g, i) => {
                  const homeWonGame =
                    g.homeScore != null &&
                    g.awayScore != null &&
                    g.homeScore > g.awayScore;
                  return (
                    <Link
                      key={i}
                      href={`/games/${gameToId(g)}`}
                      className="flex items-center justify-between rounded-md border border-court-700 bg-court-800/40 px-3 py-2 text-[14px] transition hover:border-court-600"
                    >
                      <span className="text-ink-400">
                        {fmtDate(g.date)} · {g.tag}
                      </span>
                      <span className="stat-num">
                        <span
                          className={
                            homeWonGame
                              ? "text-ink-50 font-bold"
                              : "text-ink-400"
                          }
                          style={{ color: homeWonGame ? TEAM_COLORS[g.homeShort] : undefined }}
                        >
                          {g.homeShort} {g.homeScore}
                        </span>
                        <span className="mx-1.5 text-ink-500">-</span>
                        <span
                          className={
                            !homeWonGame
                              ? "text-ink-50 font-bold"
                              : "text-ink-400"
                          }
                          style={{ color: !homeWonGame ? TEAM_COLORS[g.awayShort] : undefined }}
                        >
                          {g.awayScore} {g.awayShort}
                        </span>
                      </span>
                    </Link>
                  );
                })}
            </div>
          </section>
        )}

        {/* 박스스코어 — 데이터 있으면 우선 표시 */}
        {boxScore && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">
                박스스코어
              </h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                ★ = 선발 · MIN = 출장시간 (분:초) · REB 옆 (공/수) · KBL 공식 데이터
              </p>
            </div>
            <BoxScoreTable
              box={boxScore}
              homeShort={game.homeShort}
              awayShort={game.awayShort}
              homeFull={game.homeTeam}
              awayFull={game.awayTeam}
            />
          </section>
        )}

        {/* 양 팀 주요 선수 (게임 시점 누적 평균) */}
        {(homeKeyPlayers.scorer || awayKeyPlayers.scorer) && (
          <section className="card mt-6 p-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-ink-50">
                주목할 선수
              </h3>
              <p className="mt-0.5 text-[13px] text-ink-500">
                이 경기 직전까지의 누적 평균 (박스스코어 기반) · 클릭 시 선수 프로필
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <KeyPlayersBlock
                shortName={game.homeShort}
                color={homeColor}
                players={homeKeyPlayers}
                align="left"
              />
              <KeyPlayersBlock
                shortName={game.awayShort}
                color={awayColor}
                players={awayKeyPlayers}
                align="right"
              />
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-[13px] text-ink-500">
          {game.gmkey ? (
            <>
              KBL 공식 데이터 · 게임 코드 {game.gmkey}
              {game.gmkey && (
                <>
                  {" · "}
                  <a
                    href={`https://www.kbl.or.kr/match/record/${game.gmkey}/${game.date.replace(/-/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-flame-400 hover:underline"
                  >
                    KBL 공식 페이지 →
                  </a>
                </>
              )}
            </>
          ) : (
            <a
              href={`https://www.kbl.or.kr/match/schedule/regular`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-flame-400 hover:underline"
            >
              KBL 공식 →
            </a>
          )}
        </p>
      </main>
    </div>
  );
}

type KeyPlayer = { player: PlayerInfo; avg: PlayerSeasonAvg } | null;
type KeyPlayers = {
  scorer: KeyPlayer;
  playmaker: KeyPlayer;
  rebounder: KeyPlayer;
};

/**
 * 박스스코어 누적 데이터 → 게임 시점 직전까지의 팀 핵심 선수 픽.
 * 박스스코어 fetch 가 안 됐거나 출장 게임이 적으면 null.
 */
function pickKeyPlayers(
  teamShort: string,
  beforeDate: string,
  beforeTime: string,
): KeyPlayers {
  // 시즌 초반엔 minGames 낮게, 후반엔 5+
  const list = teamPlayersBefore(teamShort, beforeDate, beforeTime, 1);
  if (list.length === 0) return { scorer: null, playmaker: null, rebounder: null };
  const top = (k: keyof PlayerSeasonAvg) =>
    [...list].sort((a, b) => (b.avg[k] as number) - (a.avg[k] as number))[0] ?? null;
  return {
    scorer: top("ppg"),
    playmaker: top("apg"),
    rebounder: top("rpg"),
  };
}

function KeyPlayersBlock({
  shortName,
  color,
  players,
  align,
}: {
  shortName: string;
  color: string;
  players: KeyPlayers;
  align: "left" | "right";
}) {
  const items: {
    label: string;
    entry: KeyPlayer;
    valueKey: keyof PlayerSeasonAvg;
    unit: string;
    tone: string;
  }[] = [
    { label: "득점왕", entry: players.scorer, valueKey: "ppg", unit: "PPG", tone: "text-flame-400" },
    { label: "어시스트왕", entry: players.playmaker, valueKey: "apg", unit: "APG", tone: "text-hoop-400" },
    { label: "리바운드왕", entry: players.rebounder, valueKey: "rpg", unit: "RPG", tone: "text-neon-400" },
  ];

  return (
    <div className={align === "right" ? "md:text-right" : ""}>
      <div
        className="mb-2 flex items-center gap-2"
        style={{ flexDirection: align === "right" ? "row-reverse" : "row" }}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[14px] font-semibold" style={{ color }}>
          {shortName}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div
            key={it.label}
            className={[
              "flex items-baseline gap-2 text-[14px]",
              align === "right" ? "md:justify-end" : "",
            ].join(" ")}
          >
            <span className="text-[12px] uppercase tracking-wider text-ink-500 w-16 shrink-0">
              {it.label}
            </span>
            {it.entry ? (
              <Link
                href={`/players/${it.entry.player.pcode}`}
                className="text-ink-100 hover:text-flame-400"
              >
                {it.entry.player.pname}
              </Link>
            ) : (
              <span className="text-ink-500">—</span>
            )}
            {it.entry && (
              <span className="stat-num">
                <span className={`font-semibold ${it.tone}`}>
                  {(it.entry.avg[it.valueKey] as number).toFixed(1)}
                </span>
                <span className="ml-0.5 text-[12px] text-ink-500">
                  {it.unit}
                </span>
                <span className="ml-1 text-[12px] text-ink-600">
                  ({it.entry.avg.games}G)
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamHeader({
  full,
  short,
  color,
  role,
  standing,
  align,
}: {
  full: string;
  short: string;
  color: string;
  role: string;
  /** 경기 시점 기준 정규시즌 standing */
  standing?: {
    rank: number | null;
    wins: number;
    losses: number;
    winPct: number;
  };
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-[12px] uppercase tracking-[0.15em] text-ink-500">
        {role}
      </div>
      <div className="mt-1 text-lg font-bold" style={{ color }}>
        {full}
      </div>
      <div className="mt-0.5 text-[14px] text-ink-400">{short}</div>
      {standing && (
        <div className="mt-2 stat-num text-[13px] text-ink-300">
          {standing.rank == null
            ? "개막 전"
            : `경기 시점 ${standing.rank}위`}
          {" · "}
          {standing.wins}-{standing.losses}
          {standing.wins + standing.losses > 0 && (
            <>
              {" · "}
              {standing.winPct.toFixed(3).replace(/^0/, "")}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CompareRow({
  label,
  l,
  r,
  fmt,
  invert = false,
  homeColor,
  awayColor,
}: {
  label: string;
  l: number;
  r: number;
  fmt: (v: number) => string;
  invert?: boolean;
  homeColor: string;
  awayColor: string;
}) {
  const lBetter = invert ? l < r : l > r;
  const rBetter = invert ? r < l : r > l;
  const max = Math.max(l, r) || 1;
  return (
    <div className="grid grid-cols-[60px_1fr_60px_1fr_60px] items-center gap-2 text-[13px]">
      <span
        className={[
          "stat-num text-right font-semibold",
          lBetter ? "" : "text-ink-400",
        ].join(" ")}
        style={{ color: lBetter ? homeColor : undefined }}
      >
        {fmt(l)}
      </span>
      <div className="relative h-2 overflow-hidden rounded bg-court-800">
        <div
          className="absolute right-0 top-0 h-full"
          style={{
            width: `${(l / max) * 100}%`,
            backgroundColor: lBetter ? homeColor : "#475569",
            opacity: lBetter ? 0.85 : 0.45,
          }}
        />
      </div>
      <span className="text-center text-ink-500">{label}</span>
      <div className="relative h-2 overflow-hidden rounded bg-court-800">
        <div
          className="absolute left-0 top-0 h-full"
          style={{
            width: `${(r / max) * 100}%`,
            backgroundColor: rBetter ? awayColor : "#475569",
            opacity: rBetter ? 0.85 : 0.45,
          }}
        />
      </div>
      <span
        className={[
          "stat-num font-semibold",
          rBetter ? "" : "text-ink-400",
        ].join(" ")}
        style={{ color: rBetter ? awayColor : undefined }}
      >
        {fmt(r)}
      </span>
    </div>
  );
}

function FormBlock({
  short,
  color,
  form,
}: {
  short: string;
  color: string;
  form: ("W" | "L")[];
}) {
  const wins = form.filter((f) => f === "W").length;
  const losses = form.length - wins;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[14px] font-medium" style={{ color }}>
        {short}
      </span>
      <div className="flex items-center gap-2">
        <span className="stat-num text-[13px] text-ink-400">
          {wins}-{losses}
        </span>
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
            <span className="text-[12px] text-ink-500">최근 폼 없음</span>
          )}
        </div>
      </div>
    </div>
  );
}
