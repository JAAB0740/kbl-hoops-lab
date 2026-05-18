import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import { fmtDate } from "@/lib/gamesUtil";
import type { PlayerStandoutWithGame } from "@/lib/standout";
import { StandoutsCarousel } from "./StandoutsCarousel";

/**
 * 홈 페이지 — 최근 경기들의 가장 임팩트 큰 선수 standout 합산.
 *
 * 데스크탑(md+) : 2~3열 grid
 * 모바일        : 가로 스와이프 캐러셀 + Peeking(85vw) + scroll-snap
 *                · 카드 전체 링크 → 명시 버튼 분리 (오터치 방지)
 *                · 도트 페이지 인디케이터
 *                · active:scale 피드백
 *
 * 카드 렌더 자체는 server, 캐러셀 wrapper(IO + 도트)만 client component.
 */

const KIND_TONES: Record<
  PlayerStandoutWithGame["kind"],
  { goodEmoji: string; badEmoji: string }
> = {
  scoring: { goodEmoji: "🔥", badEmoji: "🥶" },
  shooting: { goodEmoji: "🎯", badEmoji: "🌧️" },
  defense: { goodEmoji: "🛡️", badEmoji: "🔓" },
  playmaking: { goodEmoji: "🎭", badEmoji: "🤷" },
  carelessness: { goodEmoji: "✨", badEmoji: "💥" },
  tempo: { goodEmoji: "⚡", badEmoji: "🐌" },
};

export function RecentStandoutsHighlight({
  items,
}: {
  items: PlayerStandoutWithGame[];
}) {
  if (items.length === 0) return null;

  const cards = items.map((s, i) => (
    <HighlightCard key={`${s.playerNo}-${i}`} standout={s} />
  ));
  const dotColors = items.map(
    (s) => TEAM_COLORS[s.teamShort] ?? "#f97316",
  );

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-court-700/60 bg-gradient-to-r from-flame-500/10 via-court-900/0 to-neon-500/10 px-5 py-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="chip border-flame-500/40 bg-flame-500/15 text-flame-400">
              <span className="h-1.5 w-1.5 rounded-full bg-flame-500" />
              HIGHLIGHTS
            </span>
            <h3 className="mt-2 text-base font-bold tracking-tight text-ink-50">
              최근 경기 What Stood Out
            </h3>
            <p className="mt-0.5 text-[13px] text-ink-500">
              최근 final 경기들에서 평소 대비 가장 큰 변화를 보인 선수들 — 자동 감지
            </p>
          </div>
        </div>
      </div>

      <StandoutsCarousel cards={cards} dotColors={dotColors} />
    </section>
  );
}

function HighlightCard({ standout: s }: { standout: PlayerStandoutWithGame }) {
  const tone = KIND_TONES[s.kind];
  const teamColor = TEAM_COLORS[s.teamShort] ?? "#94a3b8";
  const isGood = s.goodOrBad === "good";
  const emoji = isGood ? tone.goodEmoji : tone.badEmoji;
  const deltaArrow = s.direction === "up" ? "↑" : "↓";
  const deltaColor = isGood ? "text-hoop-400" : "text-buzzer-400";
  const cardBg = isGood
    ? "border-hoop-500/30 bg-hoop-500/[0.06]"
    : "border-buzzer-500/30 bg-buzzer-500/[0.06]";

  return (
    <article
      className={[
        "relative h-full overflow-hidden rounded-lg border p-4",
        // 모바일 active 피드백 (Tap)
        "transition-transform active:scale-[0.98]",
        // 데스크탑 hover
        "md:transition md:hover:scale-[1.01]",
        cardBg,
      ].join(" ")}
    >
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: teamColor }}
      />

      {/* 헤더: 이모지 + 카테고리 + 팀 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <span className="text-[14px] font-medium text-ink-300">{s.stat}</span>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[14px] font-bold tracking-wide"
          style={{
            borderColor: teamColor + "80",
            backgroundColor: teamColor + "20",
            color: teamColor,
          }}
        >
          {s.teamShort}
        </span>
      </div>

      {/* 선수 이름 + 게임 컨텍스트 */}
      <div className="mt-2">
        <div className="text-[18px] font-bold text-ink-50">{s.pname}</div>
        <div className="mt-0.5 text-[12px] text-ink-500">
          {fmtDate(s.gameContext.date)} · {s.gameContext.tag} ·{" "}
          {s.gameContext.isHome ? "vs" : "@"} {s.gameContext.opponent}
        </div>
      </div>

      {/* 큰 수치 + delta + 시즌 평균 — nowrap 으로 모바일 줄바꿈 방지 */}
      <div className="mt-2 flex items-baseline gap-2 whitespace-nowrap">
        <span className="stat-num text-2xl font-bold text-ink-50">
          {s.fmtValue(s.gameValue)}
        </span>
        <span className={`stat-num text-[15px] font-bold ${deltaColor}`}>
          {deltaArrow} {s.fmtValue(Math.abs(s.delta))}
        </span>
        <span className="ml-auto text-[11px] text-ink-500">
          시즌 {s.fmtValue(s.seasonAvg)}
        </span>
      </div>

      <p className="mt-2 text-[12px] text-ink-300 line-clamp-1">{s.caption}</p>

      {/* 명시적 이동 버튼 — 카드 자체 클릭 대신 (오터치 방지) */}
      <Link
        href={`/games/${encodeURIComponent(s.gameContext.gmkey)}`}
        className={[
          "mt-3 inline-flex items-center gap-1 rounded-md",
          "border border-court-700 bg-court-800/60 px-2.5 py-1",
          "text-[12px] text-ink-300 transition",
          "hover:border-flame-500/50 hover:text-flame-400",
          "active:scale-95",
        ].join(" ")}
      >
        이 경기 상세 <span aria-hidden>→</span>
      </Link>
    </article>
  );
}
