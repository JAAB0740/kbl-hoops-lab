import Link from "next/link";
import { notFound } from "next/navigation";
import { FilterableStandings } from "@/components/FilterableStandings";
import { teamLogoSrc } from "@/lib/teamLogos";
import { getCurrentSeason } from "@/lib/kblSeason";
import {
  getStandingsSeasonData,
  listStandingsSeasons,
  type StandingsSeasonMeta,
} from "@/lib/standingsSeasonData";
import type { FilteredTeam } from "@/lib/data";

type Params = { params: { code: string } };

export function generateStaticParams() {
  const current = getCurrentSeason().code;
  const seasons = listStandingsSeasons(current);
  const codes = new Set(seasons.map((s) => s.code));
  codes.add(current);
  return [...codes].map((code) => ({ code }));
}

export function generateMetadata({ params }: Params) {
  const current = getCurrentSeason().code;
  const seasons = listStandingsSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  const label = meta?.label ?? params.code;
  return { title: `순위 — ${label} · KBL Hoops Lab` };
}

export default function StandingsSeasonPage({ params }: Params) {
  const current = getCurrentSeason().code;
  const data = getStandingsSeasonData(params.code);
  const seasons = listStandingsSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  if (!meta && params.code !== current) notFound();

  const seasonLbl = meta?.label ?? params.code;
  const isCurrent = params.code === current;
  const teams = data.filters.all;
  const champion = teams[0];
  const runnerUp = teams[1];
  const sixthPlace = teams[5];
  const bottom = teams[teams.length - 1];

  const gamesPlayedLabel = champion
    ? `${champion.wins + champion.losses}경기 기준`
    : data.hasData
      ? "경기 없음"
      : "데이터 없음";
  const regularComplete = champion
    ? champion.wins + champion.losses >= 50
    : false;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-3 py-8 md:px-6">
        {/* 헤더 */}
        <section className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                isCurrent
                  ? "chip border-neon-500/30 bg-neon-500/10 text-neon-400"
                  : "chip border-ink-500/30 bg-court-800/60 text-ink-300"
              }
            >
              {isCurrent ? "진행 중" : "시즌 종료"} · {seasonLbl} 정규리그 · {gamesPlayedLabel}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            전체 팀 순위
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            상위 6팀이 플레이오프 진출. 1·2위는 4강 직행, 3~6위는 6강 PO. 팀별 심화 스탯은 &quot;팀&quot; 탭에서.
          </p>

          <SeasonTabs seasons={seasons} activeCode={params.code} />
        </section>

        {/* 요약 카드 4개 */}
        {data.hasData && (
          <section
            className={[
              "-mx-6 mb-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2",
              "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
              "md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 md:pb-0",
            ].join(" ")}
          >
            <SummaryCard
              label={regularComplete ? "정규리그 우승" : "1위 (선두)"}
              team={champion}
              logoSrc={teamLogoSrc(champion?.shortName)}
              barColor="bg-flame-500"
            />
            <SummaryCard
              label={regularComplete ? "4강 직행" : "2위"}
              team={runnerUp}
              logoSrc={teamLogoSrc(runnerUp?.shortName)}
              barColor="bg-flame-400"
            />
            <SummaryCard
              label={regularComplete ? "PO 라인 (6위)" : "6위"}
              team={sixthPlace}
              logoSrc={teamLogoSrc(sixthPlace?.shortName)}
              barColor="bg-hoop-500"
            />
            <SummaryCard
              label={regularComplete ? "최하위" : `${teams.length}위`}
              team={bottom}
              logoSrc={teamLogoSrc(bottom?.shortName)}
              barColor="bg-buzzer-500"
              highlight={regularComplete ? "danger" : undefined}
            />
          </section>
        )}

        {data.hasData ? (
          <FilterableStandings filters={data.filters} />
        ) : (
          <section className="card p-8 text-center">
            <p className="text-sm text-ink-300">
              {seasonLbl} 시즌 팀 데이터가 아직 준비되지 않았습니다.
            </p>
          </section>
        )}

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API · {seasonLbl} 정규리그 · {gamesPlayedLabel}
        </footer>
      </main>
    </div>
  );
}

function SeasonTabs({
  seasons,
  activeCode,
}: {
  seasons: StandingsSeasonMeta[];
  activeCode: string;
}) {
  if (seasons.length <= 1) return null;
  return (
    <nav className="mt-4 -mx-1 flex flex-wrap gap-1.5">
      {seasons.map((s) => (
        <Link
          key={s.code}
          href={`/standings/season/${s.code}`}
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
        "shrink-0 basis-[85vw] snap-start",
        "md:basis-auto md:shrink",
        "relative overflow-hidden card p-4",
      ].join(" ")}
    >
      <span className={`absolute left-0 top-0 h-full w-[3px] ${barColor}`} />

      {logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-2 -bottom-2 h-20 w-auto opacity-[0.08]"
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
