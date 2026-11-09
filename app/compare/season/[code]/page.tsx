import Link from "next/link";
import { notFound } from "next/navigation";
import { CompareClient } from "@/components/CompareClient";
import { getCurrentSeason } from "@/lib/kblSeason";
import {
  getCompareSeasonData,
  listCompareSeasons,
  type CompareSeasonMeta,
} from "@/lib/compareSeasonData";

type Params = { params: { code: string } };

export function generateStaticParams() {
  const current = getCurrentSeason().code;
  const seasons = listCompareSeasons(current);
  const codes = new Set(seasons.map((s) => s.code));
  codes.add(current);
  return [...codes].map((code) => ({ code }));
}

export function generateMetadata({ params }: Params) {
  const current = getCurrentSeason().code;
  const seasons = listCompareSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  const label = meta?.label ?? params.code;
  return { title: `비교 — ${label} · KBL Hoops Lab` };
}

export default function CompareSeasonPage({ params }: Params) {
  const current = getCurrentSeason().code;
  const data = getCompareSeasonData(params.code);
  const seasons = listCompareSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  if (!meta && params.code !== current) notFound();

  const seasonLbl = meta?.label ?? params.code;
  const isCurrent = params.code === current;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-3 py-8 md:px-6">
        <section className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                isCurrent
                  ? "chip border-neon-500/30 bg-neon-500/10 text-neon-400"
                  : "chip border-ink-500/30 bg-court-800/60 text-ink-300"
              }
            >
              {isCurrent ? "진행 중" : "시즌 종료"} · {seasonLbl} 비교
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            팀·선수 비교
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            두 팀 또는 두 선수를 고르면 주요 지표를 카드와 레이더 차트로 나란히 비교합니다.
          </p>

          <SeasonTabs seasons={seasons} activeCode={params.code} />
        </section>

        {data.hasData ? (
          <CompareClient
            standings={data.standings}
            players={data.players}
            teamStatsOverride={data.teamStats}
            hasRealTeamStatsOverride={data.hasRealTeamStats}
            seasonLabelText={seasonLbl}
          />
        ) : (
          <section className="card p-8 text-center">
            <p className="text-sm text-ink-300">
              {seasonLbl} 시즌 비교 데이터가 아직 준비되지 않았습니다.
            </p>
          </section>
        )}

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API · {seasonLbl}
        </footer>
      </main>
    </div>
  );
}

function SeasonTabs({
  seasons,
  activeCode,
}: {
  seasons: CompareSeasonMeta[];
  activeCode: string;
}) {
  if (seasons.length <= 1) return null;
  return (
    <nav className="mt-4 -mx-1 flex flex-wrap gap-1.5">
      {seasons.map((s) => (
        <Link
          key={s.code}
          href={`/compare/season/${s.code}`}
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
