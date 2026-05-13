import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import { fmtDate } from "@/lib/gamesUtil";
import type { PlayerStandoutWithGame } from "@/lib/standout";

/**
 * 홈 페이지 — 최근 경기들의 가장 임팩트 큰 선수 standout 합산.
 * 카드 클릭 시 해당 게임 상세 페이지로 이동.
 *
 * SNS 캡처 가치 + 사이트 첫 인상에 "이 사이트는 분석한다" 어필.
 */

const KIND_TONES: Record<PlayerStandoutWithGame["kind"], { goodEmoji: string; badEmoji: string }> = {
  scoring:      { goodEmoji: "🔥",  badEmoji: "🥶" },
  shooting:     { goodEmoji: "🎯",  badEmoji: "🌧️" },
  defense:      { goodEmoji: "🛡️", badEmoji: "🔓" },
  playmaking:   { goodEmoji: "🎭",  badEmoji: "🤷" },
  carelessness: { goodEmoji: "✨",  badEmoji: "💥" },
  tempo:        { goodEmoji: "⚡",  badEmoji: "🐌" },
};

export function RecentStandoutsHighlight({ items }: { items: PlayerStandoutWithGame[] }) {
  if (items.length === 0) return null;

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

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s, i) => (
          <HighlightCard key={`${s.playerNo}-${i}`} standout={s} />
        ))}
      </div>
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
    <Link
      href={`/games/${encodeURIComponent(s.gameContext.gmkey)}`}
      className={`relative block overflow-hidden rounded-lg border p-4 transition hover:scale-[1.01] ${cardBg}`}
    >
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: teamColor }}
      />

      {/* 헤더: 이모지 + stat 카테고리 + 팀 */}
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
          {fmtDate(s.gameContext.date)} · {s.gameContext.tag} · {s.gameContext.isHome ? "vs" : "@"} {s.gameContext.opponent}
        </div>
      </div>

      {/* 큰 수치 + delta */}
      <div className="mt-2 flex items-baseline gap-2">
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
    </Link>
  );
}
