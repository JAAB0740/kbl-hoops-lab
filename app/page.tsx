import { CreatorCard } from "@/components/CreatorCard";
import { FinalsMatchupCard } from "@/components/FinalsMatchupCard";
import { Headlines } from "@/components/Headlines";
import { LeadersCard } from "@/components/LeadersCard";
import { SemiHighlights } from "@/components/SemiHighlights";
import { StandingsTable } from "@/components/StandingsTable";
import { StatCard } from "@/components/StatCard";
import {
  ASSIST_LEADERS,
  PLAYERS_PLAYOFF,
  REBOUND_LEADERS,
  SCORING_LEADERS,
  STANDINGS,
} from "@/lib/data";
import { generateHeadlines } from "@/lib/autoHeadlines";
import { getHeroCopy, getSeasonStatus } from "@/lib/seasonStatus";
import gamesJson from "../data/games.json";

export default function DashboardPage() {
  const status = getSeasonStatus();
  const hero = getHeroCopy(status);
  const champion = STANDINGS[0];
  const topScorer = SCORING_LEADERS[0];

  // PO 한정 핫 플레이어 (PO 평균 PER 1위, 없으면 득점 1위)
  const poTopByPER = [...PLAYERS_PLAYOFF]
    .filter((p) => (p.games ?? 0) >= 1 && p.advanced?.per != null)
    .sort((a, b) => (b.advanced!.per ?? 0) - (a.advanced!.per ?? 0))[0];
  const poTopByPts = [...PLAYERS_PLAYOFF]
    .filter((p) => (p.games ?? 0) >= 1)
    .sort((a, b) => (b.stats.points ?? 0) - (a.stats.points ?? 0))[0];
  const poHot = poTopByPER ?? poTopByPts;

  // 4강 영웅 (4강 시리즈 종료 후, semi 이전 라운드 winner들의 포인트 1위)
  const semiWinners = status.semiSeries
    .map((s) => s.winnerShort)
    .filter(Boolean) as string[];
  const semiHero = [...PLAYERS_PLAYOFF]
    .filter((p) => semiWinners.includes(p.team))
    .sort((a, b) => (b.stats.points ?? 0) - (a.stats.points ?? 0))[0];

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
            <div className="flex items-center gap-2 text-[12px] text-ink-500">
              <span>마지막 갱신</span>
              <span className="stat-num text-ink-300">
                {fmtFetchedAt((gamesJson as { fetchedAt?: string }).fetchedAt)}
              </span>
            </div>
          </div>
        </section>

        {/* 4 카드 — 시점 맞춤 */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="정규리그 1위"
            title={champion.name}
            value={`${champion.wins}승 ${champion.losses}패`}
            caption={`승률 ${champion.winPct.toFixed(3).replace(/^0/, "")}`}
            accent="bg-flame-500"
            trend="up"
          />
          {status.stage === "final-await" && status.nextGame ? (
            <StatCard
              label="챔피언결정전 D-DAY"
              title={`G1 · ${fmtDate(status.nextGame.date)}`}
              value={
                status.daysToNext != null && status.daysToNext > 0
                  ? `D-${status.daysToNext}`
                  : status.daysToNext === 0
                    ? "오늘"
                    : "곧"
              }
              caption={`${status.nextGame.time ?? ""} · ${status.nextGame.homeShort} vs ${status.nextGame.awayShort}`}
              accent="bg-buzzer-500"
              trend="flat"
            />
          ) : (
            <StatCard
              label="경기당 득점 1위"
              title={topScorer.name}
              value={`${topScorer.value.toFixed(1)} PPG`}
              caption={`소속 · ${topScorer.team}`}
              accent="bg-neon-500"
              trend="up"
            />
          )}
          {poHot ? (
            <StatCard
              label="플레이오프 핫 플레이어"
              title={poHot.name}
              value={
                poHot.advanced?.per != null
                  ? `PER ${poHot.advanced.per.toFixed(1)}`
                  : `${poHot.stats.points.toFixed(1)} PPG`
              }
              caption={`${poHot.team} · PO ${poHot.games}G · ${poHot.stats.points.toFixed(1)}득 ${poHot.stats.rebounds.toFixed(1)}리바`}
              accent="bg-hoop-500"
              trend="up"
            />
          ) : (
            <StatCard
              label="가장 뜨거운 팀"
              title="—"
              value="—"
              caption=""
              accent="bg-hoop-500"
              trend="flat"
            />
          )}
          {semiHero ? (
            <StatCard
              label="4강 PO 영웅"
              title={semiHero.name}
              value={`${semiHero.stats.points.toFixed(1)} PPG`}
              caption={`${semiHero.team} · ${semiHero.stats.rebounds.toFixed(1)}리바 ${semiHero.stats.assists.toFixed(1)}어시`}
              accent="bg-flame-400"
              trend="up"
            />
          ) : (
            <StatCard
              label="시즌 단계"
              title={status.label}
              value={status.shortChip}
              caption=""
              accent="bg-flame-400"
              trend="flat"
            />
          )}
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

        <footer className="border-t border-court-700/60 pt-6 text-center text-[12px] text-ink-500">
          <p>
            데이터 출처: KBL 공식 API · 평일 21:30 / 주말 16:30 자동 갱신
          </p>
        </footer>
      </main>
    </div>
  );
}

function fmtDate(date: string | null | undefined): string {
  if (!date) return "—";
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${parseInt(m[1], 10)}월 ${parseInt(m[2], 10)}일`;
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
