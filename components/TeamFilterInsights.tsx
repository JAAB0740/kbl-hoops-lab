import type { FilteredTeam } from "@/lib/data";

/**
 * 현재 필터의 결과 vs 정규시즌 전체(베이스라인) 비교 인사이트.
 *  - 가장 많이 올라간 팀 / 가장 많이 떨어진 팀 (rank delta)
 *  - 가장 큰 PPG 차이 (필터별 vs 시즌)
 *  - 승률 차이 1위
 *
 * 필터를 바꿀 때마다 자동으로 흥미로운 인사이트 노출.
 */
export function TeamFilterInsights({
  teams,
  baseline,
  label,
}: {
  teams: FilteredTeam[];
  baseline: FilteredTeam[];
  /** 현재 필터 라벨 (예: "1쿼터", "홈 · 1라운드") */
  label: string;
}) {
  if (!teams || teams.length === 0 || !baseline || baseline.length === 0) {
    return null;
  }
  // 베이스라인이 현재와 동일한 데이터면 표시 안 함 (정규시즌 전체일 때)
  const isBaseline =
    teams === baseline ||
    teams.length === baseline.length &&
      teams.every((t, i) => t.code === baseline[i]?.code && t.rank === baseline[i]?.rank);
  if (isBaseline) return null;

  const baseMap = new Map(baseline.map((t) => [t.code, t]));

  // 1. 가장 많이 올라간/떨어진 팀
  let bestUp: { team: FilteredTeam; delta: number } | null = null;
  let bestDown: { team: FilteredTeam; delta: number } | null = null;
  let bestPPG: { team: FilteredTeam; delta: number } | null = null;
  let bestWinPct: { team: FilteredTeam; delta: number } | null = null;

  for (const t of teams) {
    const b = baseMap.get(t.code);
    if (!b) continue;
    const rDelta = b.rank - t.rank;     // 양수 = 올라감
    if (!bestUp || rDelta > bestUp.delta) bestUp = { team: t, delta: rDelta };
    if (!bestDown || rDelta < bestDown.delta) bestDown = { team: t, delta: rDelta };
    const pDelta = t.stats.points - b.stats.points;
    if (!bestPPG || Math.abs(pDelta) > Math.abs(bestPPG.delta)) {
      bestPPG = { team: t, delta: pDelta };
    }
    const wDelta = t.winPct - b.winPct;
    if (!bestWinPct || Math.abs(wDelta) > Math.abs(bestWinPct.delta)) {
      bestWinPct = { team: t, delta: wDelta };
    }
  }

  // 의미있는 변화만 필터
  const cards: { label: string; team: FilteredTeam; value: string; tone: "up" | "down" | "neutral" }[] = [];
  if (bestUp && bestUp.delta > 0) {
    cards.push({
      label: `${label}에서 약진`,
      team: bestUp.team,
      value: `▲${bestUp.delta} → ${bestUp.team.rank}위`,
      tone: "up",
    });
  }
  if (bestDown && bestDown.delta < 0) {
    cards.push({
      label: `${label}에서 부진`,
      team: bestDown.team,
      value: `▼${Math.abs(bestDown.delta)} → ${bestDown.team.rank}위`,
      tone: "down",
    });
  }
  if (bestPPG && Math.abs(bestPPG.delta) >= 2) {
    cards.push({
      label: `시즌 평균 대비 PPG 변화`,
      team: bestPPG.team,
      value: `${bestPPG.delta >= 0 ? "+" : ""}${bestPPG.delta.toFixed(1)} (${bestPPG.team.stats.points.toFixed(1)})`,
      tone: bestPPG.delta >= 0 ? "up" : "down",
    });
  }
  if (bestWinPct && Math.abs(bestWinPct.delta) >= 0.05) {
    cards.push({
      label: `시즌 평균 대비 승률 변화`,
      team: bestWinPct.team,
      value: `${bestWinPct.delta >= 0 ? "+" : ""}${(bestWinPct.delta * 100).toFixed(1)}%p`,
      tone: bestWinPct.delta >= 0 ? "up" : "down",
    });
  }

  if (cards.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink-50">필터 변화 인사이트</h3>
        <p className="mt-0.5 text-[12px] text-ink-500">
          {label} vs 정규시즌 전체 비교 · 가장 큰 변화
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-lg border border-court-700/70 bg-court-900/40 p-3"
          >
            <span
              className={[
                "absolute left-0 top-0 h-full w-[3px]",
                c.tone === "up"
                  ? "bg-hoop-500"
                  : c.tone === "down"
                    ? "bg-buzzer-500"
                    : "bg-ink-500",
              ].join(" ")}
            />
            <div className="text-[11px] uppercase tracking-[0.1em] text-ink-500">
              {c.label}
            </div>
            <div className="mt-1.5 text-[14px] font-semibold text-ink-50">
              {c.team.name}
            </div>
            <div
              className={[
                "stat-num mt-1 text-[13px] font-medium",
                c.tone === "up"
                  ? "text-hoop-400"
                  : c.tone === "down"
                    ? "text-buzzer-400"
                    : "text-ink-300",
              ].join(" ")}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
