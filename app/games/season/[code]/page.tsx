import Link from "next/link";
import { notFound } from "next/navigation";
import { GamesExplorer } from "@/components/GamesExplorer";
import { getCurrentSeason } from "@/lib/kblSeason";
import {
  getGamesSeasonData,
  listGamesSeasons,
  type GamesSeasonMeta,
} from "@/lib/gamesSeasonData";
import type { RawGame } from "@/lib/gamesUtil";

type Params = { params: { code: string } };

export function generateStaticParams() {
  const current = getCurrentSeason().code;
  const seasons = listGamesSeasons(current);
  const codes = new Set(seasons.map((s) => s.code));
  codes.add(current);
  return [...codes].map((code) => ({ code }));
}

export function generateMetadata({ params }: Params) {
  const current = getCurrentSeason().code;
  const seasons = listGamesSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  const label = meta?.label ?? params.code;
  return { title: `일정 — ${label} · KBL Hoops Lab` };
}

export default function GamesSeasonPage({ params }: Params) {
  const current = getCurrentSeason().code;
  const data = getGamesSeasonData(params.code);
  const seasons = listGamesSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  if (!meta && params.code !== current) notFound();

  const seasonLbl = meta?.label ?? params.code;
  const isCurrent = params.code === current;
  const games = data.games;

  const totalGames = games.length;
  const finalCount = games.filter((g) => g.status === "final").length;
  const scheduledCount = games.filter((g) => g.status === "scheduled").length;

  // 과거 시즌 "오늘" 이란 개념이 없으니 은폐. 현재 시즌에서만 의미 있음.
  const TODAY_KEY = new Date().toISOString().slice(0, 10);
  const todayGames = isCurrent
    ? games.filter((g) => g.date === TODAY_KEY)
    : [];
  const upcoming = isCurrent
    ? games
        .filter((g) => g.date >= TODAY_KEY && g.status !== "final")
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    : [];
  const recent = games
    .filter((g) => g.status === "final")
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, 5);
  const nextGame = upcoming[0];

  const fetchedKst = data.fetchedAt
    ? new Date(data.fetchedAt).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-3 py-8 md:px-6">
        {/* 헤더 */}
        <section className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                isCurrent
                  ? "chip border-flame-500/30 bg-flame-500/10 text-flame-400"
                  : "chip border-ink-500/30 bg-court-800/60 text-ink-300"
              }
            >
              {isCurrent ? "진행 중" : "시즌 종료"} · {seasonLbl} 일정
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            일정
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            {isCurrent
              ? "날짜를 선택해서 그날 경기를 확인하세요. 카드를 클릭하면 양 팀 최근 폼과 상대전적이 나옵니다."
              : `${seasonLbl} 시즌 전체 일정. 카드를 클릭하면 양 팀 최근 폼과 상대전적이 나옵니다.`}
          </p>

          <SeasonTabs seasons={seasons} activeCode={params.code} />
        </section>

        {/* 요약 카드 */}
        {totalGames > 0 && (
          <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <SummaryCard
              label="시즌 전체"
              value={`${totalGames}경기`}
              sub={`종료 ${finalCount} · 예정 ${scheduledCount}`}
              tone="ink"
            />
            {isCurrent ? (
              <SummaryCard
                label="오늘"
                value={
                  todayGames.length > 0
                    ? `${todayGames.length}경기`
                    : "경기 없음"
                }
                sub={
                  todayGames.length > 0
                    ? todayGames
                        .map((g) => `${g.homeShort} vs ${g.awayShort}`)
                        .join(" · ")
                    : "휴식일"
                }
                tone={todayGames.length > 0 ? "flame" : "ink"}
              />
            ) : (
              <SummaryCard
                label="최종 종료"
                value={
                  recent[0]
                    ? `${recent[0].date}`
                    : "—"
                }
                sub={
                  recent[0]
                    ? `${recent[0].homeShort} ${recent[0].homeScore} - ${recent[0].awayScore} ${recent[0].awayShort}`
                    : "—"
                }
                tone="neon"
              />
            )}
            {isCurrent ? (
              <SummaryCard
                label="다음 경기"
                value={
                  nextGame
                    ? `${nextGame.homeShort} vs ${nextGame.awayShort}`
                    : "—"
                }
                sub={
                  nextGame
                    ? `${nextGame.date} ${nextGame.time} · ${nextGame.tag}`
                    : "예정된 경기 없음"
                }
                tone="hoop"
              />
            ) : (
              <SummaryCard
                label="정규 경기"
                value={`${games.filter((g) => g.tag === "정규리그").length}경기`}
                sub="정규리그만 집계"
                tone="hoop"
              />
            )}
            <SummaryCard
              label={isCurrent ? "최근 결과" : "플레이오프"}
              value={
                isCurrent
                  ? recent[0]
                    ? `${recent[0].homeShort} ${recent[0].homeScore} - ${recent[0].awayScore} ${recent[0].awayShort}`
                    : "—"
                  : `${games.filter((g) => g.tag !== "정규리그").length}경기`
              }
              sub={
                isCurrent
                  ? recent[0]
                    ? `${recent[0].date} · ${recent[0].tag}`
                    : "종료된 경기 없음"
                  : "6강/4강/챔프결 합산"
              }
              tone={isCurrent ? "neon" : "flame"}
            />
          </section>
        )}

        {totalGames > 0 ? (
          <GamesExplorer
            games={games}
            storageKeyPrefix={`gamesExplorer:season:${params.code}`}
            detailBase={isCurrent ? "/games" : `/games/season/${params.code}`}
          />
        ) : (
          <section className="card p-8 text-center">
            <p className="text-sm text-ink-300">
              {seasonLbl} 시즌 일정 데이터가 아직 준비되지 않았습니다.
            </p>
          </section>
        )}

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 일정 API · {seasonLbl}
          {fetchedKst && (
            <>
              {" · "}
              마지막 갱신: <span className="text-ink-300">{fetchedKst}</span>
            </>
          )}
        </footer>
      </main>
    </div>
  );
}

function SeasonTabs({
  seasons,
  activeCode,
}: {
  seasons: GamesSeasonMeta[];
  activeCode: string;
}) {
  if (seasons.length <= 1) return null;
  return (
    <nav className="mt-4 -mx-1 flex flex-wrap gap-1.5">
      {seasons.map((s) => (
        <Link
          key={s.code}
          href={`/games/season/${s.code}`}
          className={[
            "rounded-md px-2.5 py-1 text-[14px] font-medium transition-colors",
            s.code === activeCode
              ? "bg-flame-500/15 text-flame-400 ring-1 ring-flame-500/30"
              : "border border-court-700 text-ink-300 hover:bg-court-700/40 hover:text-ink-50",
          ].join(" ")}
        >
          {s.label}
          {s.isCurrent && <span className="ml-1 text-[11px] text-ink-500">· 진행 중</span>}
        </Link>
      ))}
    </nav>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "flame" | "neon" | "hoop" | "ink";
}) {
  const bar =
    tone === "flame"
      ? "bg-flame-500"
      : tone === "neon"
        ? "bg-neon-500"
        : tone === "hoop"
          ? "bg-hoop-500"
          : "bg-ink-500";
  return (
    <div className="relative overflow-hidden card p-4">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${bar}`} />
      <div className="text-[14px] font-medium uppercase tracking-[0.12em] text-ink-500">
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-ink-50">{value}</div>
      {sub && (
        <div className="mt-1 text-[15px] text-ink-300 truncate">{sub}</div>
      )}
    </div>
  );
}
