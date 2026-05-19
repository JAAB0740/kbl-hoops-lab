import { PlayersExplorer } from "@/components/PlayersExplorer";
import {
  ALL_PLAYERS,
  PLAYERS_BY_KEY,
  PLAYERS_BY_ROUND,
  PLAYERS_PLAYOFF,
} from "@/lib/data";

export const metadata = {
  title: "선수 — KBL Hoops Lab",
};

export default function PlayersPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-4 md:mb-6">
          <span className="chip border-neon-500/30 bg-neon-500/10 text-neon-400">
            193명 전체 · 경기당 평균
          </span>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-50 md:mt-3 md:text-3xl">
            선수 스탯
          </h1>
          <p className="mt-1 text-[13px] text-ink-300 md:mt-1.5 md:text-sm">
            라운드 필터를 다중 선택해 분포를 조작하고, 산점도와 표에서 세부 스탯을 정렬·검색.
          </p>
        </section>

        <PlayersExplorer
          seasonPlayers={ALL_PLAYERS}
          playoffPlayers={PLAYERS_PLAYOFF}
          perRound={PLAYERS_BY_ROUND}
          byKey={PLAYERS_BY_KEY}
        />

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API · 모든 스탯은 경기당 평균값
        </footer>
      </main>
    </div>
  );
}
