import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerProfileView } from "@/components/PlayerProfile";
import { PlayerGameLog } from "@/components/PlayerGameLog";
import { ScrollToTopFab } from "@/components/ScrollToTopFab";
import {
  getPlayerProfileForSeason,
  getAllPlayerNosForSeason,
  getTeammatesForSeason,
  getRoundTrendForSeason,
  getRegularPopulationForSeason,
  getPlayoffPopulationForSeason,
  getPlayersDetailMetaForSeason,
} from "@/lib/playerProfilesSeasonal";
import { playerGameLogForSeason } from "@/lib/boxscoresSeasonal";
import { getPlayerShotChartForSeason } from "@/lib/shotChartsServer";
import { listPlayersSeasons } from "@/lib/playersSeasonData";
import { getCurrentSeason } from "@/lib/kblSeason";
import { teamLogoSrc } from "@/lib/teamLogos";

interface Props {
  params: { code: string; id: string };
}

export function generateStaticParams() {
  const current = getCurrentSeason().code;
  const seasons = listPlayersSeasons(current);
  const codes = new Set(seasons.map((s) => s.code));
  codes.add(current);
  const out: { code: string; id: string }[] = [];
  for (const code of codes) {
    for (const id of getAllPlayerNosForSeason(code)) {
      out.push({ code, id });
    }
  }
  return out;
}

export function generateMetadata({ params }: Props) {
  const current = getCurrentSeason().code;
  const seasons = listPlayersSeasons(current);
  const meta = seasons.find((s) => s.code === params.code);
  const seasonLbl = meta?.label ?? params.code;
  const profile = getPlayerProfileForSeason(params.code, params.id);
  if (!profile) {
    return { title: `선수 — ${seasonLbl} · KBL Hoops Lab` };
  }
  return {
    title: `${profile.kname} (${profile.team.short}) · ${seasonLbl} — KBL Hoops Lab`,
    description: `${profile.kname} 선수의 ${seasonLbl} 시즌 평균, 라운드별 추이, 플레이오프 비교.`,
  };
}

export default function PlayerSeasonProfilePage({ params }: Props) {
  const current = getCurrentSeason().code;
  const seasons = listPlayersSeasons(current);
  const seasonMeta = seasons.find((s) => s.code === params.code);
  const seasonLbl = seasonMeta?.label ?? params.code;

  const profile = getPlayerProfileForSeason(params.code, params.id);
  if (!profile) notFound();

  const shotChart = getPlayerShotChartForSeason(params.code, profile.playerNo);
  if (shotChart) profile.shotChart = shotChart;

  const trend = getRoundTrendForSeason(profile);
  const teammates = getTeammatesForSeason(params.code, profile.playerNo, 5);
  const gameLog = playerGameLogForSeason(params.code, profile.playerNo);
  const regularPop = getRegularPopulationForSeason(params.code);
  const playoffPop = getPlayoffPopulationForSeason(params.code);
  const logoSrc = teamLogoSrc(profile.team.short);
  const detailMeta = getPlayersDetailMetaForSeason(params.code);

  const fetchedDate = detailMeta.fetchedAt
    ? new Date(detailMeta.fetchedAt).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  const isCurrent = params.code === current;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-3 py-8 md:px-6">
        {/* 브레드크럼 */}
        <nav className="mb-4 flex items-center gap-2 text-[14px] text-ink-500">
          <Link href="/players" className="hover:text-ink-300">
            선수
          </Link>
          <span>›</span>
          <Link
            href={`/players/season/${params.code}`}
            className="hover:text-ink-300"
          >
            {seasonLbl}
          </Link>
          <span>›</span>
          <span className="text-ink-300">{profile.kname}</span>
        </nav>

        {/* 시즌 chip (현재/종료) */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span
            className={
              isCurrent
                ? "chip border-neon-500/30 bg-neon-500/10 text-neon-400"
                : "chip border-ink-500/30 bg-court-800/60 text-ink-300"
            }
          >
            {isCurrent ? "진행 중" : "시즌 종료"} · {seasonLbl}
          </span>
        </div>

        <PlayerProfileView
          profile={profile}
          trend={trend}
          teammates={teammates}
          teamLogoSrc={logoSrc}
          regularPopulation={regularPop}
          playoffPopulation={playoffPop}
          seasonLabelText={seasonLbl}
          linkSeasonCode={params.code}
          gameLogNode={
            gameLog.length > 0 ? (
              <section className="md:mt-2">
                <PlayerGameLog log={gameLog} playerName={profile.kname} />
              </section>
            ) : null
          }
        />

        <footer className="mt-6 md:mt-8 border-t border-court-700/60 pt-4 md:pt-6 text-center text-[12px] md:text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API (api-stats.kbl.or.kr) · 마지막 갱신 {fetchedDate}
        </footer>
      </main>

      <ScrollToTopFab />
    </div>
  );
}
