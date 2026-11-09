import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ARCHIVE_SEASONS,
  getArchiveSeason,
  type ArchiveLeader,
  type ArchivePlayoffRound,
  type ArchivePlayoffSeries,
  type ArchiveSeason,
} from "@/lib/archiveData";
import { seasonLabel } from "@/lib/kblSeason";

type Params = { params: { season: string } };

export function generateStaticParams() {
  return ARCHIVE_SEASONS.map((s) => ({ season: s.code }));
}

export function generateMetadata({ params }: Params) {
  const meta = ARCHIVE_SEASONS.find((s) => s.code === params.season);
  if (!meta) return { title: "아카이브" };
  return {
    title: `${meta.label} 시즌 아카이브`,
    description: `KBL ${meta.label} 시즌 순위·챔피언·득점/어시/리바·3점 리더 요약`,
  };
}

export default function ArchiveSeasonPage({ params }: Params) {
  const data = getArchiveSeason(params.season);
  if (!data) notFound();
  const { meta, standings, regularChampion, finalChampion } = data;

  return (
    <main className="mx-auto max-w-7xl px-3 py-8 md:px-6">
      {/* Hero */}
      <section className="mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/archive"
                className="chip border-ink-500/30 bg-court-800/60 text-ink-300 hover:text-ink-100"
              >
                ← 아카이브
              </Link>
              <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
                시즌 종료
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-50 md:text-4xl">
              {meta.label} 시즌
            </h1>
            <p className="mt-1.5 text-sm text-ink-300">
              정규리그 1위 · <span className="text-ink-50">{regularChampion}</span>
              {finalChampion && (
                <>
                  {" · "}
                  챔피언 ·{" "}
                  <span className="font-medium text-flame-400">{finalChampion.team}</span>{" "}
                  <span className="stat-num text-ink-500">({finalChampion.seriesText})</span>
                </>
              )}
            </p>
          </div>

          {/* 시즌 전환 — 현재 시즌(홈) + 다른 아카이브 시즌 */}
          <nav className="flex flex-wrap gap-1.5">
            <Link
              href="/"
              className="rounded-md border border-court-700 px-2.5 py-1 text-[14px] font-medium text-ink-300 transition-colors hover:bg-court-700/40 hover:text-ink-50"
            >
              {seasonLabel()}
              <span className="ml-1 text-[11px] text-ink-500">· 진행 중</span>
            </Link>
            {ARCHIVE_SEASONS.map((s) => (
              <Link
                key={s.code}
                href={`/archive/${s.code}`}
                className={[
                  "rounded-md px-2.5 py-1 text-[14px] font-medium transition-colors",
                  s.code === meta.code
                    ? "bg-flame-500/15 text-flame-400 ring-1 ring-flame-500/30"
                    : "border border-court-700 text-ink-300 hover:bg-court-700/40 hover:text-ink-50",
                ].join(" ")}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {/* 순위표 전체 */}
      <section className="mb-8">
        <ArchiveStandingsTable data={data} />
      </section>

      {/* 플레이오프 — 6강/4강/챔프결 */}
      {data.playoffRounds.length > 0 && (
        <section className="mb-8">
          <PlayoffBracket rounds={data.playoffRounds} champion={data.finalChampion?.team ?? null} />
        </section>
      )}

      {/* 리더 6종 */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ArchiveLeadersCard
          title="득점 리더"
          subtitle="정규시즌 PPG TOP 10"
          leaders={data.scoringLeaders}
          unit="득점"
          accent="flame"
        />
        <ArchiveLeadersCard
          title="어시스트 리더"
          subtitle="정규시즌 APG TOP 10"
          leaders={data.assistLeaders}
          unit="어시"
          accent="neon"
        />
        <ArchiveLeadersCard
          title="리바운드 리더"
          subtitle="정규시즌 RPG TOP 10"
          leaders={data.reboundLeaders}
          unit="리바"
          accent="hoop"
        />
        <ArchiveLeadersCard
          title="3점 성공 리더"
          subtitle="경기당 3점 성공 TOP 10"
          leaders={data.threePointLeaders}
          unit="3P"
          accent="neon"
        />
        <ArchiveLeadersCard
          title="스틸 리더"
          subtitle="정규시즌 SPG TOP 10"
          leaders={data.stealLeaders}
          unit="스틸"
          accent="hoop"
        />
        <ArchiveLeadersCard
          title="블락 리더"
          subtitle="정규시즌 BPG TOP 10"
          leaders={data.blockLeaders}
          unit="블락"
          accent="flame"
        />
      </section>
    </main>
  );
}

function ArchiveStandingsTable({ data }: { data: ArchiveSeason }) {
  const topRank = (r: number) =>
    r === 1
      ? "text-flame-500"
      : r === 2
      ? "text-flame-400"
      : r >= 3 && r <= 6
      ? "text-hoop-400"
      : r === data.standings.length
      ? "text-buzzer-500"
      : "text-ink-300";

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">정규리그 최종 순위</h3>
          <p className="mt-0.5 text-[14px] text-ink-500">
            {data.meta.label} · 10팀 · 54경기 기준
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-court-700/70">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="bg-court-900/70 text-[13px] uppercase tracking-[0.1em] text-ink-500">
              <th className="py-2.5 pl-3 text-left font-medium">#</th>
              <th className="py-2.5 text-left font-medium">팀</th>
              <th className="py-2.5 text-right font-medium">승</th>
              <th className="py-2.5 text-right font-medium">패</th>
              <th className="py-2.5 text-right font-medium">승률</th>
              <th className="py-2.5 text-right font-medium">득점</th>
              <th className="py-2.5 text-right font-medium">실점</th>
              <th className="py-2.5 text-right font-medium">ORtg</th>
              <th className="py-2.5 text-right font-medium">DRtg</th>
              <th className="py-2.5 pr-3 text-right font-medium">NetRtg</th>
            </tr>
          </thead>
          <tbody>
            {data.standings.map((t) => (
              <tr key={t.shortName} className="transition hover:bg-court-700/30">
                <td className="py-2.5 pl-3 align-middle">
                  <span className={`stat-num text-[16px] font-semibold ${topRank(t.rank)}`}>
                    {t.rank}
                  </span>
                </td>
                <td className="py-2.5 align-middle">
                  <span className="text-[16px] font-medium text-ink-50">{t.name}</span>
                </td>
                <td className="stat-num py-2.5 text-right text-ink-100">{t.wins}</td>
                <td className="stat-num py-2.5 text-right text-ink-300">{t.losses}</td>
                <td className="stat-num py-2.5 text-right font-medium text-ink-50">
                  {t.winPct.toFixed(3).replace(/^0/, "")}
                </td>
                <td className="stat-num py-2.5 text-right text-ink-100">
                  {t.ppg.toFixed(1)}
                </td>
                <td className="stat-num py-2.5 text-right text-ink-300">
                  {t.oppPpg.toFixed(1)}
                </td>
                <td className="stat-num py-2.5 text-right text-ink-100">
                  {t.offRtg != null ? t.offRtg.toFixed(1) : "—"}
                </td>
                <td className="stat-num py-2.5 text-right text-ink-300">
                  {t.defRtg != null ? t.defRtg.toFixed(1) : "—"}
                </td>
                <td
                  className={`stat-num py-2.5 pr-3 text-right font-medium ${
                    t.netRtg == null
                      ? "text-ink-500"
                      : t.netRtg > 0
                      ? "text-neon-400"
                      : "text-buzzer-500"
                  }`}
                >
                  {t.netRtg != null
                    ? (t.netRtg > 0 ? "+" : "") + t.netRtg.toFixed(1)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayoffBracket({
  rounds,
  champion,
}: {
  rounds: ArchivePlayoffRound[];
  champion: string | null;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink-50">플레이오프</h3>
        <p className="mt-0.5 text-[14px] text-ink-500">
          라운드별 시리즈 결과
          {champion && (
            <>
              {" · 최종 챔피언 "}
              <span className="font-medium text-flame-400">{champion}</span>
            </>
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {rounds.map((r) => (
          <PlayoffRoundCard key={r.tag} round={r} champion={champion} />
        ))}
      </div>
    </div>
  );
}

function PlayoffRoundCard({
  round,
  champion,
}: {
  round: ArchivePlayoffRound;
  champion: string | null;
}) {
  const isFinals = round.tag === "챔피언결정전";
  return (
    <div className="rounded-lg border border-court-700/60 bg-court-900/40 p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span
          className={[
            "text-[13px] font-medium",
            isFinals ? "text-flame-400" : "text-ink-300",
          ].join(" ")}
        >
          {round.label}
        </span>
        <span className="text-[12px] text-ink-500">
          {round.series.length} 시리즈
        </span>
      </div>
      <ul className="space-y-3">
        {round.series.map((s, i) => (
          <PlayoffSeriesItem
            key={`${s.winner}-${s.loser}-${i}`}
            series={s}
            champion={champion}
          />
        ))}
      </ul>
    </div>
  );
}

function PlayoffSeriesItem({
  series,
  champion,
}: {
  series: ArchivePlayoffSeries;
  champion: string | null;
}) {
  const isChamp = series.winner === champion;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[14px] font-medium text-ink-50">
          <span className={isChamp ? "text-flame-400" : "text-ink-50"}>
            {series.winner}
          </span>
          <span className="mx-1.5 text-ink-500">vs</span>
          <span className="text-ink-300">{series.loser}</span>
        </span>
        <span className="stat-num shrink-0 text-[14px] font-semibold text-ink-100">
          {series.winnerWins}-{series.loserWins}
        </span>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {series.games.map((g, i) => {
          const winnerSide = g.homeScore > g.awayScore ? "home" : "away";
          return (
            <li
              key={`${g.date}-${i}`}
              className="flex items-center justify-between text-[12px] text-ink-500"
            >
              <span className="stat-num text-ink-500">G{i + 1}</span>
              <span className="stat-num text-ink-300">
                <span
                  className={
                    winnerSide === "home" ? "text-ink-100 font-medium" : ""
                  }
                >
                  {g.home} {g.homeScore}
                </span>
                <span className="mx-1 text-ink-500">·</span>
                <span
                  className={
                    winnerSide === "away" ? "text-ink-100 font-medium" : ""
                  }
                >
                  {g.awayScore} {g.away}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

type Accent = "flame" | "neon" | "hoop";
const ACCENT: Record<Accent, { topText: string; bar: string }> = {
  flame: { topText: "text-flame-500", bar: "bg-flame-500/40" },
  neon: { topText: "text-neon-400", bar: "bg-neon-500/40" },
  hoop: { topText: "text-hoop-400", bar: "bg-hoop-500/40" },
};

function ArchiveLeadersCard({
  title,
  subtitle,
  leaders,
  unit,
  accent,
}: {
  title: string;
  subtitle: string;
  leaders: ArchiveLeader[];
  unit: string;
  accent: Accent;
}) {
  const c = ACCENT[accent];
  const max = Math.max(...leaders.map((l) => l.value), 1);
  return (
    <div className="card p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
        <p className="mt-0.5 text-[14px] text-ink-500">{subtitle}</p>
      </div>
      <ul className="space-y-2">
        {leaders.map((p) => {
          const pct = (p.value / max) * 100;
          const isTop = p.rank === 1;
          return (
            <li key={`${p.kname}-${p.rank}`} className="flex items-center gap-3">
              <span
                className={[
                  "stat-num w-5 text-right text-[15px] font-semibold",
                  isTop ? c.topText : "text-ink-500",
                ].join(" ")}
              >
                {p.rank}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-medium text-ink-50">
                    {p.kname}
                    <span className="text-[13px] font-normal text-ink-500">
                      {" "}· {p.teamShort}
                    </span>
                  </span>
                  <span className={`stat-num text-[15px] font-semibold ${isTop ? c.topText : "text-ink-100"}`}>
                    {p.value.toFixed(1)}
                    <span className="ml-1 text-[12px] font-normal text-ink-500">{unit}</span>
                  </span>
                </div>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-court-800">
                  <div className={`h-full ${c.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
