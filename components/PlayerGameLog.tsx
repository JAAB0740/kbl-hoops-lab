"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import {
  fmtMinSec,
  totalSeconds,
  type BoxRecords,
  type PlayerGameLogEntry,
} from "@/lib/boxscores";
import { fmtDate, gameToId } from "@/lib/gamesUtil";

type Mode = "basic" | "advanced" | "hustle";

interface ColumnDef {
  key: string;
  label: string;
  render: (r: BoxRecords) => React.ReactNode;
  /** 정렬에 쓸 numeric 값 */
  sortVal: (r: BoxRecords) => number;
  align?: "left" | "right";
  title?: string;
}

const BASIC_COLS: ColumnDef[] = [
  { key: "min", label: "MIN", render: (r) => fmtMinSec(r), sortVal: (r) => totalSeconds(r), align: "right" },
  { key: "pts", label: "PTS", render: (r) => r.score, sortVal: (r) => r.score, align: "right" },
  { key: "reb", label: "REB", render: (r) => r.rb, sortVal: (r) => r.rb, align: "right" },
  { key: "ast", label: "AST", render: (r) => r.ast, sortVal: (r) => r.ast, align: "right" },
  { key: "stl", label: "STL", render: (r) => r.stl, sortVal: (r) => r.stl, align: "right" },
  { key: "blk", label: "BLK", render: (r) => r.bs, sortVal: (r) => r.bs, align: "right" },
  { key: "to",  label: "TO",  render: (r) => r.to, sortVal: (r) => r.to, align: "right" },
  { key: "fg",  label: "FG",  render: (r) => makePct(r.fgt, r.fgtA), sortVal: (r) => r.fgt, align: "right" },
  { key: "3p",  label: "3P",  render: (r) => makePct(r.threep, r.threepA), sortVal: (r) => r.threep, align: "right" },
  { key: "ft",  label: "FT",  render: (r) => makePct(r.ft, r.ftA), sortVal: (r) => r.ft, align: "right" },
  { key: "f",   label: "F",   render: (r) => r.foul, sortVal: (r) => r.foul, align: "right" },
];

/** "5-19 26%" 형태 — made-att 옆에 작은 % */
function makePct(made: number, att: number): React.ReactNode {
  if (att === 0) {
    return <span className="text-ink-500">0-0</span>;
  }
  const pct = Math.round((made / att) * 100);
  return (
    <>
      {made}-{att}
      <span className="ml-1 text-[9px] text-ink-500">{pct}%</span>
    </>
  );
}

const ADVANCED_COLS: ColumnDef[] = [
  { key: "min",    label: "MIN",  render: (r) => fmtMinSec(r), sortVal: (r) => totalSeconds(r), align: "right" },
  { key: "pts",    label: "PTS",  render: (r) => r.score, sortVal: (r) => r.score, align: "right" },
  { key: "ortg",   label: "ORtg", render: (r) => fmt1(r.offrtg), sortVal: (r) => r.offrtg ?? 0, align: "right" },
  { key: "drtg",   label: "DRtg", render: (r) => fmt1(r.defrtg), sortVal: (r) => r.defrtg ?? 999, align: "right" },
  { key: "net",    label: "Net",  render: (r) => fmtSigned(r.netrtg), sortVal: (r) => r.netrtg ?? 0, align: "right" },
  { key: "efg",    label: "eFG%", render: (r) => fmtPct(r.efgRt), sortVal: (r) => r.efgRt ?? 0, align: "right" },
  { key: "ts",     label: "TS%",  render: (r) => fmtPct(r.tsRt), sortVal: (r) => r.tsRt ?? 0, align: "right" },
  { key: "usg",    label: "USG%", render: (r) => fmtPct(r.usgRt), sortVal: (r) => r.usgRt ?? 0, align: "right" },
  { key: "ast%",   label: "AST%", render: (r) => fmtPct(r.astRt), sortVal: (r) => r.astRt ?? 0, align: "right" },
  { key: "tov%",   label: "TOV%", render: (r) => fmtPct(r.tovRt), sortVal: (r) => r.tovRt ?? 999, align: "right" },
  { key: "per",    label: "PER",  render: (r) => fmt1(r.per), sortVal: (r) => r.per ?? 0, align: "right" },
  { key: "pie",    label: "PIE",  render: (r) => fmt1(r.pie), sortVal: (r) => r.pie ?? 0, align: "right" },
  { key: "+/-",    label: "+/-",  title: "출장 동안 점수차", render: (r) => fmtSigned(r.marginCn), sortVal: (r) => sentinelGuard(r.marginCn), align: "right" },
];

/** KBL sentinel(999 등) 을 0 으로 치환 — 정렬 시 outlier 방지 */
function sentinelGuard(v: number | undefined): number {
  if (v == null || isNaN(v)) return 0;
  if (Math.abs(v) >= 500) return 0;
  return v;
}

const HUSTLE_COLS: ColumnDef[] = [
  { key: "min",  label: "MIN",  render: (r) => fmtMinSec(r), sortVal: (r) => totalSeconds(r), align: "right" },
  { key: "pts",  label: "PTS",  render: (r) => r.score, sortVal: (r) => r.score, align: "right" },
  { key: "sast", label: "스크린어시", title: "스크린 어시스트", render: (r) => r.sast ?? 0, sortVal: (r) => r.sast ?? 0, align: "right" },
  { key: "dfl",  label: "디플렉션", render: (r) => r.dfl ?? 0, sortVal: (r) => r.dfl ?? 0, align: "right" },
  { key: "pp",   label: "페인트", render: (r) => `${r.pp}-${r.ppA}`, sortVal: (r) => r.pp ?? 0, align: "right" },
  { key: "fb",   label: "속공",  render: (r) => r.fb ?? 0, sortVal: (r) => r.fb ?? 0, align: "right" },
  { key: "dk",   label: "덩크",  render: (r) => `${r.dk}-${r.dkA}`, sortVal: (r) => r.dk ?? 0, align: "right" },
  { key: "off",  label: "OREB", render: (r) => r.offr, sortVal: (r) => r.offr ?? 0, align: "right" },
  { key: "stl",  label: "STL",  render: (r) => r.stl, sortVal: (r) => r.stl ?? 0, align: "right" },
  { key: "blk",  label: "BLK",  render: (r) => r.bs, sortVal: (r) => r.bs ?? 0, align: "right" },
];

function fmt1(v: number | undefined) {
  if (v == null || isNaN(v)) return "—";
  return v.toFixed(1);
}
function fmtPct(v: number | undefined) {
  if (v == null || isNaN(v)) return "—";
  return `${v.toFixed(1)}%`;
}
function fmtSigned(v: number | undefined) {
  if (v == null || isNaN(v)) return "—";
  // KBL API sentinel (예: marginCn = 999 → 데이터 없음)
  if (Math.abs(v) >= 500) return "—";
  if (v === 0) return "0";
  return `${v > 0 ? "+" : ""}${v.toFixed(1).replace(/\.0$/, "")}`;
}

const COL_SETS: Record<Mode, ColumnDef[]> = {
  basic: BASIC_COLS,
  advanced: ADVANCED_COLS,
  hustle: HUSTLE_COLS,
};

const MODE_LABELS: Record<Mode, string> = {
  basic: "1차",
  advanced: "2차",
  hustle: "허슬·슛분포",
};

const TAG_FILTERS: { key: string; label: string }[] = [
  { key: "all",   label: "전체" },
  { key: "정규리그", label: "정규" },
  { key: "PO",    label: "PO" },        // 6강+4강+챔결
];

/**
 * 한 선수의 게임 로그 — 박스스코어 데이터 기반.
 * 시간순(최신 위), 모드 토글 (1차/2차/허슬), 태그 필터.
 */
type SortDir = "asc" | "desc";
type SortKey =
  | { kind: "stat"; key: string }
  | { kind: "meta"; key: "date" | "opp" | "result" | "starter" };

export function PlayerGameLog({
  log,
  playerName,
}: {
  log: PlayerGameLogEntry[];
  playerName: string;
}) {
  const [mode, setMode] = useState<Mode>("basic");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sort, setSort] = useState<{ k: SortKey; dir: SortDir } | null>(null);

  const filtered = useMemo(() => {
    if (tagFilter === "all") return log;
    if (tagFilter === "PO") return log.filter((g) => g.tag !== "정규리그" && g.tag !== "EASL" && !g.tag.includes("올스타"));
    return log.filter((g) => g.tag === tagFilter);
  }, [log, tagFilter]);

  const cols = COL_SETS[mode];

  // 정렬 적용 (없으면 기본: 날짜 desc — 최신 위)
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    const { k, dir } = sort;
    if (k.kind === "meta") {
      arr.sort((a, b) => {
        let va = 0, vb = 0;
        if (k.key === "date") {
          const cmp = (a.date + a.time).localeCompare(b.date + b.time);
          return dir === "desc" ? -cmp : cmp;
        }
        if (k.key === "opp") {
          const cmp = a.opponent.localeCompare(b.opponent);
          return dir === "desc" ? -cmp : cmp;
        }
        if (k.key === "result") {
          // W=1, L=0, 같으면 마진 (점수차) 으로
          va = (a.result === "W" ? 1 : 0) * 1000 + (a.myScore - a.oppScore);
          vb = (b.result === "W" ? 1 : 0) * 1000 + (b.myScore - b.oppScore);
        } else if (k.key === "starter") {
          va = a.startFlag;
          vb = b.startFlag;
        }
        return dir === "desc" ? vb - va : va - vb;
      });
    } else {
      const colDef = cols.find((c) => c.key === k.key);
      if (colDef) {
        arr.sort((a, b) => {
          const va = colDef.sortVal(a.records);
          const vb = colDef.sortVal(b.records);
          return dir === "desc" ? vb - va : va - vb;
        });
      }
    }
    return arr;
  }, [filtered, sort, cols]);

  function toggleStatSort(key: string) {
    setSort((cur) => {
      if (!cur || cur.k.kind !== "stat" || cur.k.key !== key) return { k: { kind: "stat", key }, dir: "desc" };
      if (cur.dir === "desc") return { k: { kind: "stat", key }, dir: "asc" };
      return null;
    });
  }
  function toggleMetaSort(key: "date" | "opp" | "result" | "starter") {
    setSort((cur) => {
      if (!cur || cur.k.kind !== "meta" || cur.k.key !== key) return { k: { kind: "meta", key }, dir: "desc" };
      if (cur.dir === "desc") return { k: { kind: "meta", key }, dir: "asc" };
      return null;
    });
  }

  function isSortedStat(key: string) {
    return sort?.k.kind === "stat" && sort.k.key === key;
  }
  function isSortedMeta(key: "date" | "opp" | "result" | "starter") {
    return sort?.k.kind === "meta" && sort.k.key === key;
  }
  function arrow() {
    return sort?.dir === "desc" ? "↓" : "↑";
  }

  // 평균 (현재 필터된 게임)
  const avg = useMemo(() => {
    if (filtered.length === 0) return null;
    const n = filtered.length;
    const sumKey = (k: keyof BoxRecords) =>
      filtered.reduce((s, e) => s + ((e.records[k] as number) ?? 0), 0);
    const ratio = (mk: keyof BoxRecords, ak: keyof BoxRecords) => {
      const m = sumKey(mk);
      const a = sumKey(ak);
      return a > 0 ? (m / a) * 100 : 0;
    };
    return {
      n,
      mpg: filtered.reduce((s, e) => s + totalSeconds(e.records), 0) / 60 / n,
      ppg: sumKey("score") / n,
      rpg: sumKey("rb") / n,
      apg: sumKey("ast") / n,
      spg: sumKey("stl") / n,
      bpg: sumKey("bs") / n,
      topg: sumKey("to") / n,
      fgPct: ratio("fgt", "fgtA"),
      threePct: ratio("threep", "threepA"),
      ftPct: ratio("ft", "ftA"),
    };
  }, [filtered]);

  if (log.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-ink-50">게임로그</h3>
        <p className="mt-2 text-[15px] text-ink-500">
          이 선수의 박스스코어 데이터가 아직 없어요.{" "}
          <code className="rounded bg-court-700/60 px-1 py-0.5 font-mono text-[14px]">
            npm run fetch:kbl-boxscores
          </code>
          가 먼저 실행되어야 합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">게임로그</h3>
          <p className="mt-0.5 text-[14px] text-ink-500">
            {playerName} · 박스스코어 기반 출장 경기 ({log.length}경기)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 태그 필터 */}
          <div className="flex gap-1">
            {TAG_FILTERS.map((t) => {
              const active = tagFilter === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTagFilter(t.key)}
                  className={[
                    "rounded-md px-2.5 py-1 text-[14px] font-medium transition",
                    active
                      ? "bg-neon-500/20 text-neon-400 ring-1 ring-neon-500/40"
                      : "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {/* 모드 */}
          <div className="flex gap-1">
            {(["basic", "advanced", "hustle"] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={[
                    "rounded-md px-2.5 py-1 text-[14px] font-medium transition",
                    active
                      ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
                      : "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100",
                  ].join(" ")}
                >
                  {MODE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 필터별 평균 요약 */}
      {avg && mode === "basic" && (
        <div className="mb-3 flex flex-wrap gap-4 rounded-md border border-court-700/60 bg-court-900/40 px-3 py-2 text-[14px]">
          <Stat label="경기" v={`${avg.n}G`} />
          <Stat label="MPG" v={avg.mpg.toFixed(1)} />
          <Stat label="PPG" v={avg.ppg.toFixed(1)} />
          <Stat label="RPG" v={avg.rpg.toFixed(1)} />
          <Stat label="APG" v={avg.apg.toFixed(1)} />
          <Stat label="SPG" v={avg.spg.toFixed(1)} />
          <Stat label="BPG" v={avg.bpg.toFixed(1)} />
          <Stat label="FG%" v={`${avg.fgPct.toFixed(1)}%`} />
          <Stat label="3P%" v={`${avg.threePct.toFixed(1)}%`} />
          <Stat label="FT%" v={`${avg.ftPct.toFixed(1)}%`} />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-court-700/70">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="bg-court-900/70 text-[13px] uppercase tracking-wider text-ink-500">
              <SortableHead
                onClick={() => toggleMetaSort("date")}
                active={isSortedMeta("date")}
                arrow={arrow()}
                className="py-2 px-2 text-left font-medium"
              >
                날짜
              </SortableHead>
              <SortableHead
                onClick={() => toggleMetaSort("opp")}
                active={isSortedMeta("opp")}
                arrow={arrow()}
                className="py-2 text-left font-medium"
              >
                매치
              </SortableHead>
              <SortableHead
                onClick={() => toggleMetaSort("result")}
                active={isSortedMeta("result")}
                arrow={arrow()}
                className="py-2 text-center font-medium w-14"
              >
                결과
              </SortableHead>
              <SortableHead
                onClick={() => toggleMetaSort("starter")}
                active={isSortedMeta("starter")}
                arrow={arrow()}
                className="py-2 text-center font-medium w-10"
                title="선발"
              >
                ★
              </SortableHead>
              {cols.map((c, i) => {
                const isLast = i === cols.length - 1;
                return (
                  <SortableHead
                    key={c.key}
                    onClick={() => toggleStatSort(c.key)}
                    active={isSortedStat(c.key)}
                    arrow={arrow()}
                    title={c.title}
                    className={[
                      "py-2 font-medium",
                      isLast ? "pl-2 pr-4" : "px-2",
                      c.align === "right" ? "text-right" : "text-left",
                    ].join(" ")}
                  >
                    {c.label}
                  </SortableHead>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-court-800/50">
            {sorted.map((entry) => {
              const r = entry.records;
              const oppColor = TEAM_COLORS[entry.opponent] ?? "#94a3b8";
              return (
                <tr
                  key={entry.gmkey}
                  className="transition hover:bg-court-700/20"
                >
                  <td className="py-1.5 px-2 text-ink-400 whitespace-nowrap">
                    <Link
                      href={`/games/${gameToId({
                        gmkey: entry.gmkey,
                        date: entry.date,
                        time: entry.time,
                        tag: entry.tag,
                        homeTeam: "",
                        homeShort: entry.isHome ? "" : entry.opponent,
                        awayTeam: "",
                        awayShort: entry.isHome ? entry.opponent : "",
                        homeScore: null,
                        awayScore: null,
                        status: "final",
                      })}`}
                      className="hover:text-ink-100"
                    >
                      {fmtDate(entry.date)}
                    </Link>
                  </td>
                  <td className="py-1.5">
                    <span className="text-ink-500 mr-1">
                      {entry.isHome ? "vs" : "@"}
                    </span>
                    <span style={{ color: oppColor }} className="font-medium">
                      {entry.opponent}
                    </span>
                    {entry.tag !== "정규리그" && (
                      <span className="ml-1.5 text-[9px] text-flame-400">
                        {entry.tag}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-center stat-num">
                    <span
                      className={
                        entry.result === "W"
                          ? "text-hoop-400 font-bold"
                          : "text-buzzer-400 font-bold"
                      }
                    >
                      {entry.result}
                    </span>
                    <span className="ml-1 text-[13px] text-ink-500">
                      {entry.myScore}-{entry.oppScore}
                    </span>
                  </td>
                  <td className="py-1.5 text-center text-flame-400">
                    {entry.startFlag ? "★" : ""}
                  </td>
                  {cols.map((c, i) => {
                    const isLast = i === cols.length - 1;
                    return (
                      <td
                        key={c.key}
                        className={[
                          "py-1.5 stat-num",
                          isLast ? "pl-2 pr-4" : "px-2",
                          c.align === "right" ? "text-right" : "text-left",
                          c.key === "pts" ? "font-semibold text-ink-50" : "text-ink-300",
                        ].join(" ")}
                      >
                        {c.render(r)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[13px] text-ink-500">
        ※ 출장 0초인 경기 (DNP) 는 제외 · 날짜 클릭 시 경기 상세
      </p>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="stat-num mt-0.5 font-semibold text-ink-100">{v}</div>
    </div>
  );
}

function SortableHead({
  onClick,
  active,
  arrow,
  className = "",
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  arrow: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <th
      onClick={onClick}
      title={title}
      className={[
        "cursor-pointer select-none transition hover:text-ink-200",
        active ? "text-flame-400" : "",
        className,
      ].join(" ")}
    >
      {children}
      {active && <span className="ml-0.5">{arrow}</span>}
    </th>
  );
}
