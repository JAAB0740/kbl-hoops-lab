import { PlayoffBracketView } from "@/components/PlayoffBracket";
import { buildPlayoffBracket } from "@/lib/playoffs";

export const metadata = {
  title: "플레이오프 — KBL Hoops Lab",
};

export default function PlayoffsPage() {
  const bracket = buildPlayoffBracket();
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
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* 헤더 */}
        <section className="mb-8">
          <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
            <span className="h-1.5 w-1.5 rounded-full bg-flame-500" />
            POST-SEASON · 2025-26
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
            봄 농구 브래킷
          </h1>
          <p className="mt-1.5 text-sm text-ink-300">
            상위 6팀이 챔피언결정전을 향해 격돌. 시리즈 박스를 클릭하면 경기별 스코어를 확인할 수 있어요.
          </p>
        </section>

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

        {/* 브래킷 */}
        <section className="mb-8">
          <PlayoffBracketView bracket={bracket} />
        </section>

        <footer className="mt-8 border-t border-court-700/60 pt-6 text-center text-[14px] text-ink-500">
          데이터 출처: KBL 공식 일정 · 자동 fetch (npm run parse:kbl-schedule)
        </footer>
      </main>
    </div>
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
