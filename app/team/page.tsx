import { TeamAnalytics } from "@/components/TeamAnalytics";
import { HAS_FILTERED_STANDINGS, STANDINGS_FILTERS } from "@/lib/data";

export const metadata = {
  title: "팀 — KBL Hoops Lab",
};

export default function TeamPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* 헤더 */}
        <section className="mb-8">
          <span className="chip border-neon-500/30 bg-neon-500/10 text-neon-400">
            팀 심화 통계 · 정규리그 기준
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            팀 스탯 탐색
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            전체 / 홈 / 원정 / 1~6라운드 필터로 팀별 성적과 스탯 변화를 분석. 같은 팀이라도 상황에 따라 성적이 확연히 달라집니다.
          </p>
        </section>

        {HAS_FILTERED_STANDINGS ? (
          <TeamAnalytics filters={STANDINGS_FILTERS} />
        ) : (
          <section className="card p-5">
            <p className="text-[16px] text-ink-300">
              필터 데이터가 없어요. PowerShell에서{" "}
              <code className="rounded bg-court-700/60 px-1 py-0.5 font-mono text-[15px]">
                npm run fetch:kbl-api
              </code>
              를 먼저 실행해주세요.
            </p>
          </section>
        )}

        <footer className="mt-8 border-t border-court-700/60 pt-6 text-center text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API · 정규리그 기준
        </footer>
      </main>
    </div>
  );
}
