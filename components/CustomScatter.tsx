"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TEAM_COLORS, type RawPlayer } from "@/lib/data";

// 선택 가능한 스탯 목록 (1차 스탯)
type StatKey =
  | "points" | "rebounds" | "assists" | "steals" | "blocks"
  | "oReb" | "dReb"
  | "twoPM" | "twoPA" | "threeMade" | "threePA"
  | "fgPct" | "threePct" | "ftPct"
  | "turnovers" | "ftMade";

const STAT_OPTIONS: { key: StatKey; label: string; unit: string; isPct?: boolean }[] = [
  { key: "points",    label: "득점",       unit: "PPG" },
  { key: "rebounds",  label: "리바운드",   unit: "RPG" },
  { key: "assists",   label: "어시스트",   unit: "APG" },
  { key: "steals",    label: "스틸",       unit: "SPG" },
  { key: "blocks",    label: "블록",       unit: "BPG" },
  { key: "oReb",      label: "공격 리바",  unit: "OREB" },
  { key: "dReb",      label: "수비 리바",  unit: "DREB" },
  { key: "twoPM",     label: "2점 성공",   unit: "2PM" },
  { key: "twoPA",     label: "2점 시도",   unit: "2PA" },
  { key: "threeMade", label: "3점 성공",   unit: "3PM" },
  { key: "threePA",   label: "3점 시도",   unit: "3PA" },
  { key: "ftMade",    label: "자유투 성공", unit: "FTM" },
  { key: "fgPct",     label: "야투 성공률", unit: "%", isPct: true },
  { key: "threePct",  label: "3점 성공률", unit: "%", isPct: true },
  { key: "ftPct",     label: "자유투 성공률", unit: "%", isPct: true },
  { key: "turnovers", label: "턴오버",     unit: "TO" },
];

const PRESETS: { name: string; x: StatKey; y: StatKey; z: StatKey }[] = [
  { name: "득점 × 리바운드", x: "points",    y: "rebounds",  z: "assists" },
  { name: "슛 성향",          x: "threePA",   y: "twoPA",     z: "points" },
  { name: "3점 효율",         x: "threePA",   y: "threePct",  z: "threeMade" },
  { name: "공·수 리바",       x: "oReb",      y: "dReb",      z: "points" },
];

interface Datum {
  name: string;
  team: string;
  x: number;
  y: number;
  z: number;
}

export function CustomScatter({ players }: { players: RawPlayer[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [xKey, setXKey] = useState<StatKey>("points");
  const [yKey, setYKey] = useState<StatKey>("rebounds");
  const [zKey, setZKey] = useState<StatKey>("assists");

  const xMeta = STAT_OPTIONS.find((s) => s.key === xKey)!;
  const yMeta = STAT_OPTIONS.find((s) => s.key === yKey)!;
  const zMeta = STAT_OPTIONS.find((s) => s.key === zKey)!;

  const byTeam = useMemo(() => {
    const map = new Map<string, Datum[]>();
    for (const p of players) {
      if (!p.team) continue;
      // 출장 경기 너무 적은 선수 제외 (노이즈 방지)
      // games 기반 — 쿼터/시간대 데이터에서도 안전 (시즌 평균 분과 비교 X)
      if ((p.games ?? 0) < 5) continue;
      const x = (p.stats[xKey] as number) ?? 0;
      const y = (p.stats[yKey] as number) ?? 0;
      const z = (p.stats[zKey] as number) ?? 0;
      // 전부 0이면 skip (의미 없는 점)
      if (x === 0 && y === 0) continue;
      if (!map.has(p.team)) map.set(p.team, []);
      map.get(p.team)!.push({ name: p.name, team: p.team, x, y, z });
    }
    return map;
  }, [players, xKey, yKey, zKey]);

  const totalPlayers = [...byTeam.values()].reduce((s, a) => s + a.length, 0);

  function applyPreset(p: (typeof PRESETS)[number]) {
    setXKey(p.x);
    setYKey(p.y);
    setZKey(p.z);
  }

  const isActivePreset = (p: (typeof PRESETS)[number]) =>
    p.x === xKey && p.y === yKey && p.z === zKey;

  const fmt = (v: number, meta: (typeof STAT_OPTIONS)[number]) =>
    meta.isPct ? `${v.toFixed(1)}%` : v.toFixed(1);

  if (!players.length) return null;
  if (!mounted) return <div className="card" style={{ height: 560 }} />;

  return (
    <div className="card p-5">
      {/* 헤더 */}
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">선수 스탯 탐색기</h3>
          <p className="mt-0.5 text-[14px] text-ink-500">
            X·Y·점 크기를 각각 다른 스탯으로 조합해서 선수 분포 탐색. 출장 5경기 이상만.
          </p>
        </div>
        <div className="text-[14px] text-ink-500">
          <span className="stat-num text-ink-300">{totalPlayers}</span>명
        </div>
      </div>

      {/* 프리셋 버튼 */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = isActivePreset(p);
          return (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className={[
                "chip transition",
                active
                  ? "border-flame-500/50 bg-flame-500/15 text-flame-400"
                  : "hover:border-court-600 hover:text-ink-100",
              ].join(" ")}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* 축 선택 드롭다운 3개 */}
      <div className="mb-4 grid grid-cols-1 gap-2 rounded-lg border border-court-700/60 bg-court-900/40 p-2.5 sm:grid-cols-3">
        <StatSelector label="X축" value={xKey} onChange={setXKey} />
        <StatSelector label="Y축" value={yKey} onChange={setYKey} />
        <StatSelector label="점 크기" value={zKey} onChange={setZKey} />
      </div>

      {/* 산점도 */}
      <div style={{ width: "100%", height: 400 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 10, right: 24, bottom: 20, left: 4 }}>
            <CartesianGrid stroke="#262a33" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, (max: number) => Math.ceil(max + 1)]}
              allowDecimals={xMeta.isPct}
              tickFormatter={(v) => (xMeta.isPct ? v.toFixed(0) : Math.round(v).toString())}
              stroke="#71717a"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              label={{
                value: `${xMeta.label} (${xMeta.unit})`,
                position: "insideBottom",
                offset: -8,
                fill: "#71717a",
                fontSize: 11,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, (max: number) => Math.ceil(max + 1)]}
              allowDecimals={yMeta.isPct}
              tickFormatter={(v) => (yMeta.isPct ? v.toFixed(0) : Math.round(v).toString())}
              stroke="#71717a"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              label={{
                value: `${yMeta.label} (${yMeta.unit})`,
                angle: -90,
                position: "insideLeft",
                fill: "#71717a",
                fontSize: 11,
              }}
            />
            <ZAxis type="number" dataKey="z" range={[30, 280]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "#f59e0b" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as Datum;
                return (
                  <div
                    style={{
                      background: "#131519",
                      border: "1px solid #262a33",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#fafafa" }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: "#a1a1aa", marginTop: 2 }}>{d.team}</div>
                    <div style={{ fontSize: 11, color: "#ececec", marginTop: 6, lineHeight: 1.6 }}>
                      {xMeta.label} <span style={{ fontWeight: 500 }}>{fmt(d.x, xMeta)}</span>
                      <br />
                      {yMeta.label} <span style={{ fontWeight: 500 }}>{fmt(d.y, yMeta)}</span>
                      <br />
                      <span style={{ color: "#a1a1aa" }}>
                        {zMeta.label} <span style={{ fontWeight: 500, color: "#ececec" }}>{fmt(d.z, zMeta)}</span>
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#a1a1aa", paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            {[...byTeam.entries()].map(([team, items]) => (
              <Scatter
                key={team}
                name={team}
                data={items}
                fill={TEAM_COLORS[team] ?? "#94a3b8"}
                fillOpacity={0.85}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function StatSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StatKey;
  onChange: (v: StatKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="shrink-0 text-[13px] font-medium uppercase tracking-wider text-ink-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StatKey)}
        className="flex-1 rounded-md border border-court-700 bg-court-800 px-2 py-1 text-[15px] text-ink-100 focus:border-flame-500 focus:outline-none"
      >
        {STAT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
