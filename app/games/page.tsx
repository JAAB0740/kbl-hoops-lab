import { GamesExplorer } from "@/components/GamesExplorer";
import {
  ALL_GAMES,
  GAMES_FETCHED_AT,
  gamesRecent,
  gamesToday,
  gamesUpcoming,
} from "@/lib/gamesUtil";

export const metadata = {
  title: "일정 — KBL Hoops Lab",
};

export default function GamesPage() {
  const todayGames = gamesToday();
  const upcoming = gamesUpcoming(7);
  const recent = gamesRecent(5);

  // 통계
  const totalGames = ALL_GAMES.length;
  const finalCount = ALL_GAMES.filter((g) => g.status === "final").length;
  const scheduledCount = ALL_GAMES.filter((g) => g.status === "scheduled").length;

  // 다음 경기 한 개
  const nextGame = upcoming[0];

  // fetched 시각 (KST)
  const fetchedKst = GAMES_FETCHED_AT
    ? new Date(GAMES_FETCHED_AT).toLocaleString("ko-KR", {
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
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* 헤더 */}
        <section className="mb-8">
          <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
            일정 · 결과 · 매치업
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            일정
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            날짜를 선택해서 그날 경기를 확인하세요. 카드를 클릭하면 양 팀 최근
            폼과 상대전적이, 우측 화살표를 누르면 경기 상세로 이동합니다.
          </p>
        </section>

        {/* 요약 카드 */}
        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <SummaryCard
            label="시즌 전체"
            value={`${totalGames}경기`}
            sub={`종료 ${finalCount} · 예정 ${scheduledCount}`}
            tone="ink"
          />
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
          <SummaryCard
            label="최근 결과"
            value={
              recent[0]
                ? `${recent[0].homeShort} ${recent[0].homeScore} - ${recent[0].awayScore} ${recent[0].awayShort}`
                : "—"
            }
            sub={
              recent[0]
                ? `${recent[0].date} · ${recent[0].tag}`
                : "종료된 경기 없음"
            }
            tone="neon"
          />
        </section>

        {/* 메인 — 날짜 strip + 필터 + 리스트 */}
        <GamesExplorer />

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 일정 API
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
