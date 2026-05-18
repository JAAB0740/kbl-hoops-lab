import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerProfileView } from "@/components/PlayerProfile";
import { PlayerGameLog } from "@/components/PlayerGameLog";
import { ScrollToTopFab } from "@/components/ScrollToTopFab";
import {
  getAllPlayerNos,
  getPlayerProfile,
  getRoundTrend,
  getTeammates,
  PLAYERS_DETAIL_META,
} from "@/lib/playerProfiles";
import { playerGameLog } from "@/lib/boxscores";
import { teamLogoSrc } from "@/lib/teamLogos";

interface Props {
  params: { id: string };
}

export function generateStaticParams() {
  return getAllPlayerNos().map((id) => ({ id }));
}

export function generateMetadata({ params }: Props) {
  const profile = getPlayerProfile(params.id);
  if (!profile) {
    return { title: "선수 — KBL Hoops Lab" };
  }
  return {
    title: `${profile.kname} (${profile.team.short}) — KBL Hoops Lab`,
    description: `${profile.kname} 선수의 2025-26 시즌 평균, 라운드별 추이, 플레이오프 비교.`,
  };
}

export default function PlayerProfilePage({ params }: Props) {
  const profile = getPlayerProfile(params.id);
  if (!profile) {
    notFound();
  }

  const trend = getRoundTrend(profile);
  const teammates = getTeammates(profile.playerNo, 5);
  const gameLog = playerGameLog(profile.playerNo);
  const logoSrc = teamLogoSrc(profile.team.short);

  const fetchedDate = PLAYERS_DETAIL_META.fetchedAt
    ? new Date(PLAYERS_DETAIL_META.fetchedAt).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* 브레드크럼 */}
        <nav className="mb-6 flex items-center gap-2 text-[14px] text-ink-500">
          <Link href="/players" className="hover:text-ink-300">
            선수
          </Link>
          <span>›</span>
          <span className="text-ink-300">{profile.kname}</span>
        </nav>

        <PlayerProfileView
          profile={profile}
          trend={trend}
          teammates={teammates}
          teamLogoSrc={logoSrc}
        />

        {/* 박스스코어 기반 게임로그 — 데이터 있을 때만 */}
        {gameLog.length > 0 && (
          <section className="mt-8">
            <PlayerGameLog log={gameLog} playerName={profile.kname} />
          </section>
        )}

        <footer className="mt-8 border-t border-court-700/60 pt-6 text-center text-[14px] text-ink-500">
          데이터 출처: KBL 공식 API (api-stats.kbl.or.kr) · 마지막 갱신 {fetchedDate}
        </footer>
      </main>

      {/* 우측 하단 플로팅 — 게임 로그가 길어진 페이지에서 맨 위로 빠른 이동 */}
      <ScrollToTopFab />
    </div>
  );
}
