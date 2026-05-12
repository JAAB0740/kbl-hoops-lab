/**
 * "What stood out" — 게임의 박스스코어를 시즌 평균과 비교해
 * 비정상치 (평소와 크게 다른 stat) 를 자동 감지.
 *
 * 각 stat 별 임계값을 정의하고, 임계값 넘어선 것만 standout 으로 인정.
 * intensity (얼마나 많이 벗어났는지) 큰 순으로 정렬.
 */

import boxscoresJson from "../data/boxscores.json";
import { STANDINGS_FILTERS } from "@/lib/data";
import { REGULAR_POPULATION } from "@/lib/playerProfiles";

interface BoxRecords {
  score: number;
  ast: number;
  rb: number;
  stl: number;
  bs: number;
  to: number;
  fg: number; fgA: number;
  threep: number; threepA: number;
  ft: number; ftA: number;
  fgt: number; fgtA: number; // 총 FG (2점 + 3점)
  // advanced (이미 boxscore 에 있음)
  offrtg?: number;
  defrtg?: number;
  netrtg?: number;
  efgRt?: number;
  tsRt?: number;
}

interface BoxScoreTeam {
  tcode: string;
  records: BoxRecords;
}

interface BoxPlayerLike {
  player: {
    pcode: string;
    pname: string;
    tcode: string;
  };
  records: BoxRecords & {
    playMin?: number;
    playSec?: number;
  };
}

interface BoxScoreLike {
  team: BoxScoreTeam[];
  players?: BoxPlayerLike[];
}

const RAW_BOX = (boxscoresJson as { byGmkey?: Record<string, BoxScoreLike> }).byGmkey ?? {};

interface SeasonStats {
  points: number; assists: number; rebounds: number;
  steals: number; blocks: number; turnovers: number;
  fgMade: number; fgAtt: number; fgPct: number;
  threeMade: number; threeAtt: number; threePct: number;
  ftMade: number; ftAtt: number; ftPct: number;
}

interface SeasonRow {
  code: string;
  shortName: string;
  stats: SeasonStats;
}

// 시즌 평균 인덱스 (정규시즌, gameCode 01)
const SEASON_BY_CODE = new Map<string, SeasonRow>();
for (const t of (STANDINGS_FILTERS.all ?? []) as SeasonRow[]) {
  SEASON_BY_CODE.set(t.code, t);
}

export interface Standout {
  teamCode: string;
  teamShort: string;
  /** 카테고리 그룹 (이모지 색 결정) */
  kind: "scoring" | "shooting" | "defense" | "playmaking" | "carelessness" | "tempo";
  /** 표시할 stat 이름 ("3점 의존도", "PPG" 등) */
  stat: string;
  /** 게임에서의 수치 */
  gameValue: number;
  /** 시즌 평균 수치 */
  seasonAvg: number;
  /** game - season */
  delta: number;
  /** 양수 = 평소보다 높음, 음수 = 낮음 */
  direction: "up" | "down";
  /** good = 팀에게 좋은 방향, bad = 안 좋은 방향 */
  goodOrBad: "good" | "bad";
  /** 표시 포맷 ("18.0", "51.2%") */
  fmtValue: (v: number) => string;
  /** intensity = 임계값 대비 몇 배 벗어났는지 (정렬용) */
  intensity: number;
  /** 카드 캡션 한 줄 */
  caption: string;
}

/** count stat 검사 (% 변화 기준) */
function checkCount(args: {
  game: number;
  avg: number;
  thresholdPct: number;
  lowerIsBetter?: boolean;
  stat: string;
  kind: Standout["kind"];
  fmtValue?: (v: number) => string;
}): { delta: number; direction: "up" | "down"; goodOrBad: "good" | "bad"; intensity: number } | null {
  if (args.avg <= 0) return null;
  const delta = args.game - args.avg;
  const ratio = delta / args.avg; // +0.5 = 50% 위
  const absRatio = Math.abs(ratio);
  if (absRatio < args.thresholdPct) return null;
  const direction: "up" | "down" = delta > 0 ? "up" : "down";
  const goodOrBad: "good" | "bad" =
    direction === "up"
      ? args.lowerIsBetter ? "bad" : "good"
      : args.lowerIsBetter ? "good" : "bad";
  return {
    delta,
    direction,
    goodOrBad,
    intensity: absRatio / args.thresholdPct, // 1.0 = 임계 통과, 2.0 = 2배
  };
}

/** % stat 검사 (절대값 차이 기준, %p) */
function checkPct(args: {
  game: number;
  avg: number;
  thresholdAbs: number;
  stat: string;
  kind: Standout["kind"];
}): { delta: number; direction: "up" | "down"; goodOrBad: "good" | "bad"; intensity: number } | null {
  const delta = args.game - args.avg;
  if (Math.abs(delta) < args.thresholdAbs) return null;
  return {
    delta,
    direction: delta > 0 ? "up" : "down",
    goodOrBad: delta > 0 ? "good" : "bad",
    intensity: Math.abs(delta) / args.thresholdAbs,
  };
}

function pct(made: number, att: number): number {
  return att > 0 ? (made / att) * 100 : 0;
}

/** 한 게임의 모든 standout 감지. intensity 큰 순. 최대 N개. */
export function detectStandouts(gmkey: string | undefined, limit = 5): Standout[] {
  if (!gmkey) return [];
  const box = RAW_BOX[gmkey];
  if (!box || !Array.isArray(box.team)) return [];

  const out: Standout[] = [];

  for (const t of box.team) {
    const season = SEASON_BY_CODE.get(t.tcode);
    if (!season) continue;
    const r = t.records;
    const teamShort = season.shortName;

    function push(stat: string, kind: Standout["kind"], gameValue: number, seasonAvg: number, result: ReturnType<typeof checkCount>, fmtValue: (v: number) => string, captionTemplate: string) {
      if (!result) return;
      const caption = captionTemplate
        .replace("{team}", teamShort)
        .replace("{delta}", (result.direction === "up" ? "+" : "") + fmtValue(result.delta))
        .replace("{ratio}", `${result.direction === "up" ? "+" : ""}${(result.delta / seasonAvg * 100).toFixed(0)}%`);
      out.push({
        teamCode: t.tcode,
        teamShort,
        kind,
        stat,
        gameValue,
        seasonAvg,
        delta: result.delta,
        direction: result.direction,
        goodOrBad: result.goodOrBad,
        fmtValue,
        intensity: result.intensity,
        caption,
      });
    }

    const fmt1 = (v: number) => v.toFixed(1);
    const fmtPct = (v: number) => `${v.toFixed(1)}%`;

    // 1) PPG (점수)
    push("득점", "scoring", r.score, season.stats.points,
      checkCount({ game: r.score, avg: season.stats.points, thresholdPct: 0.25, stat: "PPG", kind: "scoring" }),
      fmt1,
      "{team} 시즌 평균보다 {delta}점",
    );

    // 2) APG
    push("어시스트", "playmaking", r.ast, season.stats.assists,
      checkCount({ game: r.ast, avg: season.stats.assists, thresholdPct: 0.3, stat: "APG", kind: "playmaking" }),
      fmt1,
      "{team} 평소보다 어시 {delta}개",
    );

    // 3) RPG
    push("리바운드", "defense", r.rb, season.stats.rebounds,
      checkCount({ game: r.rb, avg: season.stats.rebounds, thresholdPct: 0.2, stat: "RPG", kind: "defense" }),
      fmt1,
      "{team} 리바 {delta}개 차이",
    );

    // 4) SPG
    push("스틸", "defense", r.stl, season.stats.steals,
      checkCount({ game: r.stl, avg: season.stats.steals, thresholdPct: 0.4, stat: "SPG", kind: "defense" }),
      fmt1,
      "{team} 스틸 {delta}",
    );

    // 5) BPG
    push("블록", "defense", r.bs, season.stats.blocks,
      checkCount({ game: r.bs, avg: season.stats.blocks, thresholdPct: 0.5, stat: "BPG", kind: "defense" }),
      fmt1,
      "{team} 블록 {delta}",
    );

    // 6) TOV (적을수록 좋음)
    push("턴오버", "carelessness", r.to, season.stats.turnovers,
      checkCount({ game: r.to, avg: season.stats.turnovers, thresholdPct: 0.3, lowerIsBetter: true, stat: "TOV", kind: "carelessness" }),
      fmt1,
      "{team} 턴오버 {delta}",
    );

    // 7) FG% (절대값)
    const gFg = pct(r.fgt, r.fgtA);
    push("FG%", "shooting", gFg, season.stats.fgPct,
      checkPct({ game: gFg, avg: season.stats.fgPct, thresholdAbs: 8, stat: "FG%", kind: "shooting" }),
      fmtPct,
      "{team} 야투 평소 대비 {delta}",
    );

    // 8) 3P% (절대값)
    const g3p = pct(r.threep, r.threepA);
    push("3P%", "shooting", g3p, season.stats.threePct,
      checkPct({ game: g3p, avg: season.stats.threePct, thresholdAbs: 10, stat: "3P%", kind: "shooting" }),
      fmtPct,
      "{team} 3점 평소 대비 {delta}",
    );

    // 9) FT% (절대값)
    const gFt = pct(r.ft, r.ftA);
    push("FT%", "shooting", gFt, season.stats.ftPct,
      checkPct({ game: gFt, avg: season.stats.ftPct, thresholdAbs: 12, stat: "FT%", kind: "shooting" }),
      fmtPct,
      "{team} 자유투 평소 대비 {delta}",
    );

    // 10) 3점 의존도 (3점 시도 / 총 FG 시도)
    if (r.fgtA > 0 && (season.stats.fgAtt + season.stats.threeAtt) > 0) {
      const game3Dep = (r.threepA / r.fgtA) * 100;
      const seasonTotalAtt = season.stats.fgAtt + season.stats.threeAtt; // fgAtt 는 보통 2점 시도만이라 합산
      const season3Dep = (season.stats.threeAtt / seasonTotalAtt) * 100;
      push("3점 의존도", "scoring", game3Dep, season3Dep,
        checkPct({ game: game3Dep, avg: season3Dep, thresholdAbs: 12, stat: "3점 의존도", kind: "scoring" }),
        fmtPct,
        "{team} 3점 시도 비중 {delta}",
      );
    }

    // 11) ORtg (Advanced — boxscore 에 있을 때만)
    if (r.offrtg != null) {
      // ORtg 의 시즌 평균은 STANDINGS_FILTERS.all 에 advanced 가 있어야 함. 없으면 skip.
      const seasonOff = (season as unknown as { advanced?: { offRtg?: number } }).advanced?.offRtg;
      if (seasonOff != null) {
        push("ORtg", "tempo", r.offrtg, seasonOff,
          checkPct({ game: r.offrtg, avg: seasonOff, thresholdAbs: 12, stat: "ORtg", kind: "tempo" }),
          (v) => v.toFixed(1),
          "{team} 공격 효율 평소 대비 {delta}",
        );
      }
    }
  }

  // intensity 큰 순으로 정렬 후 상위 limit개
  return out.sort((a, b) => b.intensity - a.intensity).slice(0, limit);
}

// ─── 개인 선수 standout ────────────────────────────────────────

export interface PlayerStandout {
  playerNo: string;
  pname: string;
  teamCode: string;
  teamShort: string;
  kind: Standout["kind"];
  stat: string;
  gameValue: number;
  seasonAvg: number;
  delta: number;
  direction: "up" | "down";
  goodOrBad: "good" | "bad";
  fmtValue: (v: number) => string;
  intensity: number;
  caption: string;
  /** 게임 출장 시간 (분 단위) */
  minutes: number;
}

/** 게임에서의 출장 분(분 단위, 소수점). */
function gameMinutes(r: BoxPlayerLike["records"]): number {
  return (r.playMin ?? 0) + (r.playSec ?? 0) / 60;
}

/**
 * 한 게임의 개인 선수 standout 감지.
 *  - 출장 5분 미만 skip
 *  - 시즌 5경기 미만 (sample 부족) skip
 *  - 출장 시간이 시즌 평균의 50% 미만이면 skip (부상/벤치 강등 — 비교 의미 없음)
 */
export function detectPlayerStandouts(gmkey: string | undefined, limit = 9): PlayerStandout[] {
  if (!gmkey) return [];
  const box = RAW_BOX[gmkey];
  if (!box || !Array.isArray(box.players)) return [];

  const out: PlayerStandout[] = [];

  for (const ps of box.players) {
    const minutes = gameMinutes(ps.records);
    if (minutes < 5) continue;

    // 시즌 평균 row 매칭 (REGULAR_POPULATION 은 PlayerDetailRow[])
    const season = REGULAR_POPULATION.find((p) => p.playerNo === ps.player.pcode);
    if (!season || season.games < 5) continue;

    // 시즌 평균 출장 시간 — PlayerDetailRow.minutes 는 초 단위 (PlayerProfile 에서 /60 하는 거 확인됨).
    // 분으로 변환 후 비교. 출장 시간이 평소의 50% 미만이면 비교 의미 없으니 skip.
    const seasonMinutesPerGame = season.minutes / 60;
    if (seasonMinutesPerGame > 0 && minutes < seasonMinutesPerGame * 0.5) continue;

    const teamShort = season.teamName4 || ps.player.tcode;
    const pname = ps.player.pname || season.kname;

    const r = ps.records;
    const fmt1 = (v: number) => v.toFixed(1);

    interface RuleArgs {
      stat: string;
      kind: Standout["kind"];
      gameVal: number;
      avgVal: number;
      thresholdAbs: number;
      lowerIsBetter?: boolean;
      caption: string; // {delta} 사용
    }
    function check(args: RuleArgs) {
      const delta = args.gameVal - args.avgVal;
      if (Math.abs(delta) < args.thresholdAbs) return;
      const direction: "up" | "down" = delta > 0 ? "up" : "down";
      const goodOrBad: "good" | "bad" =
        direction === "up"
          ? args.lowerIsBetter ? "bad" : "good"
          : args.lowerIsBetter ? "good" : "bad";
      const intensity = Math.abs(delta) / args.thresholdAbs;
      const caption = args.caption
        .replace("{name}", pname)
        .replace("{delta}", (direction === "up" ? "+" : "") + fmt1(delta))
        .replace("{avg}", fmt1(args.avgVal))
        .replace("{game}", fmt1(args.gameVal));
      out.push({
        playerNo: ps.player.pcode,
        pname,
        teamCode: ps.player.tcode,
        teamShort,
        kind: args.kind,
        stat: args.stat,
        gameValue: args.gameVal,
        seasonAvg: args.avgVal,
        delta,
        direction,
        goodOrBad,
        fmtValue: fmt1,
        intensity,
        caption,
        minutes,
      });
    }

    // 1) 득점
    check({
      stat: "득점",
      kind: "scoring",
      gameVal: r.score,
      avgVal: season.points,
      thresholdAbs: 8,
      caption: "{name} 평소 {avg} → 이 경기 {game} ({delta})",
    });

    // 2) 리바운드
    check({
      stat: "리바운드",
      kind: "defense",
      gameVal: r.rb,
      avgVal: season.rebounds,
      thresholdAbs: 4,
      caption: "{name} 리바 {delta}",
    });

    // 3) 어시스트
    check({
      stat: "어시스트",
      kind: "playmaking",
      gameVal: r.ast,
      avgVal: season.assists,
      thresholdAbs: 3,
      caption: "{name} 어시 {delta}",
    });

    // 4) 스틸
    check({
      stat: "스틸",
      kind: "defense",
      gameVal: r.stl,
      avgVal: season.steals,
      thresholdAbs: 2,
      caption: "{name} 스틸 {delta}",
    });

    // 5) 블록
    check({
      stat: "블록",
      kind: "defense",
      gameVal: r.bs,
      avgVal: season.blocks,
      thresholdAbs: 2,
      caption: "{name} 블록 {delta}",
    });

    // 6) 턴오버 (적을수록 좋음)
    check({
      stat: "턴오버",
      kind: "carelessness",
      gameVal: r.to,
      avgVal: season.turnovers,
      thresholdAbs: 2,
      lowerIsBetter: true,
      caption: "{name} 턴오버 {delta}",
    });

    // 7) 3점 성공 — 평소 안 쏘는데 폭격 또는 평소 쏘는데 cold
    const season3M = (season as unknown as { threeMade?: number }).threeMade ?? 0;
    check({
      stat: "3점 성공",
      kind: "shooting",
      gameVal: r.threep,
      avgVal: season3M,
      thresholdAbs: 3,
      caption: "{name} 3점 평소 {avg} → 이 경기 {game} ({delta})",
    });
  }

  return out.sort((a, b) => b.intensity - a.intensity).slice(0, limit);
}
