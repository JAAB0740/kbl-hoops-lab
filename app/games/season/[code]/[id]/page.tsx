import Link from "next/link";
import { notFound } from "next/navigation";
import { TEAM_COLORS } from "@/lib/data";
import { teamLogoSrc } from "@/lib/teamLogos";
import {
  findGameById,
  fmtDate,
  gameToId,
  headToHead,
  teamRecentForm,
} from "@/lib/gamesUtil";
import { BoxScoreTable } from "@/components/BoxScoreTable";
import { QuarterScoreBox } from "@/components/QuarterScoreBox";
import { fmtKblTime } from "@/lib/matchDetails";
import { getBoxScoreForSeason, getSeasonGames } from "@/lib/boxscoresSeasonal";
import { getMatchDetailForSeason } from "@/lib/matchDetailsSeasonal";
import { getCurrentSeason } from "@/lib/kblSeason";
import { listGamesSeasons } from "@/lib/gamesSeasonData";

/** "서울 SK 나이츠" → "서울 SK" (3단어 이상일 때만 별명 제거) */
function stripNickname(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 2) return full;
  return parts.slice(0, -1).join(" ");
}

interface Props {
  params: { code: string; id: string };
}

export const dynamicParams = true;

export function generateMetadata({ params }: Props) {
  const seasons = listGamesSeasons(getCurrentSeason().code);
  const meta = seasons.find((s) => s.code === params.code);
  const label = meta?.label ?? params.code;
  return { title: `경기 상세 — ${label} · KBL Hoops Lab` };
}

export default function GameSeasonDetailPage({ params }: Props) {
  const seasonGames = getSeasonGames(params.code);
  const game = findGameById(params.id, seasonGames);
  if (!game) notFound();

  const currentCode = getCurrentSeason().code;
  const seasons = listGamesSeasons(currentCode);
  const seasonMeta = seasons.find((s) => s.code === params.code);
  const seasonLbl = seasonMeta?.label ?? params.code;
  const isCurrent = params.code === currentCode;
  const playerLinkBase = `/players/season/${params.code}`;

  const homeColor = TEAM_COLORS[game.homeShort] ?? "#94a3b8";
  const awayColor = TEAM_COLORS[game.awayShort] ?? "#94a3b8";

  // 이 경기 시점 이전 폼 / H2H — 지정 시즌 안에서만
  const homeForm = teamRecentForm(game.homeShort, 5, game.date, game.time, seasonGames);
  const awayForm = teamRecentForm(game.awayShort, 5, game.date, game.time, seasonGames);
  const h2h = headToHead(
    game.homeShort,
    game.awayShort,
    game.date,
    game.time,
    seasonGames,
  );

  const isFinal = game.status === "final";

  // 시리즈 (PO일 때)
  const seriesGames = game.tag !== "정규리그"
    ? seasonGames
        .filter(
          (g) =>
            g.tag === game.tag &&
            ((g.homeShort === game.homeShort && g.awayShort === game.awayShort) ||
              (g.homeShort === game.awayShort && g.awayShort === game.homeShort)),
        )
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    : [];

  let seriesHomeWins = 0;
  let seriesAwayWins = 0;
  for (const g of seriesGames) {
    if (g.status !== "final" || g.homeScore == null || g.awayScore == null) continue;
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

  const matchDetail = getMatchDetailForSeason(params.code, game.gmkey);
  const boxScore = getBoxScoreForSeason(params.code, game.gmkey);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-3 py-8 md:px-6">
        {/* 뒤로가기 */}
        <Link
          href={`/games/season/${params.code}`}
          className="mb-4 inline-flex items-center gap-1 text-[15px] text-ink-400 hover:text-ink-100"
        >
          ← {seasonLbl} 경기 목록
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
              <span
                className={
                  isCurrent
                    ? "chip border-neon-500/30 bg-neon-500/10 text-neon-400"
                    : "chip border-ink-500/30 bg-court-800/60 text-ink-300"
                }
              >
                {seasonLbl}
              </span>
              {seriesGames.length > 1 && (
                <span className="chip border-court-700 bg-court-800/70 text-ink-300">
                  G{myIndex + 1} / {seriesGames.length}
                </span>
              )}
              <span className="text-[15px] text-ink-400">
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
                  : "border-flame-500/30 bg-flame-500/10 text-flame-400",
              ].join(" ")}
            >
              {isFinal ? "종료" : "예정"}
            </span>
          </div>

          <div className="mt-6 flex items-center justify-between gap-2 md:gap-6">
            <TeamHeader
              short={game.homeShort}
              full={stripNickname(game.homeTeam)}
              color={homeColor}
              role="홈"
              logoSrc={teamLogoSrc(game.homeShort)}
            />
            <div className="flex shrink-0 flex-col items-center">
              {isFinal ? (
                <div className="font-extrabold leading-none">
                  <span
                    className="stat-num text-[40px] md:text-[48px]"
                    style={{
                      color:
                        (game.homeScore ?? 0) > (game.awayScore ?? 0)
                          ? homeColor
                          : "#3f4754",
                    }}
                  >
                    {game.homeScore}
                  </span>
                  <span className="stat-num mx-[12px] text-[40px] text-ink-500 md:text-[48px]">
                    -
                  </span>
                  <span
                    className="stat-num text-[40px] md:text-[48px]"
                    style={{
                      color:
                        (game.awayScore ?? 0) > (game.homeScore ?? 0)
                          ? awayColor
                          : "#3f4754",
                    }}
                  >
                    {game.awayScore}
                  </span>
                </div>
              ) : (
                <div className="stat-num text-2xl text-ink-300">VS</div>
              )}
              {isFinal &&
                game.homeScore != null &&
                game.awayScore != null &&
                seriesGames.length <= 1 &&
                (() => {
                  const diff = (game.homeScore ?? 0) - (game.awayScore ?? 0);
                  if (diff === 0) return null;
                  const winnerColor = diff > 0 ? homeColor : awayColor;
                  const winnerShort = diff > 0 ? game.homeShort : game.awayShort;
                  const absDiff = Math.abs(diff);
                  const tag = absDiff <= 3 ? "박빙" : absDiff >= 20 ? "대승" : "";
                  return (
                    <div className="mt-2 whitespace-nowrap text-[12px] md:text-[13px]">
                      <span className="font-semibold" style={{ color: winnerColor }}>
                        {winnerShort}
                      </span>
                      <span className="ml-1 stat-num font-semibold" style={{ color: winnerColor }}>
                        +{absDiff}
                      </span>
                      {tag && <span className="ml-1 text-ink-500">{tag}</span>}
                    </div>
                  );
                })()}
              {seriesGames.length > 1 && (
                <div className="mt-3 whitespace-nowrap text-[13px] text-ink-400 md:text-[15px]">
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
              short={game.awayShort}
              full={stripNickname(game.awayTeam)}
              color={awayColor}
              role="원정"
              logoSrc={teamLogoSrc(game.awayShort)}
            />
          </div>
        </header>

        {/* 쿼터별 스코어 */}
        {isFinal && matchDetail && (
          <section className="card mb-6 p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink-50">쿼터별 스코어</h3>
              <div className="flex items-center gap-3 text-[14px] text-ink-500">
                {(() => {
                  const parts: string[] = [];
                  if (matchDetail.gameStart) parts.push(`시작 ${fmtKblTime(matchDetail.gameStart)}`);
                  if (matchDetail.gameEnd)   parts.push(`종료 ${fmtKblTime(matchDetail.gameEnd)}`);
                  if (matchDetail.crowds != null) parts.push(`관중 ${matchDetail.crowds.toLocaleString()}명`);
                  return parts.length > 0 ? <span>{parts.join(" · ")}</span> : null;
                })()}
              </div>
            </div>
            <QuarterScoreBox
              gmkey={game.gmkey}
              homeShort={game.homeShort}
              awayShort={game.awayShort}
              homeFull={stripNickname(game.homeTeam)}
              awayFull={stripNickname(game.awayTeam)}
              size="md"
              matchDetail={matchDetail}
            />
          </section>
        )}

        {/* 시리즈 경기 리스트 (PO) */}
        {seriesGames.length > 1 && (
          <section className="card mb-6 p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-50">
              시리즈 ({seriesGames.length}경기)
            </h3>
            <div className="space-y-1.5">
              {seriesGames.map((g, i) => {
                const isCurrentGame =
                  g.date === game.date && g.time === game.time && g.homeShort === game.homeShort;
                return (
                  <Link
                    key={`${g.date}-${g.time}-${i}`}
                    href={`/games/season/${params.code}/${gameToId(g)}`}
                    className={[
                      "flex items-center justify-between rounded px-3 py-2 text-[14px] transition",
                      isCurrentGame
                        ? "bg-court-800/60 ring-1 ring-flame-500/30"
                        : "hover:bg-court-700/40",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="stat-num text-ink-500">G{i + 1}</span>
                      <span className="text-ink-300">{fmtDate(g.date)}</span>
                    </div>
                    <div className="stat-num text-ink-300">
                      {g.status === "final"
                        ? `${g.homeScore} - ${g.awayScore}`
                        : g.time}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* 박스스코어 */}
        {boxScore && (
          <section className="card mb-6 p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-50">박스스코어</h3>
            <BoxScoreTable
              box={boxScore}
              homeShort={game.homeShort}
              awayShort={game.awayShort}
              homeFull={stripNickname(game.homeTeam)}
              awayFull={stripNickname(game.awayTeam)}
              playerLinkBase={playerLinkBase}
            />
          </section>
        )}

        {/* 상대 전적 + 최근 폼 */}
        {(h2h.games.length > 0 || homeForm.length > 0 || awayForm.length > 0) && (
          <section className="card mb-6 p-5">
            <h3 className="mb-3 text-sm font-semibold text-ink-50">
              경기 시점 이전 컨텍스트
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-[12px] uppercase tracking-wider text-ink-500">
                  최근 5경기 폼
                </div>
                <div className="mt-2 flex items-center gap-3 text-[14px]">
                  <span className="font-medium text-ink-100">{game.homeShort}</span>
                  <FormDots form={homeForm} />
                  <span className="mx-2 text-ink-600">·</span>
                  <span className="font-medium text-ink-100">{game.awayShort}</span>
                  <FormDots form={awayForm} />
                </div>
              </div>
              <div>
                <div className="text-[12px] uppercase tracking-wider text-ink-500">
                  시즌 H2H ({seasonLbl})
                </div>
                <div className="mt-2 stat-num text-[15px] text-ink-300">
                  <span style={{ color: homeColor }}>{game.homeShort}</span>{" "}
                  <span className="font-semibold">{h2h.aWins}</span> -{" "}
                  <span className="font-semibold">{h2h.bWins}</span>{" "}
                  <span style={{ color: awayColor }}>{game.awayShort}</span>
                  <span className="ml-2 text-[13px] text-ink-500">
                    · {h2h.games.length}경기
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API · {seasonLbl}
        </footer>
      </main>
    </div>
  );
}

function TeamHeader({
  short,
  full,
  color,
  role,
  logoSrc,
}: {
  short: string;
  full: string;
  color: string;
  role: "홈" | "원정";
  logoSrc: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      {logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="h-14 w-auto md:h-16" loading="lazy" />
      )}
      <div
        className="truncate text-[14px] font-semibold md:text-[16px]"
        style={{ color }}
      >
        {short}
      </div>
      <div className="truncate text-[12px] text-ink-500 md:text-[13px]">{full}</div>
      <div className="text-[11px] uppercase tracking-wider text-ink-500">{role}</div>
    </div>
  );
}

function FormDots({ form }: { form: ("W" | "L")[] }) {
  if (form.length === 0) {
    return <span className="text-[13px] text-ink-500">기록 없음</span>;
  }
  return (
    <span className="inline-flex gap-0.5">
      {form.map((r, i) => (
        <span
          key={i}
          className={[
            "inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold",
            r === "W"
              ? "bg-hoop-500/30 text-hoop-300"
              : "bg-buzzer-500/30 text-buzzer-300",
          ].join(" ")}
        >
          {r}
        </span>
      ))}
    </span>
  );
}
