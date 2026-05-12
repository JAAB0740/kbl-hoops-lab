import { TEAM_COLORS } from "@/lib/data";
import type { Standout } from "@/lib/standout";

/**
 * "What stood out" — 게임에서 평소와 크게 달랐던 stat 카드들.
 *
 * 자동 감지된 standout 배열을 그리드로 표시.
 * 카드 디자인: 큰 수치 + 비교 막대 + 한 줄 카피.
 * SNS 캡처 시 자연스럽게 공유될 수 있는 임팩트 강조.
 */

const KIND_TONES: Record<Standout["kind"], { emoji: string; bg: string; ring: string; label: string }> = {
  scoring:      { emoji: "🔥", bg: "bg-flame-500/10",  ring: "border-flame-500/40",  label: "득점" },
  shooting:     { emoji: "🎯", bg: "bg-flame-500/10",  ring: "border-flame-500/40",  label: "슈팅" },
  defense:      { emoji: "🛡️", bg: "bg-hoop-500/10",   ring: "border-hoop-500/40",   label: "수비/허슬" },
  playmaking:   { emoji: "🎭", bg: "bg-neon-500/10",   ring: "border-neon-500/40",   label: "리딩" },
  carelessness: { emoji: "💥", bg: "bg-buzzer-500/10", ring: "border-buzzer-500/40", label: "실책" },
  tempo:        { emoji: "⚡", bg: "bg-neon-500/10",   ring: "border-neon-500/40",   label: "효율" },
};

export function StandoutCards({
  items,
  title = "What Stood Out",
  subtitle,
}: {
  items: Standout[];
  title?: string;
  subtitle?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-500">
            {subtitle ?? "이 게임이 시즌 평균과 크게 달랐던 지표 — 자동 감지"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((s, i) => (
          <StandoutCard key={i} standout={s} />
        ))}
      </div>
    </section>
  );
}

function StandoutCard({ standout: s }: { standout: Standout }) {
  const tone = KIND_TONES[s.kind];
  const teamColor = TEAM_COLORS[s.teamShort] ?? "#94a3b8";
  const deltaArrow = s.direction === "up" ? "↑" : "↓";
  const deltaColor =
    s.goodOrBad === "good"
      ? "text-hoop-400"
      : "text-buzzer-400";

  // 비교 막대 — 게임값 / max(게임값, 시즌평균) 비율로 길이 결정
  const maxVal = Math.max(s.gameValue, s.seasonAvg, 1);
  const gameWidth = Math.min(100, (s.gameValue / maxVal) * 100);
  const seasonWidth = Math.min(100, (s.seasonAvg / maxVal) * 100);

  return (
    <div className={`relative overflow-hidden rounded-lg border ${tone.ring} ${tone.bg} p-4`}>
      {/* 좌측 컬러 바 — 팀 색 */}
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: teamColor }}
      />

      {/* 헤더: 이모지 + stat 이름 + 팀 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{tone.emoji}</span>
          <span className="text-[15px] font-semibold text-ink-100">{s.stat}</span>
        </div>
        <span
          className="chip"
          style={{
            borderColor: teamColor + "60",
            backgroundColor: teamColor + "20",
            color: teamColor,
          }}
        >
          {s.teamShort}
        </span>
      </div>

      {/* 큰 수치 + delta */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="stat-num text-3xl font-bold text-ink-50">
          {s.fmtValue(s.gameValue)}
        </span>
        <span className={`stat-num text-[15px] font-bold ${deltaColor}`}>
          {deltaArrow} {s.fmtValue(Math.abs(s.delta))}
        </span>
      </div>

      {/* 비교 막대 — 이 게임 vs 시즌 평균 */}
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

      {/* 카피 */}
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
