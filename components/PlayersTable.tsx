"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { RawPlayer } from "@/lib/data";
import type { PlayerAdvancedStats } from "@/lib/types";
import {
  ageOf,
  fmtCountry,
  fmtDraft,
  fmtPos,
  getPlayerInfo,
  topSchool,
  type PlayerFlag,
} from "@/lib/playerInfo";

type StatMode = "traditional" | "advanced" | "registry";

type TradKey =
  | "points" | "assists" | "rebounds" | "steals" | "blocks"
  | "minutes" | "fgPct" | "threePct" | "ftPct";

type AdvKey = keyof PlayerAdvancedStats;

const TRAD_COLUMNS: {
  key: TradKey;
  label: string;
  fmt?: (v: number) => string;
}[] = [
  { key: "minutes",  label: "MIN", fmt: (v) => v.toFixed(1) },
  { key: "points",   label: "득점" },
  { key: "assists",  label: "어시" },
  { key: "rebounds", label: "리바" },
  { key: "steals",   label: "스틸" },
  { key: "blocks",   label: "블록" },
  { key: "fgPct",    label: "FG%",  fmt: (v) => v.toFixed(1) },
  { key: "threePct", label: "3P%",  fmt: (v) => v.toFixed(1) },
  { key: "ftPct",    label: "FT%",  fmt: (v) => v.toFixed(1) },
];

const ADV_COLUMNS: {
  key: AdvKey;
  label: string;
  fmt?: (v: number) => string;
  hint?: string;
}[] = [
  { key: "per",     label: "PER",  fmt: (v) => v.toFixed(1), hint: "Player Efficiency Rating" },
  { key: "tsPct",   label: "TS%",  fmt: (v) => v.toFixed(1), hint: "True Shooting %" },
  { key: "efgPct",  label: "eFG%", fmt: (v) => v.toFixed(1), hint: "Effective FG %" },
  { key: "usgPct",  label: "USG%", fmt: (v) => v.toFixed(1), hint: "Usage %" },
  { key: "offRtg",  label: "ORtg", fmt: (v) => v.toFixed(1), hint: "Offensive Rating" },
  { key: "defRtg",  label: "DRtg", fmt: (v) => v.toFixed(1), hint: "Defensive Rating" },
  { key: "netRtg",  label: "Net",  fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1) },
  { key: "astTo",   label: "AST/TO", fmt: (v) => v.toFixed(2) },
  { key: "tovPct",  label: "TOV%", fmt: (v) => v.toFixed(1) },
];

// 등록 모드 — 메타 컬럼들 (정렬 가능, sortVal numeric)
type RegistryRow = {
  player: RawPlayer;
  // 정렬용 numeric
  height: number;
  weight: number;
  birthSort: number;     // YYYYMMDD
  draftSort: number;     // year*1e6 + round*1000 + rank
  flagSort: number;      // 국내=0, 아시아쿼터=1, 외국=2
};

export function PlayersTable({
  players,
  statMode = "traditional",
}: {
  players: RawPlayer[];
  /** 외부에서 1차/2차/등록 토글 제어. 미지정 시 traditional */
  statMode?: StatMode;
}) {
  const [sortKey, setSortKey] = useState<string>("points");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [teamFilter, setTeamFilter] = useState<string>("");
  // 다중 선택 (칩) — 빈 Set 이면 "전체"
  const [flagFilter, setFlagFilter] = useState<Set<PlayerFlag>>(new Set());
  const [posFilter, setPosFilter] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  function toggleFlag(f: PlayerFlag) {
    setFlagFilter((cur) => {
      const next = new Set(cur);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }
  function togglePos(p: string) {
    setPosFilter((cur) => {
      const next = new Set(cur);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  const teams = useMemo(() => {
    const set = new Set<string>();
    for (const p of players) if (p.team) set.add(p.team);
    return Array.from(set).sort();
  }, [players]);

  // 통합 정보: RawPlayer + PlayerInfoEntry
  const enriched = useMemo(() => {
    return players.map((p) => {
      const info = p.playerNo ? getPlayerInfo(p.playerNo) : null;
      return { p, info };
    });
  }, [players]);

  // 필터 적용 (모드 무관 공통)
  const filtered = useMemo(() => {
    return enriched.filter(({ p, info }) => {
      if (teamFilter && p.team !== teamFilter) return false;
      // 다중 선택 — 빈 Set 이면 "전체", 아니면 OR 매칭
      if (flagFilter.size > 0 && (!info?.flag || !flagFilter.has(info.flag))) {
        return false;
      }
      if (posFilter.size > 0 && (!info?.pos || !posFilter.has(info.pos))) {
        return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const name = (p.name ?? "").toLowerCase();
        const ename = (info?.ename ?? "").toLowerCase();
        if (!name.includes(q) && !ename.includes(q)) return false;
      }
      return true;
    });
  }, [enriched, teamFilter, flagFilter, posFilter, search]);

  // 등록 모드 — 컬럼 정의 (sortKey 가 메타 컬럼일 때 사용)
  const REGISTRY_SORT_KEYS = new Set([
    "flag", "pos", "backNum", "height", "weight", "age", "school", "draft",
  ]);

  // 모드별 컬럼
  const statCols =
    statMode === "traditional"
      ? TRAD_COLUMNS
      : statMode === "advanced"
        ? ADV_COLUMNS
        : [];

  // sortKey 가 모드에 안 맞으면 기본값 보정
  const validSort = useMemo(() => {
    if (statMode === "registry") {
      return REGISTRY_SORT_KEYS.has(sortKey) ? sortKey : "height";
    }
    if (statMode === "traditional") {
      return statCols.some((c) => c.key === sortKey) ? sortKey : "points";
    }
    return statCols.some((c) => c.key === sortKey) ? sortKey : "per";
  }, [sortKey, statMode, statCols]);

  // 정렬
  const sorted = useMemo(() => {
    const getStatVal = (p: RawPlayer, key: string): number => {
      if (statMode === "traditional") {
        return (p.stats as Record<string, number>)[key] ?? 0;
      }
      return (p.advanced as unknown as Record<string, number>)?.[key] ?? 0;
    };
    const getRegistryVal = (
      p: RawPlayer,
      info: ReturnType<typeof getPlayerInfo>,
      key: string,
    ): number => {
      if (!info) return 0;
      switch (key) {
        case "height": return info.pHeight ?? 0;
        case "weight": return info.pWeight ?? 0;
        case "backNum": return Number(info.backNum) || 999;
        case "age":    return -(ageOf(info.birthday) ?? 0); // 어린 선수가 위로 (-)
        case "flag":   return info.flag === "국내" ? 0 : info.flag === "아시아쿼터" ? 1 : 2;
        case "pos":    return info.pos.charCodeAt(0);
        case "draft": {
          if (!info.draft) return 0;
          return (info.draft.year ?? 0) * 1e6 +
                 (info.draft.round ?? 0) * 1000 +
                 (info.draft.rank ?? 0);
        }
        case "school": return (topSchool(info.schools) ?? "").charCodeAt(0);
        default: return 0;
      }
    };
    return [...filtered].sort((a, b) => {
      let av: number, bv: number;
      if (statMode === "registry") {
        av = getRegistryVal(a.p, a.info, validSort);
        bv = getRegistryVal(b.p, b.info, validSort);
      } else {
        av = getStatVal(a.p, validSort);
        bv = getStatVal(b.p, validSort);
      }
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [filtered, validSort, sortDir, statMode]);

  function handleSort(key: string) {
    if (validSort === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (!players.length) {
    return (
      <div className="card p-8 text-center">
        <h3 className="text-sm font-semibold text-ink-50">선수 데이터 없음</h3>
        <p className="mt-2 text-[13px] text-ink-300">
          아직 <code className="rounded bg-court-700/60 px-1 py-0.5 font-mono text-[12px]">data/players.json</code>이 비어있어요.
          PowerShell에서 <code className="rounded bg-court-700/60 px-1 py-0.5 font-mono text-[12px]">npm run parse:players</code>를 먼저 실행해주세요.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 필터 바 */}
      <div className="mb-4 space-y-2">
        {/* 팀 + 검색 (가로) */}
        <div className="flex flex-wrap items-center gap-3">
          <FilterSelect
            label="팀"
            value={teamFilter}
            onChange={setTeamFilter}
            options={teams.map((t) => ({ value: t, label: t }))}
          />
          <div className="flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-wider text-ink-500">검색</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 (한글/영문)"
              className="w-44 rounded-md border border-court-700 bg-court-800 px-2.5 py-1.5 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-flame-500 focus:outline-none"
            />
          </div>
          <div className="ml-auto text-[11px] text-ink-500">
            <span className="stat-num text-ink-300">{sorted.length}</span>명 표시 중
          </div>
        </div>

        {/* 선수구분 — 다중 선택 칩 (국내+아시아쿼터 같이 보기 가능) */}
        <ChipFilterRow
          label="선수구분"
          options={[
            { value: "국내", label: "국내", tone: "neon" },
            { value: "아시아쿼터", label: "아시아쿼터", tone: "hoop" },
            { value: "외국선수", label: "외국선수", tone: "buzzer" },
          ]}
          selected={flagFilter as Set<string>}
          onToggle={(v) => toggleFlag(v as PlayerFlag)}
          onClear={() => setFlagFilter(new Set())}
        />

        {/* 포지션 — 다중 선택 칩 */}
        <ChipFilterRow
          label="포지션"
          options={[
            { value: "GD", label: "가드", tone: "flame" },
            { value: "FD", label: "포워드", tone: "flame" },
            { value: "C",  label: "센터", tone: "flame" },
          ]}
          selected={posFilter}
          onToggle={togglePos}
          onClear={() => setPosFilter(new Set())}
        />
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-lg border border-court-700/70">
        {statMode === "registry" ? (
          <RegistryTable
            rows={sorted}
            sortKey={validSort}
            sortDir={sortDir}
            onSort={handleSort}
          />
        ) : (
          <StatTable
            rows={sorted}
            cols={statCols}
            statMode={statMode}
            sortKey={validSort}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
      </div>
    </>
  );
}

type ChipTone = "flame" | "neon" | "hoop" | "buzzer";

function ChipFilterRow({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: { value: string; label: string; tone: ChipTone }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const toneClass = (tone: ChipTone, active: boolean) => {
    if (!active) {
      return "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100";
    }
    switch (tone) {
      case "neon":   return "bg-neon-500/20 text-neon-400 ring-1 ring-neon-500/40";
      case "hoop":   return "bg-hoop-500/20 text-hoop-400 ring-1 ring-hoop-500/40";
      case "buzzer": return "bg-buzzer-500/20 text-buzzer-400 ring-1 ring-buzzer-500/40";
      default:       return "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-ink-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={onClear}
          className={[
            "rounded-md px-3 py-1.5 text-[12px] font-medium transition",
            selected.size === 0
              ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
              : "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100",
          ].join(" ")}
        >
          전체
        </button>
        {options.map((o) => {
          const active = selected.has(o.value);
          return (
            <button
              key={o.value}
              onClick={() => onToggle(o.value)}
              className={[
                "rounded-md px-3 py-1.5 text-[12px] font-medium transition",
                toneClass(o.tone, active),
              ].join(" ")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] uppercase tracking-wider text-ink-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-court-700 bg-court-800 px-2.5 py-1.5 text-[13px] text-ink-100 focus:border-flame-500 focus:outline-none"
      >
        <option value="">전체</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── 스탯 테이블 (1차/2차) ─────────────────────────

function StatTable({
  rows,
  cols,
  statMode,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: { p: RawPlayer; info: ReturnType<typeof getPlayerInfo> }[];
  cols: { key: string; label: string; fmt?: (v: number) => string; hint?: string }[];
  statMode: "traditional" | "advanced";
  sortKey: string;
  sortDir: "desc" | "asc";
  onSort: (k: string) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-court-900/80 text-[11px] uppercase tracking-[0.1em] text-ink-500">
          <th className="py-2.5 pl-3 text-left font-medium">#</th>
          <th className="py-2.5 text-left font-medium">선수</th>
          <th className="py-2.5 text-left font-medium">팀</th>
          {cols.map((c) => (
            <th
              key={c.key}
              onClick={() => onSort(c.key)}
              title={c.hint}
              className={[
                "cursor-pointer select-none py-2.5 pr-3 text-right font-medium transition hover:text-ink-100",
                sortKey === c.key ? "text-ink-100" : "",
              ].join(" ")}
            >
              <span className="inline-flex items-center gap-1">
                {c.label}
                {sortKey === c.key && (
                  <span className="text-[9px] text-flame-400">
                    {sortDir === "desc" ? "▼" : "▲"}
                  </span>
                )}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divider-y">
        {rows.map(({ p, info }, i) => (
          <tr
            key={`${p.name}-${p.team}-${i}`}
            className="group transition hover:bg-court-700/30"
          >
            <td className="stat-num py-2 pl-3 text-[12px] text-ink-500">{i + 1}</td>
            <td className="py-2 text-[13px] font-medium text-ink-50">
              <div className="flex items-center gap-1.5">
                {p.playerNo ? (
                  <Link
                    href={`/players/${p.playerNo}`}
                    className="transition hover:text-flame-400"
                  >
                    {p.name}
                  </Link>
                ) : (
                  p.name
                )}
                {info?.flag === "외국선수" && (
                  <span className="text-[9px] text-buzzer-400" title="외국선수">●</span>
                )}
                {info?.flag === "아시아쿼터" && (
                  <span className="text-[9px] text-hoop-400" title="아시아쿼터">●</span>
                )}
              </div>
            </td>
            <td className="py-2">
              <span className="chip">{p.team || "-"}</span>
            </td>
            {cols.map((c) => {
              const v =
                statMode === "traditional"
                  ? (p.stats as Record<string, number>)[c.key] ?? 0
                  : (p.advanced as unknown as Record<string, number>)?.[c.key] ?? null;
              const isSorted = sortKey === c.key;
              if (v === null) {
                return (
                  <td key={c.key} className="stat-num py-2 pr-3 text-right text-ink-500">
                    —
                  </td>
                );
              }
              return (
                <td
                  key={c.key}
                  className={[
                    "stat-num py-2 pr-3 text-right",
                    isSorted ? "font-medium text-ink-50" : "text-ink-300",
                  ].join(" ")}
                >
                  {c.fmt ? c.fmt(v) : v.toFixed(1)}
                </td>
              );
            })}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={3 + cols.length} className="py-8 text-center text-[13px] text-ink-500">
              조건에 맞는 선수가 없어요.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ─── 등록 모드 테이블 (메타정보) ─────────────────────

function RegistryTable({
  rows,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: { p: RawPlayer; info: ReturnType<typeof getPlayerInfo> }[];
  sortKey: string;
  sortDir: "desc" | "asc";
  onSort: (k: string) => void;
}) {
  const cols: { key: string; label: string }[] = [
    { key: "flag",    label: "구분" },
    { key: "pos",     label: "포지션" },
    { key: "backNum", label: "번호" },
    { key: "height",  label: "신장" },
    { key: "weight",  label: "체중" },
    { key: "age",     label: "나이" },
    { key: "school",  label: "학교" },
    { key: "draft",   label: "드래프트" },
  ];

  const flagToneFor = (f?: PlayerFlag) =>
    f === "외국선수"
      ? "border-buzzer-500/30 bg-buzzer-500/10 text-buzzer-400"
      : f === "아시아쿼터"
        ? "border-hoop-500/30 bg-hoop-500/10 text-hoop-400"
        : "border-neon-500/30 bg-neon-500/10 text-neon-400";

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-court-900/80 text-[11px] uppercase tracking-[0.1em] text-ink-500">
          <th className="py-2.5 pl-3 text-left font-medium">#</th>
          <th className="py-2.5 text-left font-medium">선수</th>
          <th className="py-2.5 text-left font-medium">팀</th>
          {cols.map((c) => {
            const isSorted = sortKey === c.key;
            return (
              <th
                key={c.key}
                onClick={() => onSort(c.key)}
                className={[
                  "cursor-pointer select-none py-2.5 pr-3 text-left font-medium transition hover:text-ink-100",
                  isSorted ? "text-ink-100" : "",
                ].join(" ")}
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {isSorted && (
                    <span className="text-[9px] text-flame-400">
                      {sortDir === "desc" ? "▼" : "▲"}
                    </span>
                  )}
                </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="divider-y">
        {rows.map(({ p, info }, i) => (
          <tr
            key={`${p.name}-${p.team}-${i}`}
            className="group transition hover:bg-court-700/30"
          >
            <td className="stat-num py-2 pl-3 text-[12px] text-ink-500">{i + 1}</td>
            <td className="py-2 text-[13px] font-medium text-ink-50">
              {p.playerNo ? (
                <Link
                  href={`/players/${p.playerNo}`}
                  className="transition hover:text-flame-400"
                >
                  {p.name}
                </Link>
              ) : (
                p.name
              )}
              {info?.ename && (
                <span className="ml-1.5 text-[10px] text-ink-500">
                  {info.ename}
                </span>
              )}
            </td>
            <td className="py-2">
              <span className="chip">{p.team || "-"}</span>
            </td>
            {/* 구분 */}
            <td className="py-2">
              {info ? (
                <span className={`chip ${flagToneFor(info.flag)}`}>
                  {info.flag}
                </span>
              ) : (
                <span className="text-ink-500">—</span>
              )}
            </td>
            {/* 포지션 */}
            <td className="py-2 text-[12px] text-ink-300">
              {info?.pos ? fmtPos(info.pos) : "—"}
            </td>
            {/* 등번호 */}
            <td className="stat-num py-2 text-[12px] text-ink-300">
              {info?.backNum ?? "—"}
            </td>
            {/* 신장 */}
            <td className="stat-num py-2 text-[12px] text-ink-100">
              {info?.pHeight ? `${info.pHeight}cm` : "—"}
            </td>
            {/* 체중 */}
            <td className="stat-num py-2 text-[12px] text-ink-300">
              {info?.pWeight ? `${info.pWeight}kg` : "—"}
            </td>
            {/* 나이 */}
            <td className="stat-num py-2 text-[12px] text-ink-300">
              {info?.birthday && ageOf(info.birthday) != null
                ? `만 ${ageOf(info.birthday)}세`
                : "—"}
            </td>
            {/* 학교 */}
            <td className="py-2 text-[12px] text-ink-300">
              {info ? topSchool(info.schools) ?? "—" : "—"}
            </td>
            {/* 드래프트 */}
            <td className="py-2 text-[12px] text-ink-300">
              {info ? fmtDraft(info.draft) ?? "—" : "—"}
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={3 + cols.length} className="py-8 text-center text-[13px] text-ink-500">
              조건에 맞는 선수가 없어요.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
