import { CompareClient } from "@/components/CompareClient";
import { ALL_PLAYERS, STANDINGS } from "@/lib/data";

export const metadata = {
  title: "비교 — KBL Hoops Lab",
};

export default function ComparePage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-6">
          <span className="chip border-neon-500/30 bg-neon-500/10 text-neon-400">
            Compare
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            팀·선수 비교
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            두 팀 또는 두 선수를 고르면 주요 지표를 카드와 레이더 차트로 나란히 비교합니다.
          </p>
        </section>

        <CompareClient standings={STANDINGS} players={ALL_PLAYERS} />

        <footer className="mt-8 border-t border-court-700/60 pt-6 text-center text-[11px] text-ink-500">
          데이터 출처: Daum 스포츠 (사용자 로컬 파싱)
        </footer>
      </main>
    </div>
  );
}
