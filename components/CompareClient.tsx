"use client";

import { useEffect, useMemo, useState } from "react";
import { HAS_REAL_TEAM_STATS, TEAM_STATS } from "@/lib/data";
import type { RawPlayer } from "@/lib/data";
import type { TeamStanding } from "@/lib/types";
import { StatRadar, type RadarSeries } from "@/components/StatRadar";
import { percentilesOf } from "@/lib/percentile";

type Mode = "team" | "player";

interface Props {
  standings: TeamStanding[];
  players: RawPlayer[];
}

/**
 * 8축 — 시계방향 그룹화:
 *   12시→6시 (우반구) = 슈팅 그룹 (PPG, FG%, 3P%, FT%)
 *   6시→12시 (좌반구) = 어시/리바/디펜시브 그룹 (APG, RPG, BLK, STL)
 */
const AXES: { key: keyof Stats; label: string; fmt: (v: number) => string }[] = [
  { key: "points",   label: "PPG", fmt: (v) => v.toFixed(1) },
  { key: "fgPct",    label: "FG%", fmt: (v) => v.toFixed(1) + "%" },
  { key: "threePct", label: "3P%", fmt: (v) => v.toFixed(1) + "%" },
  { key: "ftPct",    label: "FT%", fmt: (v) => v.toFixed(1) + "%" },
  { key: "assists",  label: "APG", fmt: (v) => v.toFixed(1) },
  { key: "rebounds", label: "RPG", fmt: (v) => v.toFixed(1) },
  { key: "blocks",   label: "BPG", fmt: (v) => v.toFixed(1) },
  { key: "steals",   label: "SPG", fmt: (v) => v.toFixed(1) },
];

type Stats = {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
};

const COLOR_A = "#f59e0b"; // flame
const COLOR_B = "#38bdf8"; // neon

// ─── 팀 스탯 조회 ───────────────────────────────────────
// 실데이터(TEAM_STATS)가 있으면 사용, 없으면 선수 주전 5인 합산으로 근사.
function teamStatsFrom(players: RawPlayer[], teamShort: string): Stats {
  const real = TEAM_STATS[teamShort];
  if (real) {
    return {
      points:   real.points,
      rebounds: real.rebounds,
      assists:  real.assists,
      steals:   real.steals,
      blocks:   real.blocks,
      fgPct:    real.fgPct,
      threePct: real.threePct,
      ftPct:    real.ftPct,
    };
  }
  // Fallback: 주전 5인 합산
  const teamPlayers = players
    .filter((p) => p.team === teamShort)
    .sort((a, b) => b.stats.minutes - a.stats.minutes)
    .slice(0, 5);
  const sum = (k: keyof RawPlayer["stats"]) =>
    teamPlayers.reduce((s, p) => s + (p.stats[k] ?? 0), 0);
  const avg = (k: keyof RawPlayer["stats"]) =>
    teamPlayers.length ? sum(k) / teamPlayers.length : 0;
  return {
    points:   sum("points"),
    rebounds: sum("rebounds"),
    assists:  sum("assists"),
    steals:   sum("steals"),
    blocks:   sum("blocks"),
    fgPct:    avg("fgPct"),
    threePct: avg("threePct"),
    ftPct:    avg("ftPct"),
  };
}

export function CompareClient({ standings, players }: Props) {
  const [mode, setMode] = useState<Mode>("team");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ─── 선택지 구성 ─────────────────────────────────
  const teamOptions = useMemo(
    () => standings.map((s) => ({ id: s.shortName, label: s.name, code: s.code })),
    [standings]
  );
  const playerOptions = useMemo(
    () =>
      players
        .filter((p) => p.team)
        .sort((a, b) => b.stats.points - a.stats.points)
        .map((p) => ({ id: `${p.name}__${p.team}`, label: `${p.name} (${p.team})`, ref: p })),
    [players]
  );

  const [teamA, setTeamA] = useState(teamOptions[0]?.id ?? "");
  const [teamB, setTeamB] = useState(teamOptions[2]?.id ?? teamOptions[1]?.id ?? "");
  const [playerA, setPlayerA] = useState(playerOptions[0]?.id ?? "");
  const [playerB, setPlayerB] = useState(playerOptions[1]?.id ?? "");

  // ─── 스탯 계산 ─────────────────────────────────────
  function playerToStats(p: RawPlayer): Stats {
    return {
      points:   p.stats.points,
      rebounds: p.stats.rebounds,
      assists:  p.stats.assists,
      steals:   p.stats.steals,
      blocks:   p.stats.blocks,
      fgPct:    p.stats.fgPct,
      threePct: p.stats.threePct,
      ftPct:    p.stats.ftPct,
    };
  }

  const aStats: Stats | null = useMemo(() => {
    if (mode === "team") {
      return teamA ? teamStatsFrom(players, teamA) : null;
    }
    const p = playerOptions.find((o) => o.id === playerA);
    return p ? playerToStats(p.ref) : null;
  }, [mode, teamA, playerA, players, playerOptions]);

  const bStats: Stats | null = useMemo(() => {
    if (mode === "team") {
      return teamB ? teamStatsFrom(players, teamB) : null;
    }
    const p = playerOptions.find((o) => o.id === playerB);
    return p ? playerToStats(p.ref) : null;
  }, [mode, teamB, playerB, players, playerOptions]);

  const aLabel =
    mode === "team"
      ? teamOptions.find((t) => t.id === teamA)?.label ?? "A"
      : playerOptions.find((p) => p.id === playerA)?.label ?? "A";
  const bLabel =
    mode === "team"
      ? teamOptions.find((t) => t.id === teamB)?.label ?? "B"
      : playerOptions.find((p) => p.id === playerB)?.label ?? "B";

  // ─── percentile 정규화 — 모집단(전체 선수/팀) 분포 대비 위치 ─────────
  const population: Stats[] = useMemo(() => {
    if (mode === "team") {
      return teamOptions.map((t) => teamStatsFrom(players, t.id));
    }
    return players.map(playerToStats);
  }, [mode, teamOptions, players]);

  const RADAR_KEYS = AXES.map((a) => a.key);

  const series: RadarSeries[] = useMemo(() => {
    const out: RadarSeries[] = [];
    if (aStats) {
      out.push({
        label: aLabel,
        color: COLOR_A,
        values: percentilesOf(aStats, population, RADAR_KEYS),
        rawLabels: AXES.map((a) => a.fmt(aStats[a.key] ?? 0)),
      });
    }
    if (bStats) {
      out.push({
        label: bLabel,
        color: COLOR_B,
        values: percentilesOf(bStats, population, RADAR_KEYS),
        rawLabels: AXES.map((a) => a.fmt(bStats[a.key] ?? 0)),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aStats, bStats, aLabel, bLabel, population]);

  return (
    <>
      {/* 모드 토글 */}
      <div className="mb-6 inline-flex rounded-md border border-court-700 bg-court-800/60 p-1">
        {(["team", "player"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "rounded px-4 py-1.5 text-[16px] font-medium transition",
              mode === m
                ? "bg-court-700 text-ink-50"
                : "text-ink-300 hover:text-ink-100",
            ].join(" ")}
          >
            {m === "team" ? "팀 비교" : "선수 비교"}
          </button>
        ))}
      </div>

      {/* 셀렉터 2개 */}
      <div className="mb-4 grid grid-cols-2 gap-4">
        <Selector
          color={COLOR_A}
          label="A"
          value={mode === "team" ? teamA : playerA}
          onChange={mode === "team" ? setTeamA : setPlayerA}
          options={mode === "team" ? teamOptions : playerOptions}
        />
        <Selector
          color={COLOR_B}
          label="B"
          value={mode === "team" ? teamB : playerB}
          onChange={mode === "team" ? setTeamB : setPlayerB}
          options={mode === "team" ? teamOptions : playerOptions}
        />
      </div>

      {/* 스탯 카드 2개 */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <StatSummaryCard
          label={aLabel}
          color={COLOR_A}
          stats={aStats}
          mode={mode}
        />
        <StatSummaryCard
          label={bLabel}
          color={COLOR_B}
          stats={bStats}
          mode={mode}
        />
      </div>

      {/* 8축 Spider 레이더 — 새 StatRadar 컴포넌트 (선수 프로필과 같은 톤) */}
      {mounted && series.length > 0 && (
        <StatRadar
          title={`${aLabel}  vs  ${bLabel}`}
          subtitle={`2025-26 시즌 · ${mode === "team" ? "팀" : "선수"} 비교 · 리그 분포 기준 percentile (바깥쪽 = 강함)`}
          axes={AXES.map((a) => a.label)}
          series={series}
          height={420}
        />
      )}

      {mode === "team" && (
        <p className="mt-3 text-[14px] text-ink-500">
          {HAS_REAL_TEAM_STATS
            ? "* Daum 기록 순위에서 추출한 팀 평균 실데이터."
            : "* 팀 스탯은 출장시간 상위 5인의 개인 스탯을 합산한 근사치. (npm run parse:team-stats 실행하면 실데이터로 교체)"}
        </p>
      )}
    </>
  );
}

// ─── 하위 컴포넌트 ──────────────────────────────────
function Selector({
  label,
  color,
  value,
  onChange,
  options,
}: {
  label: string;
  color: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <label className="card flex items-center gap-3 p-3">
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-[14px] uppercase tracking-wider text-ink-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-court-700 bg-court-900 px-2.5 py-1.5 text-[16px] text-ink-100 focus:border-flame-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatSummaryCard({
  label,
  color,
  stats,
  mode,
}: {
  label: string;
  color: string;
  stats: Stats | null;
  mode: Mode;
}) {
  if (!stats) return <div className="card p-4" />;
  return (
    <div className="relative overflow-hidden card p-4">
      <span
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: color }}
      />
      <div className="mb-3 text-base font-semibold text-ink-50">{label}</div>
      <div className="grid grid-cols-3 gap-3">
        {AXES.map((a) => (
          <div key={a.key}>
            <div className="text-[13px] uppercase tracking-wider text-ink-500">
              {a.label}
            </div>
            <div className="stat-num mt-1 text-[16px] font-semibold text-ink-50">
              {a.fmt(stats[a.key] ?? 0)}
            </div>
          </div>
        ))}
      </div>
      {mode === "team" && (
        <div className="mt-3 text-[13px] text-ink-500">
          주전 5인 합산 · FG%는 평균
        </div>
      )}
    </div>
  );
}
