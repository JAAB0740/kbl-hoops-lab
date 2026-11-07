import Link from "next/link";
import { ARCHIVE_SEASONS, getArchiveSeason } from "@/lib/archiveData";
import { seasonLabel } from "@/lib/kblSeason";

export const metadata = {
  title: "시즌 아카이브",
  description: "지난 5시즌 KBL 정규리그 1위·챔피언·리더 아카이브",
};

export default function ArchiveIndex() {
  const seasons = ARCHIVE_SEASONS.map((meta) => {
    const data = getArchiveSeason(meta.code);
    return { meta, data };
  });

  return (
    <main className="mx-auto max-w-7xl px-3 py-8 md:px-6">
      <section className="mb-8">
        <span className="chip border-ink-500/30 bg-court-800/60 text-ink-300">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-500" />
          시즌 아카이브
        </span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-50 md:text-3xl">
          지난 KBL 시즌
        </h1>
        <p className="mt-1.5 text-sm text-ink-300">
          현재 시즌 ({seasonLabel()}) 은{" "}
          <Link href="/" className="text-flame-400 underline-offset-2 hover:underline">
            홈
          </Link>
          에서 · 아래는 종료된 시즌의 스냅샷.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {seasons.map(({ meta, data }) => {
          if (!data) {
            return (
              <div key={meta.code} className="card p-5 opacity-60">
                <div className="text-sm text-ink-500">{meta.label}</div>
                <div className="mt-1 text-ink-300">데이터 준비 중</div>
              </div>
            );
          }
          const topTeam = data.standings[0];
          return (
            <Link
              key={meta.code}
              href={`/archive/${meta.code}`}
              className="card p-5 transition hover:border-flame-500/40 hover:bg-court-700/20"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-ink-50">{meta.label}</h2>
                <span className="text-[13px] text-ink-500">시즌 코드 {meta.code}</span>
              </div>

              <div className="mt-4 space-y-2.5 text-[14px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">정규리그 1위</span>
                  <span className="font-medium text-ink-50">
                    {topTeam?.name}{" "}
                    <span className="stat-num text-ink-300">
                      {topTeam?.wins}-{topTeam?.losses}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">챔피언</span>
                  <span className="font-medium">
                    {data.finalChampion ? (
                      <>
                        <span className="text-flame-400">{data.finalChampion.team}</span>{" "}
                        <span className="stat-num text-ink-500">
                          ({data.finalChampion.seriesText})
                        </span>
                      </>
                    ) : (
                      <span className="text-ink-500">—</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">득점 리더</span>
                  <span className="font-medium text-ink-100">
                    {data.scoringLeaders[0]?.kname}{" "}
                    <span className="stat-num text-ink-300">
                      {data.scoringLeaders[0]?.value.toFixed(1)}
                    </span>
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-court-700/60 pt-3 text-right text-[13px] text-flame-400">
                자세히 →
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
