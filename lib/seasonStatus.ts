/**
 * 시즌 단계 자동 감지 + 챔결 매치업·카운트다운 등 메인 대시보드 헬퍼
 */

import { buildPlayoffBracket } from "./playoffs";
import gamesJson from "../data/games.json";
import type { PlayoffSeries } from "./types";

type RawGame = {
  date: string;
  time: string;
  tag: string;
  homeTeam: string;
  homeShort: string;
  awayTeam: string;
  awayShort: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "final";
};

const ALL_GAMES: RawGame[] = (gamesJson as { games: RawGame[] }).games ?? [];

export type SeasonStage =
  | "regular"        // 정규시즌만
  | "first-round"    // 6강 PO 진행 중
  | "semi-round"     // 4강 PO 진행 중
  | "final-await"    // 4강 종결, 챔결 일정 등록만 (시작 전)
  | "final-running"  // 챔결 진행 중
  | "final-done";    // 챔결 종결

export interface SeasonStatus {
  stage: SeasonStage;
  /** 단계 라벨 — 한국어 */
  label: string;
  /** 짧은 강조 chip ("6강 PO 진행중" 같은) */
  shortChip: string;
  /** 다음 예정 경기 (없으면 null) */
  nextGame: RawGame | null;
  /** 다음 경기까지 D-DAY (오늘 기준 일수, 음수 가능) */
  daysToNext: number | null;
  /** 챔피언결정전 시리즈 (있으면) */
  finalSeries: PlayoffSeries | null;
  /** 4강 두 시리즈 (소노/KCC 진출 같은 결과) */
  semiSeries: PlayoffSeries[];
  /** 6강 두 시리즈 */
  firstSeries: PlayoffSeries[];
  /** 우승팀 (챔결 종결 시) */
  champion: string | null;
}

function todayKstISO(): string {
  // 한국 시각으로 오늘 날짜 (YYYY-MM-DD)
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function diffDays(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00Z").getTime();
  const b = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function getSeasonStatus(): SeasonStatus {
  const today = todayKstISO();
  const bracket = buildPlayoffBracket();

  // 다음 예정 경기 — 오늘 이후 + status="scheduled" 첫 게임
  const upcoming = [...ALL_GAMES]
    .filter((g) => g.status === "scheduled" && g.date >= today)
    .sort((a, b) =>
      (a.date + (a.time ?? "00:00")).localeCompare(b.date + (b.time ?? "00:00")),
    );
  const nextGame = upcoming[0] ?? null;
  const daysToNext = nextGame ? diffDays(today, nextGame.date) : null;

  // 시즌 단계 결정
  const finalAllDone = bracket.final?.status === "final";
  const finalRunning = bracket.final?.games.some((g) => g.status === "final");
  const finalScheduled =
    (bracket.final?.games.length ?? 0) > 0 && !finalAllDone;
  const semiAllDone = bracket.semiRound.every((s) => s.status === "final");
  const firstAllDone = bracket.firstRound.every((s) => s.status === "final");
  const semiRunning = bracket.semiRound.some(
    (s) => s.status === "in-progress" || s.games.length > 0,
  );
  const firstRunning = bracket.firstRound.some(
    (s) => s.status === "in-progress" || s.games.length > 0,
  );

  let stage: SeasonStage;
  let label: string;
  let shortChip: string;

  if (finalAllDone && bracket.champion) {
    stage = "final-done";
    label = "챔피언결정전 종료";
    shortChip = `${bracket.champion} 우승`;
  } else if (finalRunning) {
    stage = "final-running";
    label = "챔피언결정전 진행";
    shortChip = "챔결 진행중";
  } else if (semiAllDone && finalScheduled) {
    stage = "final-await";
    label = "챔피언결정전 대기";
    shortChip = "챔결 대기";
  } else if (semiRunning && !semiAllDone) {
    stage = "semi-round";
    label = "4강 플레이오프 진행";
    shortChip = "4강 PO 진행중";
  } else if (firstRunning && !firstAllDone) {
    stage = "first-round";
    label = "6강 플레이오프 진행";
    shortChip = "6강 PO 진행중";
  } else if (firstAllDone && !semiRunning) {
    stage = "semi-round";
    label = "4강 플레이오프 대기";
    shortChip = "4강 PO 대기";
  } else {
    stage = "regular";
    label = "정규리그";
    shortChip = "정규리그";
  }

  return {
    stage,
    label,
    shortChip,
    nextGame,
    daysToNext,
    finalSeries: bracket.final,
    semiSeries: bracket.semiRound,
    firstSeries: bracket.firstRound,
    champion: bracket.champion ?? null,
  };
}

/** 헤로 섹션용 헤드라인 + 부제 */
export function getHeroCopy(s: SeasonStatus): {
  chipLabel: string;
  title: string;
  subtitle: string;
} {
  switch (s.stage) {
    case "regular":
      return {
        chipLabel: "REGULAR SEASON",
        title: "정규리그 진행",
        subtitle: "10팀의 봄 농구 진출 경쟁이 시작됐다.",
      };
    case "first-round":
      return {
        chipLabel: "POST-SEASON · 6강",
        title: "6강 플레이오프 열전",
        subtitle: "정규 1·2위가 4강에서 기다린다. 누가 4강행 티켓을 잡을까.",
      };
    case "semi-round":
      return {
        chipLabel: "POST-SEASON · 4강",
        title: "4강 — 챔피언결정전을 향해",
        subtitle: "두 자리만 남았다. 7전 4선승 결승전 진출자가 가려진다.",
      };
    case "final-await": {
      const m = s.finalSeries;
      const t = m?.topShort ?? "?";
      const b = m?.bottomShort ?? "?";
      const dayText = s.daysToNext != null ? `D-${s.daysToNext}` : "곧";
      return {
        chipLabel: `POST-SEASON · 챔피언결정전 ${dayText}`,
        title: `${t} vs ${b} — 왕좌를 가른다`,
        subtitle: "7전 4선승. 한 시즌의 결말이 다음 한 주에 결정된다.",
      };
    }
    case "final-running": {
      const m = s.finalSeries;
      if (!m) return { chipLabel: "FINALS", title: "챔피언결정전", subtitle: "" };
      const lead =
        m.topWins > m.bottomWins ? m.topShort :
        m.bottomWins > m.topWins ? m.bottomShort : null;
      const subtitle = lead
        ? `${lead} ${Math.max(m.topWins, m.bottomWins)}-${Math.min(m.topWins, m.bottomWins)} 우위`
        : `${m.topWins}-${m.bottomWins} 시리즈 진행`;
      return {
        chipLabel: "POST-SEASON · 챔피언결정전",
        title: `${m.topShort} vs ${m.bottomShort}`,
        subtitle,
      };
    }
    case "final-done":
      return {
        chipLabel: "CHAMPION",
        title: `${s.champion} 우승`,
        subtitle: "한 시즌의 끝, 그리고 다음 시즌의 시작.",
      };
  }
}

/** 4강 두 시리즈의 핵심 요약 (소노 3-0, KCC 3-1 같은 식) */
export function summarizeSeries(s: PlayoffSeries): {
  winner: string | null;
  loser: string | null;
  scoreLine: string;
  bestGame: PlayoffSeries["games"][number] | null;
} {
  const winner = s.winnerShort ?? null;
  const loser =
    winner === s.topShort ? s.bottomShort :
    winner === s.bottomShort ? s.topShort : null;
  const scoreLine = winner
    ? `${winner} ${Math.max(s.topWins, s.bottomWins)}-${Math.min(s.topWins, s.bottomWins)}`
    : `${s.topWins}-${s.bottomWins}`;
  // 가장 점수차 큰 경기 (드라마틱한)
  const finals = s.games.filter(
    (g) => g.status === "final" && g.homeScore != null && g.awayScore != null,
  );
  const bestGame =
    finals.sort((a, b) => {
      const da = Math.abs((a.homeScore ?? 0) - (a.awayScore ?? 0));
      const db = Math.abs((b.homeScore ?? 0) - (b.awayScore ?? 0));
      return db - da;
    })[0] ?? null;
  return { winner, loser, scoreLine, bestGame };
}
