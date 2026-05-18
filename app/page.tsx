import { CreatorCard } from "@/components/CreatorCard";
import { FinalsMatchupCard } from "@/components/FinalsMatchupCard";
import { Headlines } from "@/components/Headlines";
import { HeroCards } from "@/components/HeroCards";
import { LeadersCard } from "@/components/LeadersCard";
import { RecentStandoutsHighlight } from "@/components/RecentStandoutsHighlight";
import { SemiHighlights } from "@/components/SemiHighlights";
import { StandingsTable } from "@/components/StandingsTable";
import {
  ASSIST_LEADERS,
  REBOUND_LEADERS,
  SCORING_LEADERS,
  STANDINGS,
} from "@/lib/data";
import { generateHeadlines } from "@/lib/autoHeadlines";
import { buildHeroCards } from "@/lib/heroCards";
import { getHeroCopy, getSeasonStatus } from "@/lib/seasonStatus";
import { recentPlayerStandouts } from "@/lib/standout";
import gamesJson from "../data/games.json";

export default function DashboardPage() {
  const status = getSeasonStatus();
  const hero = getHeroCopy(status);

  // 다이나믹 Hero 카드 4종 — "현재 리그의 맥박"
  // (Player of the Night / MVP Tracker / Team On Fire / Stat Leader)
  const heroCards = buildHeroCards();

  // 최근 경기 standout 하이라이트 (홈에 임팩트)
  const recentStandouts = recentPlayerStandouts(6, 6);

  // 자동 헤드라인 (시즌 단계 + 4강 결과 + 시즌 베스트 등)
  const headlines = generateHeadlines().map((h) => ({
    id: h.id,
    badge: h.badge,
    title: h.title,
    time: h.time,
    link: h.link,
    searchQuery: h.searchQuery,
  }));

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* 히어로 섹션 (동적) */}
        <section className="mb-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
                <span className="h-1.5 w-1.5 rounded-full bg-flame-500" />
                {hero.chipLabel}
              </span>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
                {hero.title}
              </h1>
              <p className="mt-1.5 text-sm text-ink-300">{hero.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 text-[14px] text-ink-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hoop-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-hoop-500" />
                </span>
                <span>최근 업데이트</span>
              </span>
              <span className="stat-num text-ink-300">
                {fmtFetchedAt((gamesJson as { fetchedAt?: string }).fetchedAt)}
              </span>
            </div>
          </div>
        </section>

        {/* 다이나믹 Hero 카드 4종 — "현재 리그의 맥박" */}
        <section className="mb-8">
          <HeroCards cards={heroCards} />
        </section>

        {/* 챔결 매치업 분석 (있을 때만) */}
        {(status.stage === "final-await" || status.stage === "final-running") && (
          <section className="mb-8">
            <FinalsMatchupCard
              finalSeries={status.finalSeries}
              daysToNext={status.daysToNext}
            />
          </section>
        )}

        {/* 최근 경기 What Stood Out — 자동 분석 시그니처 */}
        {recentStandouts.length > 0 && (
          <section className="mb-8">
            <RecentStandoutsHighlight items={recentStandouts} />
          </section>
        )}

        {/* 4강 하이라이트 + 정규리그 TOP 6 */}
        <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          <SemiHighlights semiSeries={status.semiSeries} />
          <StandingsTable rows={STANDINGS} take={6} />
        </section>

        {/* 스탯 리더 3종 */}
        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LeadersCard
            title="득점 리더"
            subtitle="정규시즌 PPG TOP 5"
            leaders={SCORING_LEADERS}
            accent="flame"
          />
          <LeadersCard
            title="어시스트 리더"
            subtitle="정규시즌 APG TOP 5"
            leaders={ASSIST_LEADERS}
            accent="neon"
          />
          <LeadersCard
            title="리바운드 리더"
            subtitle="정규시즌 RPG TOP 5"
            leaders={REBOUND_LEADERS}
            accent="hoop"
          />
        </section>

        {/* 뉴스 (자동 생성) + 제작자 카드 */}
        <section className="mb-12 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <Headlines items={headlines} />
          <CreatorCard />
        </section>

        <footer className="border-t border-court-700/60 pt-6 text-center text-[14px] text-ink-500">
          <p>
            데이터 출처: KBL 공식 API · 평일 21:30 / 주말 16:30 자동 갱신
          </p>
        </footer>
      </main>
    </div>
  );
}

function fmtFetchedAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  // KST 변환
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const mo = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const da = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${y}-${mo}-${da} ${hh}:${mm} KST`;
}
