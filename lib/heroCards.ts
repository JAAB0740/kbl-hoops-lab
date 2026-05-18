/**
 * 메인 대시보드 상단 Hero 카드 4종 빌더.
 *
 * 정적 stat 카드를 "현재 리그의 맥박" 다이나믹 위젯으로 교체.
 *   1. Player of the Night — 가장 최근 final 경기 GameScore 1위
 *   2. MVP Tracker — 시즌 PER 1위 (PO 단계에선 생존팀 소속 PO PER 1위)
 *   3. Team On Fire — 3연승 이상 팀 우선, 없으면 Net Rating 1위
 *   4. Stat Leader (rotation) — 득점/어시/리바 매일 로테이션
 */

import fs from "node:fs";
import path from "node:path";
import { ALL_GAMES } from "./gamesUtil";
import { STANDINGS } from "./data";
import { getSeasonStatus, type SeasonStatus } from "./seasonStatus";
import type { PlayerAdvancedStats, PlayerDetailRow } from "./types";
import boxScoresJson from "../data/boxscores.json";
import advJson from "../data/players-advanced.json";
import teamAdvJson from "../data/team-advanced.json";
import detailJson from "../data/players-detail.json";

// ─── 타입 ────────────────────────────────────

export type HeroCardKind =
  | "player-of-night"
  | "mvp-tracker"
  | "team-on-fire"
  | "stat-leader";

export type HeroTone =
  | "flame"
  | "neon"
  | "hoop"
  | "buzzer"
  | "gold"
  | "ink";

export interface HeroCard {
  kind: HeroCardKind;
  /** 카드 라벨 (헤더 작은 글씨) */
  title: string;
  /** 좌측 이모지 아이콘 */
  icon: string;
  /** 메인 한 줄 — "선수 이름 · 팀" 또는 "팀명 · 설명" */
  main: string;
  /** 큰 수치 (옵션) */
  value?: string;
  /** value 옆 단위 */
  unit?: string;
  /** 1~2줄 보조 */
  caption: string;
  /** 우상단 보조 chip */
  badge?: string;
  /** 클릭 시 이동 (없으면 클릭 비활성) */
  href?: string;
  /** 팀 short — 컬러용 (TEAM_COLORS 매핑) */
  teamShort?: string;
  /** 시각 톤 */
  tone: HeroTone;
  /** 팀 로고 파일 경로 (`public/teams/{short}.svg` 존재 시) — 워터마크용 */
  teamLogoSrc?: string;
}

// ─── 내부 데이터 로드 ─────────────────────────

interface BoxRecord {
  score: number;
  ast: number;
  rb: number;
  offr: number;
  defr: number;
  stl: number;
  bs: number;
  to: number;
  fg: number;
  fgA: number;
  fgt: number;
  fgtA: number;
  threep: number;
  threepA: number;
  ft: number;
  ftA: number;
  foul: number;
  /** KBL 출장 시간 — playMin*60 + playSec 초 합산 (playSec은 분 외 추가 0~59초) */
  playMin: number;
  playSec: number;
}
interface BoxPlayer {
  player: { pcode: string; pname: string; tname: string; tcode: string };
  records: BoxRecord;
}
type BoxFile = {
  byGmkey: Record<string, { team?: unknown; players: BoxPlayer[] }>;
};
const BOX: BoxFile = boxScoresJson as unknown as BoxFile;

const detailRegular: PlayerDetailRow[] =
  (detailJson as unknown as { splits?: { regularSeason?: PlayerDetailRow[] } })
    .splits?.regularSeason ?? [];
const detailPlayoff: PlayerDetailRow[] =
  (detailJson as unknown as { splits?: { playoff?: PlayerDetailRow[] } })
    .splits?.playoff ?? [];

interface AdvEntryEx {
  playerNo: string;
  kname: string;
  teamName1?: string;
  teamName4?: string;
  games: number;
  advanced: PlayerAdvancedStats;
}
const advRegular: AdvEntryEx[] =
  (advJson as { splits?: { regularSeason?: AdvEntryEx[] } }).splits
    ?.regularSeason ?? [];
const advPO: AdvEntryEx[] =
  (advJson as { splits?: { playoff?: AdvEntryEx[] } }).splits?.playoff ?? [];

interface TeamAdvEntry {
  shortName: string;
  name: string;
  advanced: { offRtg: number; defRtg: number; netRtg: number };
}
const teamAdvAll: TeamAdvEntry[] =
  ((teamAdvJson as { filters?: { all?: TeamAdvEntry[] } }).filters?.all ?? []) as TeamAdvEntry[];

// ─── 헬퍼 ─────────────────────────────────────

/** Hollinger GameScore — 한 경기 활약 종합 지표 */
function gameScore(r: BoxRecord): number {
  return (
    (r.score ?? 0) +
    0.4 * (r.fgt ?? 0) -
    0.7 * (r.fgtA ?? 0) -
    0.4 * ((r.ftA ?? 0) - (r.ft ?? 0)) +
    0.7 * (r.offr ?? 0) +
    0.3 * (r.defr ?? 0) +
    (r.stl ?? 0) +
    0.7 * (r.ast ?? 0) +
    0.7 * (r.bs ?? 0) -
    0.4 * (r.foul ?? 0) -
    (r.to ?? 0)
  );
}

// ─── 팀 로고 자동 스캔 ────────────────────────
// public/teams/{short}.svg|png 존재 여부를 빌드 시 한 번 스캔 → 카드에 logoSrc 주입.

let CACHED_LOGOS: Map<string, string> | null = null;
function getAvailableLogos(): Map<string, string> {
  if (CACHED_LOGOS) return CACHED_LOGOS;
  const out = new Map<string, string>();
  try {
    const dir = path.join(process.cwd(), "public", "teams");
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!/\.(svg|png|webp)$/i.test(f)) continue;
        const short = f.replace(/\.(svg|png|webp)$/i, "");
        if (!short || short.startsWith(".")) continue;
        // 키는 lowercase 로 통일 — KCC.svg / kcc.svg 둘 다 잡히도록.
        // 같은 short 의 여러 확장자가 있어도 처음 발견된 파일만 사용.
        const key = short.toLowerCase();
        if (!out.has(key)) out.set(key, `/teams/${f}`);
      }
    }
  } catch {
    // 스캔 실패해도 fallback 약자 워터마크가 동작하므로 무시
  }
  CACHED_LOGOS = out;
  return out;
}

/** 팀 short → 로고 파일 경로 (없으면 undefined) — case-insensitive */
function teamLogoSrc(short: string | undefined): string | undefined {
  if (!short || short === "—") return undefined;
  return getAvailableLogos().get(short.toLowerCase());
}

/** KBL 풀네임 → 사이트 short 표기 */
const TEAM_TO_SHORT: Record<string, string> = {
  "창원 LG": "LG",
  "원주 DB": "DB",
  "서울 SK": "SK",
  "부산 KCC": "KCC",
  "수원 KT": "KT",
  "고양 소노": "소노",
  "안양 정관장": "정관장",
  "울산 현대모비스": "현대모비스",
  "대구 한국가스공사": "가스공사",
  "서울 삼성": "삼성",
};
function teamToShort(full: string | undefined | null): string {
  if (!full) return "—";
  return TEAM_TO_SHORT[full] ?? full;
}

function fmtKDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${parseInt(m[2], 10)}월 ${parseInt(m[3], 10)}일`;
}

// ─── Card 1 : Player of the Night ─────────────

function buildPlayerOfNight(status: SeasonStatus): HeroCard {
  const finalGames = ALL_GAMES.filter(
    (g) => g.status === "final" && g.gmkey,
  ).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  if (finalGames.length === 0) {
    return {
      kind: "player-of-night",
      title: "오늘의 퍼포먼스",
      icon: "🌟",
      main: "—",
      caption: "최근 경기 데이터 대기 중",
      tone: "ink",
    };
  }

  const latestDate = finalGames[0].date;
  const dayGames = finalGames.filter((g) => g.date === latestDate);

  interface Cand {
    pcode: string;
    pname: string;
    teamShort: string;
    gs: number;
    r: BoxRecord;
    opponent: string;
    tag: string;
  }
  const cands: Cand[] = [];
  for (const g of dayGames) {
    const box = BOX.byGmkey[g.gmkey!];
    if (!box) continue;
    for (const bp of box.players) {
      const totalSec =
        (bp.records.playMin ?? 0) * 60 + (bp.records.playSec ?? 0);
      if (totalSec < 120) continue; // 2분 미만 제외
      const teamShort = teamToShort(bp.player.tname);
      const isHomePlayer = teamShort === g.homeShort;
      cands.push({
        pcode: bp.player.pcode,
        pname: bp.player.pname,
        teamShort,
        gs: gameScore(bp.records),
        r: bp.records,
        opponent: isHomePlayer ? g.awayShort : g.homeShort,
        tag: g.tag,
      });
    }
  }
  if (cands.length === 0) {
    return {
      kind: "player-of-night",
      title: "오늘의 퍼포먼스",
      icon: "🌟",
      main: "—",
      caption: "박스스코어 미적재",
      tone: "ink",
    };
  }
  cands.sort((a, b) => b.gs - a.gs);
  const top = cands[0];

  // 핵심 스탯 3개 (PTS · AST · 3PM 우선, 그 외 두드러진 항목)
  const stats: string[] = [`${top.r.score} PTS`];
  if (top.r.ast >= 3) stats.push(`${top.r.ast} AST`);
  if (top.r.threep >= 2) stats.push(`${top.r.threep} 3PM`);
  if (stats.length < 3 && top.r.rb >= 4) stats.push(`${top.r.rb} REB`);
  if (stats.length < 3 && top.r.bs >= 2) stats.push(`${top.r.bs} BLK`);
  if (stats.length < 3 && top.r.stl >= 2) stats.push(`${top.r.stl} STL`);
  while (stats.length < 3) {
    // 어쩔 수 없이 부족하면 REB 또는 AST 보조
    if (!stats.some((s) => s.endsWith("REB")))
      stats.push(`${top.r.rb} REB`);
    else if (!stats.some((s) => s.endsWith("AST")))
      stats.push(`${top.r.ast} AST`);
    else break;
  }
  const statLine = stats.slice(0, 3).join(" · ");

  const isHistorical = status.stage === "final-done";
  const title = isHistorical ? "최근 경기 퍼포먼스" : "오늘의 퍼포먼스";

  return {
    kind: "player-of-night",
    title,
    icon: "🌟",
    main: `${top.pname} · ${top.teamShort}`,
    caption: `${statLine} · ${fmtKDate(latestDate)} ${top.tag} vs ${top.opponent}`,
    badge: `GS ${top.gs.toFixed(1)}`,
    href: `/players/${top.pcode}`,
    teamShort: top.teamShort,
    tone: "flame",
  };
}

// ─── Card 2 : MVP Tracker ─────────────────────

function surviveTeams(status: SeasonStatus): Set<string> | null {
  // 챔결 진출/진행/완료 — 챔결 참여 2팀만 PO MVP 풀로
  if (status.finalSeries) {
    return new Set([
      status.finalSeries.topShort,
      status.finalSeries.bottomShort,
    ]);
  }
  // 4강 진행 중 — 4강 진출팀 풀로
  if (status.semiSeries.length > 0) {
    const teams = new Set<string>();
    for (const s of status.semiSeries) {
      teams.add(s.topShort);
      teams.add(s.bottomShort);
    }
    return teams.size > 0 ? teams : null;
  }
  // 6강 또는 그 이전 — 전체 PO 풀 그대로
  return null;
}

function buildMvpTracker(status: SeasonStatus): HeroCard {
  const poStages = new Set<SeasonStatus["stage"]>([
    "first-round",
    "semi-round",
    "final-await",
    "final-running",
    "final-done",
  ]);
  const inPo = poStages.has(status.stage);

  if (inPo && advPO.length > 0) {
    const survivors = surviveTeams(status);
    const detailByPN = new Map(
      detailPlayoff.map((d) => [String(d.playerNo), d]),
    );
    const pool = advPO
      .filter((e) => e.games >= 1)
      .map((e) => {
        const d = detailByPN.get(String(e.playerNo));
        const teamShort = teamToShort(d?.teamName1 ?? e.teamName1);
        return { entry: e, detail: d, teamShort };
      })
      .filter((x) =>
        survivors == null ? true : survivors.has(x.teamShort),
      );

    if (pool.length > 0) {
      pool.sort((a, b) => b.entry.advanced.per - a.entry.advanced.per);
      const top = pool[0];
      const isChamp = status.stage === "final-done";
      const isFinal =
        status.stage === "final-running" || status.stage === "final-await";
      const badge = isChamp
        ? `🏆 ${status.champion ?? ""} 우승`
        : isFinal
          ? "챔결 진출"
          : status.stage === "semi-round"
            ? "4강 진행"
            : "PO 진행";
      return {
        kind: "mvp-tracker",
        title: isChamp ? "PO 봄 농구의 지배자" : "현재 PO MVP",
        icon: isChamp ? "🏆" : "👑",
        main: `${top.entry.kname} · ${top.teamShort}`,
        value: top.entry.advanced.per.toFixed(1),
        unit: "PER",
        caption: top.detail
          ? `${top.detail.points.toFixed(1)} PPG · ${top.detail.rebounds.toFixed(1)} RPG · ${top.detail.assists.toFixed(1)} APG (PO ${top.detail.games}G)`
          : `PO 누적 PER ${top.entry.advanced.per.toFixed(1)}`,
        badge,
        href: `/players/${top.entry.playerNo}`,
        teamShort: top.teamShort,
        tone: "gold",
      };
    }
  }

  // 정규시즌 — minimum 20 G
  const pool = advRegular.filter((e) => e.games >= 20);
  pool.sort((a, b) => b.advanced.per - a.advanced.per);
  const top = pool[0];
  if (!top) {
    return {
      kind: "mvp-tracker",
      title: "MVP 레이스",
      icon: "👑",
      main: "—",
      caption: "데이터 대기",
      tone: "ink",
    };
  }
  const detail = detailRegular.find(
    (d) => String(d.playerNo) === String(top.playerNo),
  );
  const teamShort = teamToShort(detail?.teamName1 ?? top.teamName1);
  return {
    kind: "mvp-tracker",
    title: "현재 MVP 레이스",
    icon: "👑",
    main: `${top.kname} · ${teamShort}`,
    value: top.advanced.per.toFixed(1),
    unit: "PER",
    caption: detail
      ? `${detail.points.toFixed(1)} PPG · ${detail.rebounds.toFixed(1)} RPG · ${detail.assists.toFixed(1)} APG`
      : `정규 PER ${top.advanced.per.toFixed(1)}`,
    badge: "1위",
    href: `/players/${top.playerNo}`,
    teamShort,
    tone: "gold",
  };
}

// ─── Card 3 : Team On Fire ────────────────────

interface TeamStreak {
  short: string;
  streak: number;
  kind: "W" | "L";
}
function computeStreak(short: string): TeamStreak {
  const games = ALL_GAMES.filter(
    (g) =>
      g.status === "final" &&
      (g.homeShort === short || g.awayShort === short),
  ).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  let streak = 0;
  let kind: "W" | "L" | null = null;
  for (const g of games) {
    if (g.homeScore == null || g.awayScore == null) continue;
    const isHome = g.homeShort === short;
    const my = isHome ? g.homeScore : g.awayScore;
    const opp = isHome ? g.awayScore : g.homeScore;
    const r: "W" | "L" = my > opp ? "W" : "L";
    if (kind === null) {
      kind = r;
      streak = 1;
    } else if (kind === r) {
      streak++;
    } else {
      break;
    }
  }
  return { short, streak, kind: kind ?? "L" };
}

function buildTeamOnFire(status: SeasonStatus): HeroCard {
  const teams = STANDINGS.map((s) => s.shortName);
  const streaks = teams.map(computeStreak);
  const winStreaks = streaks
    .filter((s) => s.kind === "W" && s.streak >= 3)
    .sort((a, b) => b.streak - a.streak);

  if (winStreaks.length > 0) {
    const top = winStreaks[0];
    const lastN = top.streak;
    const isHistorical = status.stage === "final-done";
    return {
      kind: "team-on-fire",
      title: "가장 뜨거운 팀",
      icon: "🔥",
      main: `${top.short} · 파죽의 ${lastN}연승`,
      caption: isHistorical
        ? `시즌 마무리 시점 ${lastN}경기 연속 승리`
        : `최근 ${lastN}경기 무패 — 모멘텀 최고조`,
      badge: isHistorical ? "시즌 종료" : "ACTIVE",
      href: `/team?short=${encodeURIComponent(top.short)}`,
      teamShort: top.short,
      tone: "buzzer",
    };
  }

  // Fallback — Net Rating 1위
  if (teamAdvAll.length > 0) {
    const sorted = [...teamAdvAll].sort(
      (a, b) => b.advanced.netRtg - a.advanced.netRtg,
    );
    const top = sorted[0];
    const sign = top.advanced.netRtg >= 0 ? "+" : "";
    return {
      kind: "team-on-fire",
      title: "리그 최고 효율",
      icon: "🔥",
      main: `${top.shortName} · 시즌 Net Rating 1위`,
      value: `${sign}${top.advanced.netRtg.toFixed(1)}`,
      unit: "NetRtg",
      caption: `ORtg ${top.advanced.offRtg.toFixed(1)} · DRtg ${top.advanced.defRtg.toFixed(1)}`,
      badge: "효율",
      href: `/team?short=${encodeURIComponent(top.shortName)}`,
      teamShort: top.shortName,
      tone: "flame",
    };
  }

  return {
    kind: "team-on-fire",
    title: "팀 모멘텀",
    icon: "🔥",
    main: "—",
    caption: "데이터 대기",
    tone: "ink",
  };
}

// ─── Card 4 : Stat Leader (rotation) ──────────

function buildStatLeader(): HeroCard {
  type StatKey = "points" | "assists" | "rebounds";
  const cats: { key: StatKey; label: string; unit: string }[] = [
    { key: "points", label: "득점", unit: "PPG" },
    { key: "assists", label: "어시스트", unit: "APG" },
    { key: "rebounds", label: "리바운드", unit: "RPG" },
  ];

  // day-of-year rotation (KST)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yearStart = Date.UTC(kst.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (kst.getTime() - yearStart) / 86400000,
  );
  const c = cats[dayOfYear % 3];

  const pool = detailRegular.filter((p) => p.games >= 20);
  const sorted = [...pool].sort(
    (a, b) => Number(b[c.key]) - Number(a[c.key]),
  );
  const top = sorted[0];
  if (!top) {
    return {
      kind: "stat-leader",
      title: `시즌 ${c.label} 리더`,
      icon: "📈",
      main: "—",
      caption: "데이터 대기",
      tone: "ink",
    };
  }
  const second = sorted[1];
  const teamShort = teamToShort(top.teamName1);
  const gap = Number(top[c.key]) - Number(second?.[c.key] ?? 0);

  return {
    kind: "stat-leader",
    title: `시즌 ${c.label} 리더`,
    icon: "📈",
    main: `${top.kname} · ${teamShort}`,
    value: Number(top[c.key]).toFixed(1),
    unit: c.unit,
    caption: second
      ? `2위 ${second.kname}와 ${gap >= 0 ? "+" : ""}${gap.toFixed(1)} ${c.unit} 차`
      : `시즌 ${c.label} 부문 1위`,
    badge: c.label,
    href: `/players/${top.playerNo}`,
    teamShort,
    tone: "hoop",
  };
}

// ─── 진입점 ───────────────────────────────────

export function buildHeroCards(): HeroCard[] {
  const status = getSeasonStatus();
  const cards = [
    buildPlayerOfNight(status),
    buildMvpTracker(status),
    buildTeamOnFire(status),
    buildStatLeader(),
  ];
  // 로고 파일이 있는 팀이면 teamLogoSrc 자동 주입
  return cards.map((c) => ({ ...c, teamLogoSrc: teamLogoSrc(c.teamShort) }));
}
