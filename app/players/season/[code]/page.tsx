import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayersExplorer } from "@/components/PlayersExplorer";
import { getCurrentSeason } from "@/lib/kblSeason";
import {
  getPlayersSeasonData,
  listPlayersSeasons,
  type PlayersSeasonMeta,
} from "@/lib/playersSeasonData";

type Params = { params: { code: string } };

export function generateStaticParams() {
  const current = getCurrentSeason().code;
  const seasons = listPlayersSeasons(current);
  const codes = new Set(seasons.map((s) => s.code));
  codes.add(current);
  return [...codes].map((code) => ({ code }));
}

export function generateMetadata({ params }: Params) {
  const current = getCurrentSeason().code;
  const seasons = listPlayersSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  const label = meta?.label ?? params.code;
  return {
    title: `선수 스탯 — ${label} · KBL Hoops Lab`,
  };
}

export default function PlayersSeasonPage({ params }: Params) {
  const current = getCurrentSeason().code;
  const data = getPlayersSeasonData(params.code);
  const seasons = listPlayersSeasons(current);
  const activeMeta = seasons.find((s) => s.code === params.code);

  if (!activeMeta && params.code !== current) notFound();

  const isEmpty = data.allPlayers.length === 0;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-3 py-8 md:px-6">
        <section className="mb-4 md:mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip border-neon-500/30 bg-neon-500/10 text-neon-400">
              {activeMeta?.isCurrent ? "진행 중" : "시즌 종료"}
              {" · "}
              {activeMeta?.label ?? params.code}
            </span>
            {!isEmpty && (
              <span className="chip border-ink-500/30 bg-court-800/60 text-ink-300">
                {data.allPlayers.length}명
              </span>
            )}
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-ink-50 md:mt-3 md:text-3xl">
            선수 스탯
          </h1>
          <p className="mt-1 text-[13px] text-ink-300 md:mt-1.5 md:text-sm">
            라운드 필터를 다중 선택해 분포를 조작하고, 산점도와 표에서 세부 스탯을 정렬·검색.
          </p>

          <SeasonTabs seasons={seasons} activeCode={params.code} />
        </section>

        {isEmpty ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-ink-300">
              {activeMeta?.label ?? params.code} 시즌의 선수 상세 데이터가 아직 준비되지 않았습니다.
            </p>
          </div>
        ) : (
          <PlayersExplorer
            seasonPlayers={data.allPlayers}
            playoffPlayers={data.playersPlayoff}
            perRound={data.playersByRound}
            byKey={data.playersByKey}
          />
        )}

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API · 모든 스탯은 경기당 평균값
        </footer>
      </main>
    </div>
  );
}

function SeasonTabs({
  seasons,
  activeCode,
}: {
  seasons: PlayersSeasonMeta[];
  activeCode: string;
}) {
  if (seasons.length <= 1) return null;
  return (
    <nav className="mt-4 -mx-1 flex flex-wrap gap-1.5">
      {seasons.map((s) => (
        <Link
          key={s.code}
          href={`/players/season/${s.code}`}
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
