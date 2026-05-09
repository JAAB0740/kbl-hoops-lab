"use client";

import { useState } from "react";
import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import {
  fmtMinSec,
  totalSeconds,
  type BoxRecords,
  type BoxScore,
  type PlayerStat,
} from "@/lib/boxscores";

type Mode = "basic" | "advanced" | "hustle";
type SortDir = "asc" | "desc";

interface ColumnDef {
  key: string;
  label: string;
  /** 셀 렌더링 함수 */
  render: (r: BoxRecords) => React.ReactNode;
  /** 정렬 시 사용할 numeric 값 */
  sortVal: (r: BoxRecords) => number;
  /** 컬럼 너비 hint (CSS class) */
  align?: "left" | "right";
  /** 추가 설명 (title) */
  title?: string;
}

const BASIC_COLS: ColumnDef[] = [
  { key: "min",  label: "MIN", render: (r) => fmtMinSec(r),       sortVal: (r) => totalSeconds(r), align: "right" },
  { key: "pts",  label: "PTS", render: (r) => r.score,            sortVal: (r) => r.score, align: "right" },
  {
    key: "reb", label: "REB",
    render: (r) => (
      <>
        {r.rb}
        <span className="ml-1 text-[9px] text-ink-500">({r.offr}/{r.defr})</span>
      </>
    ),
    sortVal: (r) => r.rb, align: "right",
  },
  { key: "ast",  label: "AST", render: (r) => r.ast,              sortVal: (r) => r.ast, align: "right" },
  { key: "stl",  label: "STL", render: (r) => r.stl,              sortVal: (r) => r.stl, align: "right" },
  { key: "blk",  label: "BLK", render: (r) => r.bs,               sortVal: (r) => r.bs, align: "right" },
  { key: "to",   label: "TO",  render: (r) => r.to,               sortVal: (r) => r.to, align: "right" },
  { key: "fg",   label: "FG",  title: "야투 합산", render: (r) => makePct(r.fgt, r.fgtA), sortVal: (r) => r.fgt, align: "right" },
  { key: "3p",   label: "3P",  render: (r) => makePct(r.threep, r.threepA), sortVal: (r) => r.threep, align: "right" },
  { key: "ft",   label: "FT",  render: (r) => makePct(r.ft, r.ftA),         sortVal: (r) => r.ft, align: "right" },
  { key: "f",    label: "F",   render: (r) => r.foul,             sortVal: (r) => r.foul, align: "right" },
];

/** "5-19 26%" 형태 */
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
  { key: "min",     label: "MIN",   render: (r) => fmtMinSec(r),                   sortVal: (r) => totalSeconds(r), align: "right" },
  { key: "offrtg",  label: "ORtg",  title: "Offensive Rating",
    render: (r) => fmt1(r.offrtg),                                                  sortVal: (r) => r.offrtg ?? 0, align: "right" },
  { key: "defrtg",  label: "DRtg",  title: "Defensive Rating",
    render: (r) => fmt1(r.defrtg),                                                  sortVal: (r) => r.defrtg ?? 999, align: "right" },
  { key: "netrtg",  label: "Net",   title: "Net Rating",
    render: (r) => fmtSigned(r.netrtg),                                             sortVal: (r) => r.netrtg ?? 0, align: "right" },
  { key: "efg",     label: "eFG%",  title: "Effective FG%",
    render: (r) => fmtPct(r.efgRt),                                                 sortVal: (r) => r.efgRt ?? 0, align: "right" },
  { key: "ts",      label: "TS%",   title: "True Shooting%",
    render: (r) => fmtPct(r.tsRt),                                                  sortVal: (r) => r.tsRt ?? 0, align: "right" },
  { key: "ast%",    label: "AST%",  render: (r) => fmtPct(r.astRt),                sortVal: (r) => r.astRt ?? 0, align: "right" },
  { key: "usg",     label: "USG%",  title: "Usage%",
    render: (r) => fmtPct(r.usgRt),                                                 sortVal: (r) => r.usgRt ?? 0, align: "right" },
  { key: "tov%",    label: "TOV%",  render: (r) => fmtPct(r.tovRt),                sortVal: (r) => r.tovRt ?? 999, align: "right" },
  { key: "oreb%",   label: "OR%",   title: "Offensive Reb%",
    render: (r) => fmtPct(r.orebRt),                                                sortVal: (r) => r.orebRt ?? 0, align: "right" },
  { key: "per",     label: "PER",   render: (r) => fmt1(r.per),                    sortVal: (r) => r.per ?? 0, align: "right" },
  { key: "pie",     label: "PIE",   render: (r) => fmt1(r.pie),                    sortVal: (r) => r.pie ?? 0, align: "right" },
];

const HUSTLE_COLS: ColumnDef[] = [
  { key: "min",  label: "MIN",   render: (r) => fmtMinSec(r),                  sortVal: (r) => totalSeconds(r), align: "right" },
  { key: "pts",  label: "PTS",   render: (r) => r.score,                       sortVal: (r) => r.score, align: "right" },
  { key: "sast", label: "스크린어시", title: "스크린 어시스트",
    render: (r) => r.sast ?? 0,                                                  sortVal: (r) => r.sast ?? 0, align: "right" },
  { key: "dfl",  label: "디플렉션", render: (r) => r.dfl ?? 0,                  sortVal: (r) => r.dfl ?? 0, align: "right" },
  { key: "pp",   label: "페인트",  title: "페인트존 득점",
    render: (r) => `${r.pp}-${r.ppA}`,                                           sortVal: (r) => r.pp ?? 0, align: "right" },
  { key: "fb",   label: "속공",    title: "속공 득점",
    render: (r) => r.fb ?? 0,                                                    sortVal: (r) => r.fb ?? 0, align: "right" },
  { key: "dk",   label: "덩크",    render: (r) => `${r.dk}-${r.dkA}`,           sortVal: (r) => r.dk ?? 0, align: "right" },
  { key: "off",  label: "OREB",   render: (r) => r.offr,                       sortVal: (r) => r.offr ?? 0, align: "right" },
  { key: "stl",  label: "STL",    render: (r) => r.stl,                        sortVal: (r) => r.stl ?? 0, align: "right" },
  { key: "blk",  label: "BLK",    render: (r) => r.bs,                         sortVal: (r) => r.bs ?? 0, align: "right" },
  { key: "+/-",  label: "+/-",    title: "출장 동안 점수차",
    render: (r) => fmtSigned(r.marginCn),                                        sortVal: (r) => sentinelGuard(r.marginCn), align: "right" },
];

/** KBL sentinel(999 등) 을 0 으로 치환 — 정렬 시 outlier 방지 */
function sentinelGuard(v: number | undefined): number {
  if (v == null || isNaN(v)) return 0;
  if (Math.abs(v) >= 500) return 0;
  return v;
}

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

const COLUMN_SETS: Record<Mode, ColumnDef[]> = {
  basic: BASIC_COLS,
  advanced: ADVANCED_COLS,
  hustle: HUSTLE_COLS,
};

const MODE_LABELS: Record<Mode, string> = {
  basic: "1차 (전통)",
  advanced: "2차 (고급)",
  hustle: "허슬 / 슛 분포",
};

/** 박스스코어 테이블 — 양 팀 분리, 모드 토글 + 컬럼 정렬 + 선수 프로필 링크 */
export function BoxScoreTable({
  box,
  homeShort,
  awayShort,
  homeFull,
  awayFull,
}: {
  box: BoxScore;
  homeShort: string;
  awayShort: string;
  homeFull: string;
  awayFull: string;
}) {
  const [mode, setMode] = useState<Mode>("basic");

  // KBL 응답: homeAway "1" = 홈, "2" = 원정
  const homePlayers = box.players.filter((p) => String(p.homeAway) === "1");
  const awayPlayers = box.players.filter((p) => String(p.homeAway) === "2");
  const homeTcode = homePlayers[0]?.player.tcode;
  const awayTcode = awayPlayers[0]?.player.tcode;
  const homeTeam = box.team.find((t) => t.tcode === homeTcode);
  const awayTeam = box.team.find((t) => t.tcode === awayTcode);

  return (
    <div className="space-y-4">
      {/* 모드 토글 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] uppercase tracking-wider text-ink-500">스탯 모드</span>
        <div className="flex flex-wrap gap-1">
          {(["basic", "advanced", "hustle"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={[
                  "rounded-md px-3 py-1 text-[14px] font-medium transition",
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

      <TeamBoxTable
        title={homeFull}
        short={homeShort}
        color={TEAM_COLORS[homeShort] ?? "#94a3b8"}
        players={homePlayers}
        teamRecord={homeTeam}
        side="home"
        mode={mode}
      />
      <TeamBoxTable
        title={awayFull}
        short={awayShort}
        color={TEAM_COLORS[awayShort] ?? "#94a3b8"}
        players={awayPlayers}
        teamRecord={awayTeam}
        side="away"
        mode={mode}
      />
    </div>
  );
}

function TeamBoxTable({
  title,
  short,
  color,
  players,
  teamRecord,
  side,
  mode,
}: {
  title: string;
  short: string;
  color: string;
  players: PlayerStat[];
  teamRecord?: { tcode: string; records: BoxRecords };
  side: "home" | "away";
  mode: Mode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);

  const cols = COLUMN_SETS[mode];

  // 출장한 선수만
  let played = players
    .filter((p) => totalSeconds(p.records) > 0);

  // 정렬 — 사용자 지정 있으면 그걸로, 없으면 선발 → 출장시간
  if (sort) {
    const colDef = cols.find((c) => c.key === sort.key);
    if (colDef) {
      played = [...played].sort((a, b) => {
        const va = colDef.sortVal(a.records);
        const vb = colDef.sortVal(b.records);
        return sort.dir === "desc" ? vb - va : va - vb;
      });
    }
  } else {
    played = [...played].sort((a, b) => {
      const sa = Number(a.startFlag) ? 1 : 0;
      const sb = Number(b.startFlag) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return totalSeconds(b.records) - totalSeconds(a.records);
    });
  }

  function toggleSort(key: string) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "desc" };
      if (cur.dir === "desc") return { key, dir: "asc" };
      return null; // 초기 정렬로
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-court-700/70">
      <div className="flex items-center justify-between gap-2 bg-court-900/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[14px] font-semibold" style={{ color }}>
            {title}
          </span>
          <span className="text-[12px] uppercase tracking-wider text-ink-500">
            {side === "home" ? "홈" : "원정"}
          </span>
        </div>
        {teamRecord && mode === "basic" && (
          <div className="stat-num text-[13px] text-ink-300">
            FG {teamRecord.records.fgt}/{teamRecord.records.fgtA} ·{" "}
            3P {teamRecord.records.threep}/{teamRecord.records.threepA} ·{" "}
            FT {teamRecord.records.ft}/{teamRecord.records.ftA}
          </div>
        )}
        {teamRecord && mode === "advanced" && (
          <div className="stat-num text-[13px] text-ink-300">
            ORtg {fmt1(teamRecord.records.offrtg)} · DRtg {fmt1(teamRecord.records.defrtg)} ·
            {" "}eFG% {fmtPct(teamRecord.records.efgRt)} · Pace {fmt1(teamRecord.records.pace)}
          </div>
        )}
        {teamRecord && mode === "hustle" && (
          <div className="stat-num text-[13px] text-ink-300">
            팀 페인트 {teamRecord.records.pp} · 속공 {teamRecord.records.fbScoreCn ?? teamRecord.records.fb} ·
            {" "}TO 득점 {teamRecord.records.turnoverScoreCn ?? "—"} · 벤치 {teamRecord.records.benchScoreCn ?? "—"}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-court-900/40 text-[12px] uppercase tracking-wider text-ink-500">
              <th className="py-2 px-2 text-left font-medium w-8">#</th>
              <th className="py-2 text-left font-medium">선수</th>
              <th className="py-2 text-left font-medium w-12">포지션</th>
              {cols.map((c, i) => {
                const isSorted = sort?.key === c.key;
                const isLast = i === cols.length - 1;
                return (
                  <th
                    key={c.key}
                    title={c.title}
                    onClick={() => toggleSort(c.key)}
                    className={[
                      "py-2 font-medium cursor-pointer select-none transition hover:text-ink-200",
                      isLast ? "pl-2 pr-4" : "px-2",
                      c.align === "right" ? "text-right" : "text-left",
                      isSorted ? "text-flame-400" : "",
                    ].join(" ")}
                  >
                    {c.label}
                    {isSorted && (
                      <span className="ml-0.5">{sort.dir === "desc" ? "↓" : "↑"}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-court-800/50">
            {played.map((p) => {
              const r = p.records;
              const isStarter = Number(p.startFlag) > 0;
              return (
                <tr
                  key={p.player.pcode}
                  className="transition hover:bg-court-700/20"
                >
                  <td className="py-1.5 px-2 stat-num text-ink-500">
                    {p.player.backNum}
                  </td>
                  <td className="py-1.5 pr-2">
                    <Link
                      href={`/players/${p.player.pcode}`}
                      className={[
                        "inline-flex items-center gap-1 hover:text-flame-400",
                        isStarter ? "font-medium text-ink-50" : "text-ink-200",
                      ].join(" ")}
                    >
                      {p.player.pname}
                      {isStarter && (
                        <span className="text-[9px] text-flame-400">★</span>
                      )}
                    </Link>
                  </td>
                  <td className="py-1.5 text-ink-500">{p.player.pos}</td>
                  {cols.map((c, i) => {
                    const isLast = i === cols.length - 1;
                    return (
                      <td
                        key={c.key}
                        className={[
                          "py-1.5 stat-num",
                          isLast ? "pl-2 pr-4" : "px-2",
                          c.align === "right" ? "text-right" : "text-left",
                          c.key === "pts"
                            ? "font-semibold text-ink-50"
                            : "text-ink-300",
                        ].join(" ")}
                      >
                        {c.render(r)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {teamRecord && (
              <tr className="bg-court-900/50 font-semibold">
                <td className="py-1.5 px-2"></td>
                <td className="py-1.5 text-ink-300">팀 합계</td>
                <td className="py-1.5"></td>
                {cols.map((c, i) => {
                  const isLast = i === cols.length - 1;
                  return (
                    <td
                      key={c.key}
                      className={[
                        "py-1.5 stat-num",
                        isLast ? "pl-2 pr-4" : "px-2",
                        c.align === "right" ? "text-right" : "text-left",
                        c.key === "pts" ? "text-ink-50" : "text-ink-300",
                      ].join(" ")}
                    >
                      {/* MIN 컬럼은 팀 합계에서 의미 없음 → "—" */}
                      {c.key === "min" ? "—" : c.render(teamRecord.records)}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
