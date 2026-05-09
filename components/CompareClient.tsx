"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { HAS_REAL_TEAM_STATS, TEAM_STATS } from "@/lib/data";
import type { RawPlayer } from "@/lib/data";
import type { TeamStanding } from "@/lib/types";

type Mode = "team" | "player";

interface Props {
  standings: TeamStanding[];
  players: RawPlayer[];
}

const AXES: { key: keyof Stats; label: string; fmt: (v: number) => string }[] = [
  { key: "points",   label: "득점",   fmt: (v) => v.toFixed(1) },
  { key: "rebounds", label: "리바",   fmt: (v) => v.toFixed(1) },
  { key: "assists",  label: "어시",   fmt: (v) => v.toFixed(1) },
  { key: "steals",   label: "스틸",   fmt: (v) => v.toFixed(1) },
  { key: "blocks",   label: "블록",   fmt: (v) => v.toFixed(1) },
  { key: "fgPct",    label: "FG%",    fmt: (v) => v.toFixed(1) },
];

type Stats = {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fgPct: number;
};

const COLOR_A = "#f59e0b"; // flame
const COLOR_B = "#38bdf8"; // neon

// ─── 팀 스탯 조회 ───────────────────────────────────────
// 실데이터(TEAM_STATS)가 있으면 사용, 없으면 선수 주전 5인 합산으로 근사.
function teamStatsFrom(players: RawPlayer[], teamShort: string): Stats {
  const real = TEAM_STATS[teamShort];
  if (real) {
    return {
      points: real.points,
      rebounds: real.rebounds,
      assists: real.assists,
      steals: real.steals,
      blocks: real.blocks,
      fgPct: real.fgPct,
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
    points: sum("points"),
    rebounds: sum("rebounds"),
    assists: sum("assists"),
    steals: sum("steals"),
    blocks: sum("blocks"),
    fgPct: avg("fgPct"),
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
  const aStats: Stats | null = useMemo(() => {
    if (mode === "team") {
      return teamA ? teamStatsFrom(players, teamA) : null;
    }
    const p = playerOptions.find((o) => o.id === playerA);
    return p ? (p.ref.stats as Stats) : null;
  }, [mode, teamA, playerA, players, playerOptions]);

  const bStats: Stats | null = useMemo(() => {
    if (mode === "team") {
      return teamB ? teamStatsFrom(players, teamB) : null;
    }
    const p = playerOptions.find((o) => o.id === playerB);
    return p ? (p.ref.stats as Stats) : null;
  }, [mode, teamB, playerB, players, playerOptions]);

  const aLabel =
    mode === "team"
      ? teamOptions.find((t) => t.id === teamA)?.label ?? "A"
      : playerOptions.find((p) => p.id === playerA)?.label ?? "A";
  const bLabel =
    mode === "team"
      ? teamOptions.find((t) => t.id === teamB)?.label ?? "B"
      : playerOptions.find((p) => p.id === playerB)?.label ?? "B";

  // ─── 정규화 (각 축의 리그 최댓값 대비 %) ─────────────
  const maxByAxis: Stats = useMemo(() => {
    if (mode === "team") {
      const allTeams = teamOptions.map((t) => teamStatsFrom(players, t.id));
      return AXES.reduce((acc, a) => {
        (acc as any)[a.key] = Math.max(...allTeams.map((s) => s[a.key]), 1);
        return acc;
      }, {} as Stats);
    } else {
      return AXES.reduce((acc, a) => {
        (acc as any)[a.key] = Math.max(...players.map((p) => p.stats[a.key] ?? 0), 1);
        return acc;
      }, {} as Stats);
    }
  }, [mode, teamOptions, players]);

  const radarData = useMemo(
    () =>
      AXES.map((a) => ({
        axis: a.label,
        A: aStats ? Math.round(((aStats[a.key] ?? 0) / maxByAxis[a.key]) * 100) : 0,
        B: bStats ? Math.round(((bStats[a.key] ?? 0) / maxByAxis[a.key]) * 100) : 0,
        rawA: aStats ? aStats[a.key] ?? 0 : 0,
        rawB: bStats ? bStats[a.key] ?? 0 : 0,
      })),
    [aStats, bStats, maxByAxis]
  );

  return (
    <>
      {/* 모드 토글 */}
      <div className="mb-6 inline-flex rounded-md border border-court-700 bg-court-800/60 p-1">
        {(["team", "player"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={[
              "rounded px-4 py-1.5 text-[15px] font-medium transition",
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

      {/* 레이더 */}
      <div className="card p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-ink-50">레이더 비교</h3>
          <p className="mt-0.5 text-[13px] text-ink-500">
            각 축은 리그 최댓값 대비 비율 (%) · 바깥쪽일수록 강함
          </p>
        </div>
        <div style={{ width: "100%", height: 420 }}>
          {mounted && (
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#262a33" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: "#ececec", fontSize: 12 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  angle={30}
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  stroke="#262a33"
                />
                <Radar
                  name={aLabel}
                  dataKey="A"
                  stroke={COLOR_A}
                  strokeWidth={2}
                  fill={COLOR_A}
                  fillOpacity={0.25}
                />
                <Radar
                  name={bLabel}
                  dataKey="B"
                  stroke={COLOR_B}
                  strokeWidth={2}
                  fill={COLOR_B}
                  fillOpacity={0.25}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div
                        style={{
                          background: "#131519",
                          border: "1px solid #262a33",
                          borderRadius: 8,
                          padding: "8px 12px",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#fafafa" }}>
                          {label}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12 }}>
                          <div style={{ color: COLOR_A }}>A · {d.rawA.toFixed(1)}</div>
                          <div style={{ color: COLOR_B }}>B · {d.rawB.toFixed(1)}</div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 12, color: "#a1a1aa" }}
                  iconType="circle"
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {mode === "team" && (
        <p className="mt-3 text-[13px] text-ink-500">
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
      <span className="text-[13px] uppercase tracking-wider text-ink-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-court-700 bg-court-900 px-2.5 py-1.5 text-[15px] text-ink-100 focus:border-flame-500 focus:outline-none"
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
            <div className="text-[12px] uppercase tracking-wider text-ink-500">
              {a.label}
            </div>
            <div className="stat-num mt-1 text-[15px] font-semibold text-ink-50">
              {a.fmt(stats[a.key] ?? 0)}
            </div>
          </div>
        ))}
      </div>
      {mode === "team" && (
        <div className="mt-3 text-[12px] text-ink-500">
          주전 5인 합산 · FG%는 평균
        </div>
      )}
    </div>
  );
}
