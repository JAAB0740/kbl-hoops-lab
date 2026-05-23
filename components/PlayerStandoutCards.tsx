import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import { MobileSwipeGrid } from "@/components/MobileSwipeGrid";
import type { PlayerStandout } from "@/lib/standout";

/**
 * 개인 선수 "What stood out" — 게임의 박스스코어에서 평소와 크게 다른
 * 활약을 보인 선수들 자동 감지 카드.
 *
 * 카드 디자인: 선수 이름 (큰 글씨, 프로필 링크) + stat 변화 + 비교 막대.
 */

const KIND_TONES: Record<PlayerStandout["kind"], { goodEmoji: string; badEmoji: string }> = {
  scoring:      { goodEmoji: "🔥",  badEmoji: "🥶" },
  shooting:     { goodEmoji: "🎯",  badEmoji: "🌧️" },
  defense:      { goodEmoji: "🛡️", badEmoji: "🔓" },
  playmaking:   { goodEmoji: "🎭",  badEmoji: "🤷" },
  carelessness: { goodEmoji: "✨",  badEmoji: "💥" },
  tempo:        { goodEmoji: "⚡",  badEmoji: "🐌" },
};

export function PlayerStandoutCards({
  items,
  title = "주목할 개인 활약",
  subtitle,
}: {
  items: PlayerStandout[];
  title?: string;
  subtitle?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className="card p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-ink-50">{title}</h3>
        <p className="mt-0.5 text-[13px] text-ink-500">
          {subtitle ?? "출장 5분 이상 + 시즌 5경기 이상 선수 중, 평소 대비 크게 달랐던 활약 — 자동 감지"}
        </p>
      </div>
      {/* 모바일: 가로 스와이프(도트 포함) / sm+: 2~3열 그리드 */}
      <MobileSwipeGrid>
        {items.map((s, i) => (
          <PlayerStandoutCard key={`${s.playerNo}-${s.stat}-${i}`} standout={s} />
        ))}
      </MobileSwipeGrid>
    </section>
  );
}

function PlayerStandoutCard({ standout: s }: { standout: PlayerStandout }) {
  const tone = KIND_TONES[s.kind];
  const teamColor = TEAM_COLORS[s.teamShort] ?? "#94a3b8";
  const isGood = s.goodOrBad === "good";
  const emoji = isGood ? tone.goodEmoji : tone.badEmoji;
  const deltaArrow = s.direction === "up" ? "↑" : "↓";
  const deltaColor = isGood ? "text-hoop-400" : "text-buzzer-400";
  const cardBg = isGood
    ? "border-hoop-500/30 bg-hoop-500/[0.06]"
    : "border-buzzer-500/30 bg-buzzer-500/[0.06]";

  const maxVal = Math.max(s.gameValue, s.seasonAvg, 1);
  const gameWidth = Math.min(100, (s.gameValue / maxVal) * 100);
  const seasonWidth = Math.min(100, (s.seasonAvg / maxVal) * 100);

  return (
    <div className={`relative overflow-hidden rounded-lg border ${cardBg} p-4`}>
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

      {/* 선수 이름 — 큰 글씨, 프로필 링크 */}
      <div className="mt-2">
        <Link
          href={`/players/${s.playerNo}`}
          className="text-[18px] font-bold text-ink-50 hover:text-flame-400"
        >
          {s.pname}
        </Link>
        <span className="ml-2 text-[12px] text-ink-500">
          {s.minutes.toFixed(0)}분 출장
        </span>
      </div>

      {/* 큰 수치 + delta */}
      <div className="mt-2 flex items-baseline gap-2">
        <span className="stat-num text-2xl font-bold text-ink-50">
          {s.fmtValue(s.gameValue)}
        </span>
        <span className={`stat-num text-[15px] font-bold ${deltaColor}`}>
          {deltaArrow} {s.fmtValue(Math.abs(s.delta))}
        </span>
      </div>

      {/* 비교 막대 */}
      <div className="mt-3 space-y-1.5">
        <BarRow
          label="이 경기"
          value={s.fmtValue(s.gameValue)}
          width={gameWidth}
          color={teamColor}
          bold
        />
        <BarRow
          label="시즌 평균"
          value={s.fmtValue(s.seasonAvg)}
          width={seasonWidth}
          color="#525c6c"
        />
      </div>

      <p className="mt-3 text-[13px] text-ink-300">{s.caption}</p>
    </div>
  );
}

function BarRow({
  label,
  value,
  width,
  color,
  bold,
}: {
  label: string;
  value: string;
  width: number;
  color: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span className="w-14 shrink-0 text-ink-500">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-court-800">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <span
        className={`w-12 shrink-0 text-right stat-num ${
          bold ? "font-semibold text-ink-100" : "text-ink-400"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
