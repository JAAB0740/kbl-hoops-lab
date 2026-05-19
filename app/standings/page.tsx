import { FilterableStandings } from "@/components/FilterableStandings";
import {
  HAS_FILTERED_STANDINGS,
  STANDINGS_FILTERS,
  type FilteredTeam,
} from "@/lib/data";
import { teamLogoSrc } from "@/lib/teamLogos";

export const metadata = {
  title: "순위 — KBL Hoops Lab",
};

export default function StandingsPage() {
  const teams = STANDINGS_FILTERS.all;
  const champion = teams[0];
  const runnerUp = teams[1];
  const sixthPlace = teams[5];
  const bottom = teams[teams.length - 1];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* 헤더 */}
        <section className="mb-8">
          <span className="chip border-neon-500/30 bg-neon-500/10 text-neon-400">
            2025-26 정규리그 · 54경기 기준
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            전체 팀 순위
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            상위 6팀이 플레이오프 진출. 1·2위는 4강 직행, 3~6위는 6강 PO. 팀별 심화 스탯은 &quot;팀&quot; 탭에서.
          </p>
        </section>

        {/* 요약 카드 4개 — 모바일 가로 스와이프 캐러셀, md+ 4열 grid */}
        {HAS_FILTERED_STANDINGS && (
          <section
            className={[
              // 모바일 — peeking carousel (85vw + snap-x + gap 12px)
              "-mx-6 mb-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2",
              "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
              // md+ — 4열 grid
              "md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 md:pb-0",
            ].join(" ")}
          >
            <SummaryCard
              label="정규리그 우승"
              team={champion}
              logoSrc={teamLogoSrc(champion?.shortName)}
              barColor="bg-flame-500"
            />
            <SummaryCard
              label="4강 직행"
              team={runnerUp}
              logoSrc={teamLogoSrc(runnerUp?.shortName)}
              barColor="bg-flame-400"
            />
            <SummaryCard
              label="PO 라인 (6위)"
              team={sixthPlace}
              logoSrc={teamLogoSrc(sixthPlace?.shortName)}
              barColor="bg-hoop-500"
            />
            <SummaryCard
              label="최하위"
              team={bottom}
              logoSrc={teamLogoSrc(bottom?.shortName)}
              barColor="bg-buzzer-500"
              highlight="danger"
            />
          </section>
        )}

        {/* 필터 가능한 순위 테이블 */}
        {HAS_FILTERED_STANDINGS ? (
          <FilterableStandings filters={STANDINGS_FILTERS} />
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

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API · 2025-26 정규리그 54경기 기준
        </footer>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  team,
  logoSrc,
  barColor,
  highlight,
}: {
  label: string;
  team?: FilteredTeam;
  logoSrc?: string | null;
  barColor: string;
  highlight?: "danger";
}) {
  if (!team) return null;
  return (
    <div
      className={[
        // 모바일 캐러셀 item — basis 85vw + snap-start. md+ 자동 (grid)
        "shrink-0 basis-[85vw] snap-start",
        "md:basis-auto md:shrink",
        "relative overflow-hidden card p-4",
      ].join(" ")}
    >
      <span className={`absolute left-0 top-0 h-full w-[3px] ${barColor}`} />

      {/* 팀 로고 워터마크 — 우측 하단, 텍스트 가독성 안전한 수준 */}
      {logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-2 h-20 w-auto opacity-[0.10] [filter:grayscale(100%)_brightness(1.6)]"
          loading="lazy"
        />
      )}

      <div className="relative text-[14px] font-medium uppercase tracking-[0.12em] text-ink-500">
        {label}
      </div>
      <div className="relative mt-2 text-base font-semibold text-ink-50">{team.name}</div>
      <div
        className={[
          "relative mt-1 stat-num text-[15px]",
          highlight === "danger" ? "text-buzzer-500" : "text-ink-300",
        ].join(" ")}
      >
        {team.wins}승 {team.losses}패 · 승률 {team.winPct.toFixed(3).replace(/^0/, "")}
      </div>
    </div>
  );
}
