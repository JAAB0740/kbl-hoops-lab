import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayoffBracketView } from "@/components/PlayoffBracket";
import { getCurrentSeason } from "@/lib/kblSeason";
import {
  getPlayoffsSeasonData,
  listPlayoffsSeasons,
  type PlayoffsSeasonMeta,
} from "@/lib/playoffsSeasonData";

type Params = { params: { code: string } };

export function generateStaticParams() {
  const current = getCurrentSeason().code;
  const seasons = listPlayoffsSeasons(current);
  const codes = new Set(seasons.map((s) => s.code));
  codes.add(current);
  return [...codes].map((code) => ({ code }));
}

export function generateMetadata({ params }: Params) {
  const current = getCurrentSeason().code;
  const seasons = listPlayoffsSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  const label = meta?.label ?? params.code;
  return { title: `플레이오프 — ${label} · KBL Hoops Lab` };
}

export default function PlayoffsSeasonPage({ params }: Params) {
  const current = getCurrentSeason().code;
  const data = getPlayoffsSeasonData(params.code);
  const seasons = listPlayoffsSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  if (!meta && params.code !== current) notFound();

  const seasonLbl = meta?.label ?? params.code;
  const isCurrent = params.code === current;
  const bracket = data.bracket;

  const totalGames =
    bracket.firstRound.reduce((n, s) => n + s.games.length, 0) +
    bracket.semiRound.reduce((n, s) => n + s.games.length, 0) +
    (bracket.final?.games.length ?? 0);

  const completedGames = [
    ...bracket.firstRound.flatMap((s) => s.games),
    ...bracket.semiRound.flatMap((s) => s.games),
    ...(bracket.final?.games ?? []),
  ].filter((g) => g.status === "final").length;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-3 py-8 md:px-6">
        {/* 헤더 */}
        <section className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                isCurrent
                  ? "chip border-flame-500/30 bg-flame-500/10 text-flame-400"
                  : "chip border-ink-500/30 bg-court-800/60 text-ink-300"
              }
            >
              <span className={isCurrent ? "h-1.5 w-1.5 rounded-full bg-flame-500" : "h-1.5 w-1.5 rounded-full bg-ink-500"} />
              POST-SEASON · {seasonLbl}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            봄 농구 브래킷
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            상위 6팀이 챔피언결정전을 향해 격돌. 시리즈 박스를 클릭하면 경기별 스코어를 확인할 수 있어요.
          </p>

          <SeasonTabs seasons={seasons} activeCode={params.code} />
        </section>

        {data.hasPlayoffGames ? (
          <>
            {/* 요약 카드 */}
            <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryStat
                label="6강 PO"
                value={`${seriesDoneCount(bracket.firstRound)} / ${bracket.firstRound.length}`}
                caption="시리즈 종결"
                tone="hoop"
              />
              <SummaryStat
                label="4강 PO"
                value={`${seriesDoneCount(bracket.semiRound)} / ${bracket.semiRound.length}`}
                caption="시리즈 종결"
                tone="neon"
              />
              <SummaryStat
                label="진행 경기"
                value={`${completedGames} / ${totalGames}`}
                caption="공식 종료"
                tone="ink"
              />
              <SummaryStat
                label="챔피언"
                value={bracket.champion ?? "—"}
                caption={bracket.champion ? "확정" : "결정 전"}
                tone="flame"
              />
            </section>

            <section className="mb-8">
              <PlayoffBracketView
                bracket={bracket}
                gameLinkBase={isCurrent ? "/games" : `/games/season/${params.code}`}
              />
            </section>
          </>
        ) : (
          <section className="card p-8 text-center">
            <p className="text-sm text-ink-300">
              {isCurrent
                ? "아직 플레이오프 경기가 열리지 않았습니다. 정규리그 종료 후 다시 확인해주세요."
                : `${seasonLbl} 시즌 플레이오프 데이터가 아직 준비되지 않았습니다.`}
            </p>
          </section>
        )}

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 일정 · {seasonLbl}
        </footer>
      </main>
    </div>
  );
}

function SeasonTabs({
  seasons,
  activeCode,
}: {
  seasons: PlayoffsSeasonMeta[];
  activeCode: string;
}) {
  if (seasons.length <= 1) return null;
  return (
    <nav className="mt-4 -mx-1 flex flex-wrap gap-1.5">
      {seasons.map((s) => (
        <Link
          key={s.code}
          href={`/playoffs/season/${s.code}`}
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

function seriesDoneCount(
  series: { status: "upcoming" | "in-progress" | "final" }[],
): number {
  return series.filter((s) => s.status === "final").length;
}

function SummaryStat({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "flame" | "hoop" | "neon" | "ink";
}) {
  const accent = {
    flame: "bg-flame-500",
    hoop: "bg-hoop-500",
    neon: "bg-neon-500",
    ink: "bg-ink-500",
  }[tone];

  return (
    <div className="relative overflow-hidden card p-4">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${accent}`} />
      <div className="text-[14px] font-medium uppercase tracking-[0.12em] text-ink-500">
        {label}
      </div>
      <div className="stat-num mt-2 text-xl font-bold text-ink-50">{value}</div>
      <div className="mt-0.5 text-[14px] text-ink-300">{caption}</div>
    </div>
  );
}
