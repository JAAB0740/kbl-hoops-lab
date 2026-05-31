/**
 * 선수 archetype 분류 — Stat 기반 Bottom-Up.
 *
 * 키(Height) 조건 완전 배제. USG%·AST%·TRB%·슛 분포(페인트/3PA)
 * percentile + 절대 비중 기준으로 3단계 필터링:
 *
 *   [단계 1] 핸들러     ─ 메인 / 보조 핸들러
 *   [단계 2] 빅맨       ─ 고볼륨 스코어링 빅 / 스트레치 빅 / 롤맨
 *   [단계 3] 윙         ─ 슬래셔 / 3&D 윙
 *
 * 모든 임계값은 ARCHETYPE_THRESHOLDS 에 export 되어 UI 에서 조절 가능.
 * percentile 모집단은 정규시즌 ≥10G · 평균 ≥10분/G 자격자.
 */

import type {
  PlayerAdvancedStats,
  PlayerDetailRow,
  PlayerProfile,
} from "./types";
import type { PlayerShotChart } from "./shotCharts";
import { REGULAR_POPULATION } from "./playerProfiles";
import { percentileOf } from "./percentile";
import { getPlayerInfo } from "./playerInfo";
import advJson from "../data/players-advanced.json";

// ─── 임계값 (UI에서 조절할 수 있도록 변수화) ─────────────

export interface ArchetypeThresholds {
  /** 표본 자격 */
  minGames: number;
  minMinutesPerGame: number;

  // Stage 1: 핸들러
  mainHandler: { usgPctileMin: number; astPctileMin: number };
  secondaryHandler: { astPctileMin: number; usgPctileMin: number };

  // Stage 1: 빅맨 판정 + 세부 (우선 실행 — 외국선수 빅의 핸들러 오분류 방지)
  //
  // 빅맨 OR 조건:
  //   1. pos === 'C'
  //   2. (height ≥ heightMin) AND (paint% ≥ paintShareMin)
  //   3. (height ≥ heightMin) AND (TRB% ≥ p_trb) AND (USG% ≤ p_usgMax)
  //      → 포인트 포워드(고USG)는 빅맨에서 제외 → 핸들러로
  //   4. (외국선수 도메인) flag === '외국선수' AND height ≥ heightMin
  //      → KBL 'FD' 등록 외국선수 빅이 USG 상한 때문에 윙으로 흘러가는 문제 차단
  //   5. (info 누락 외국선수 stat fallback) info 없음 AND
  //      (TRB% ≥ p_trb OR paint% ≥ infoMissingPaintShareMin)
  big: {
    heightMin: number;
    trbPctileMin: number;
    /** 조건 3 — USG% 상한 percentile (포인트 포워드 빅맨 진입 차단) */
    trbUsgPctileMax: number;
    paintShareMin: number;
    /** 조건 5 — info 누락 외국선수 stat fallback의 paint 임계 */
    infoMissingPaintShareMin: number;
  };
  highVolumeBig: { usgPctileMin: number };
  stretchBig: { threeShareMin: number; threePctPctileMin: number };

  // Stage 3: 윙 — 평가 순서:
  //   올라운더 → 슬래셔 → 트루 3&D → 허슬러 → 코너 스페이서 → 퓨어 슈터 → 일반 윙
  allRounder: {
    usgPctMin: number;        // USG% raw 값 (e.g., 18)
    astPctMin: number;        // AST% raw 값 (e.g., 10)
    threePctMin: number;      // 3P% raw 값 (e.g., 32)
    rimAttPerGameMin: number; // 림 부근 시도/G (1.5)
    paintShareMin: number;    // 림+페인트 비중 (0.35)
  };
  slasher: {
    paintShareMin: number;    // 림+페인트 비중 ≥ 40%
    rimAttPerGameMin: number; // 림 시도/G ≥ 2.0
    rimPctMin: number;        // 림 성공률 ≥ 65%
  };
  true3AndD: { threePctMin: number; defActivityPctileMin: number };
  hustler: {
    threePctMax: number;     // 3P% < 32%
    orbPctMin: number;       // ORB% ≥ 5%
    stlPerGameMin: number;   // STL/G ≥ 1.0  (KBL adv에 STL% 없어 raw 대체)
    blkPerGameMin: number;   // BLK/G ≥ 0.5  (KBL adv에 BLK% 없어 raw 대체)
  };
  cornerSpacer: { usgPctMax: number; cornerWingShareMin: number };
  pureShooter: { threeShareMin: number; threePctMin: number };
}

export const ARCHETYPE_THRESHOLDS: ArchetypeThresholds = {
  minGames: 10,
  minMinutesPerGame: 10,

  mainHandler: { usgPctileMin: 75, astPctileMin: 75 },
  secondaryHandler: { astPctileMin: 65, usgPctileMin: 35 },

  big: {
    heightMin: 195,
    trbPctileMin: 75,
    trbUsgPctileMax: 75,
    paintShareMin: 0.65,
    infoMissingPaintShareMin: 0.5,
  },
  highVolumeBig: { usgPctileMin: 80 },
  stretchBig: { threeShareMin: 0.3, threePctPctileMin: 50 },

  // Stage 3 — 평가 순서:
  //   올라운더 → 슬래셔 → 트루 3&D → 허슬러 → 코너 스페이서 → 퓨어 슈터 → 일반 윙
  allRounder: {
    usgPctMin: 17,
    astPctMin: 10,
    threePctMin: 32,
    rimAttPerGameMin: 1.5,
    paintShareMin: 0.35,
  },
  slasher: {
    paintShareMin: 0.4,
    rimAttPerGameMin: 2.0,
    rimPctMin: 65,
  },
  true3AndD: { threePctMin: 32, defActivityPctileMin: 55 },
  hustler: {
    threePctMax: 32,
    orbPctMin: 5,
    stlPerGameMin: 1.0,
    blkPerGameMin: 0.5,
  },
  cornerSpacer: { usgPctMax: 15, cornerWingShareMin: 0.5 },
  pureShooter: { threeShareMin: 0.45, threePctMin: 33 },
};

// ─── 모집단 빌드 ────────────────────────────────

type AdvEntry = { playerNo: string; advanced: PlayerAdvancedStats };

const advRegular: AdvEntry[] =
  (advJson as { splits?: { regularSeason?: AdvEntry[] } }).splits?.regularSeason ?? [];

function findAdv(playerNo: string): PlayerAdvancedStats | undefined {
  return advRegular.find((e) => String(e.playerNo) === String(playerNo))?.advanced;
}

function isQualifiedRow(row: PlayerDetailRow, th: ArchetypeThresholds): boolean {
  const minPerG = (row.minutes ?? 0) / 60;
  return (row.games ?? 0) >= th.minGames && minPerG >= th.minMinutesPerGame;
}

interface QualifiedRow {
  playerNo: string;
  row: PlayerDetailRow;
  adv?: PlayerAdvancedStats;
}

// 모집단은 ARCHETYPE_THRESHOLDS의 자격 기준으로 한 번만 빌드.
// (UI에서 임계값 바꿔도 percentile 모집단은 안 흔들리는 게 비교 안정성에 좋음 —
//  자격 임계값을 바꾸고 싶다면 빌드 시점에 새로 export 하든가 함수형 API 가져야.)
const QUALIFIED: QualifiedRow[] = REGULAR_POPULATION.filter((r) =>
  isQualifiedRow(r, ARCHETYPE_THRESHOLDS),
).map((row) => ({
  playerNo: String(row.playerNo),
  row,
  adv: findAdv(String(row.playerNo)),
}));

function sortedAsc(xs: number[]): number[] {
  return xs.filter(Number.isFinite).slice().sort((a, b) => a - b);
}

// per-game raw 합 — STL%/BLK% advanced 키가 없어 대체 시그널로 사용 (트루 3&D 디펜스 활동성)
function defActivity(row: PlayerDetailRow): number {
  return (row.steals ?? 0) + (row.blocks ?? 0);
}

const SORTED = {
  usgPct: sortedAsc(QUALIFIED.map((q) => q.adv?.usgPct ?? NaN)),
  astPct: sortedAsc(QUALIFIED.map((q) => q.adv?.astPct ?? NaN)),
  tsPct: sortedAsc(QUALIFIED.map((q) => q.adv?.tsPct ?? NaN)),
  rebPct: sortedAsc(QUALIFIED.map((q) => q.adv?.rebPct ?? NaN)),
  drebPct: sortedAsc(QUALIFIED.map((q) => q.adv?.drebPct ?? NaN)),
  blocks: sortedAsc(QUALIFIED.map((q) => q.row.blocks)),
  steals: sortedAsc(QUALIFIED.map((q) => q.row.steals)),
  threePct: sortedAsc(QUALIFIED.map((q) => q.row.threePct)),
  // KBL `fgAtt` 는 misnamed (2pt only). 총 FGA 는 `twoAtt`.
  ftaRate: sortedAsc(
    QUALIFIED.map((q) => (q.row.twoAtt > 0 ? q.row.ftAtt / q.row.twoAtt : NaN)),
  ),
  defActivity: sortedAsc(QUALIFIED.map((q) => defActivity(q.row))),
};

/**
 * 슛 분포 계산 — **우리 14존 raw 분류 기반** (KBL shooting.json 의 misleading
 * "range 4-6 = 3pt 라벨" 의존을 제거; 실제 long-2 가 그 안에 섞여 있음).
 *
 *  거리 정의 (8ft=58px / 16ft=116px / 3pt arc=160px, lib/shotCharts.ts):
 *   - 페인트 (≤16ft): rim + paint_left/center/right
 *   - 미드 (16ft~3pt arc): mid_baseline_*, mid_elbow_*, mid_center
 *   - 3점 (arc 밖 + corner strip): corner_3_*, wing_3_*, top_3_center
 *
 *  반환:
 *   - paint/mid/three = FGA 대비 비중 (합 ≈ 1)
 *   - cornerWingOfThree = (corner_3 + wing_3) / 전체 3점
 *   - rimAtt = 림(8ft) 시도/G  (gamesWithShots 로 나눔)
 *   - rimPct = 림 성공률 (%)
 */
function shotShares(shotChart: PlayerShotChart | undefined): {
  paint: number;
  mid: number;
  three: number;
  cornerWingOfThree: number | null;
  rimAtt: number;
  rimPct: number;
} | null {
  if (!shotChart || shotChart.totalShots <= 0) return null;
  const d = shotChart.byZoneDetailed;
  const games = shotChart.gamesWithShots || 1;
  const rim = d.rim.att;
  const paint = rim + d.paint_left.att + d.paint_center.att + d.paint_right.att;
  const mid =
    d.mid_baseline_top.att + d.mid_baseline_bot.att +
    d.mid_elbow_top.att + d.mid_elbow_bot.att +
    d.mid_center.att;
  const corner3 = d.corner_3_top.att + d.corner_3_bot.att;
  const wing3 = d.wing_3_top.att + d.wing_3_bot.att;
  const top3 = d.top_3_center.att;
  const three = corner3 + wing3 + top3;
  const tot = paint + mid + three;
  if (tot <= 0) return null;
  return {
    paint: paint / tot,
    mid: mid / tot,
    three: three / tot,
    cornerWingOfThree: three > 0 ? (corner3 + wing3) / three : null,
    rimAtt: rim / games,
    rimPct: d.rim.pct,
  };
}

// ─── 결과 타입 ──────────────────────────────────

export type ArchetypeLabel =
  // 핸들러
  | "메인 핸들러"
  | "보조 핸들러"
  // 빅맨
  | "고볼륨 스코어링 빅"
  | "스트레치 빅"
  | "롤맨"
  // 윙 (단계 3 — 7단계 평가)
  | "올라운더"
  | "슬래셔"
  | "트루 3&D"
  | "허슬러"
  | "코너 스페이서"
  | "퓨어 슈터"
  | "일반 윙"
  // 표본 부족
  | "표본 부족";

export type ArchetypeGroup = "핸들러" | "윙" | "빅맨" | "—";
export type ArchetypeTone = "flame" | "neon" | "hoop" | "buzzer" | "ink";

export interface ArchetypeSignals {
  games: number;
  minPerG: number;
  height: number | null;
  pos: string | null;

  usgPct: number | null;
  usgPctile: number | null;
  astPct: number | null;
  astPctile: number | null;
  tsPct: number | null;
  tsPctile: number | null;
  rebPct: number | null;
  rebPctile: number | null;

  threeShare: number | null;
  paintShare: number | null;
  midShare: number | null;
  /** 전체 3점 시도 중 코너(r4) + 윙(r5) 비율 */
  cornerWingOfThree: number | null;
  /** 림 부근(range 1) 시도/G (raw) */
  rimAtt: number | null;
  /** 림 부근 성공률 (%) */
  rimPct: number | null;
  ftaRate: number | null;
  ftaRatePctile: number | null;

  threePct: number | null;
  threePctPctile: number | null;
  blocks: number | null;
  blkPctile: number | null;
  steals: number | null;
  stlPctile: number | null;
  /** STL+BLK per game — STL%/BLK% advanced 키 없어 대체 */
  defActivity: number | null;
  defActivityPctile: number | null;
  /** ORB% (orebPct, advanced) */
  orebPct: number | null;
}

export interface ArchetypeResult {
  label: ArchetypeLabel;
  group: ArchetypeGroup;
  tone: ArchetypeTone;
  /** 분류 단계 — UI 디버깅·툴팁용 */
  stage: 0 | 1 | 2 | 3 | 4;
  /** 분류 근거 한두 줄 */
  reason: string;
  signals: ArchetypeSignals;
}

// ─── 메인 분류기 ────────────────────────────────

export function classifyArchetype(
  profile: PlayerProfile,
  thresholds: ArchetypeThresholds = ARCHETYPE_THRESHOLDS,
): ArchetypeResult {
  const TH = thresholds;
  const row = profile.season;
  const adv = profile.advanced?.season;
  const info = getPlayerInfo(profile.playerNo);
  const height = info?.pHeight ?? null;
  const pos = info?.pos ?? null;
  const flag = info?.flag ?? null;

  const games = row?.games ?? 0;
  const minPerG = row ? row.minutes / 60 : 0;

  // ─── 표본 부족 처리 ────────────────────
  if (!row || games < TH.minGames || minPerG < TH.minMinutesPerGame) {
    return {
      label: "표본 부족",
      group: "—",
      stage: 0,
      tone: "ink",
      reason: `정규 ${games}G · ${minPerG.toFixed(1)}분/G — 분류 보류 (기준 ${TH.minGames}G·${TH.minMinutesPerGame}분)`,
      signals: emptySignals(games, minPerG, height, pos),
    };
  }

  // ─── 신호 계산 ──────────────────────────
  // 우리 14존 raw 분류 (lib/shotCharts.ts) 기준 — 페인트(≤16ft) / 미드 / 3점
  const shares = shotShares(profile.shotChart);
  // threeShare: shares 가 있으면 우리 분류값(정확), 없으면 KBL row 기반 fallback.
  // 주의: KBL `row.fgAtt` 는 misnamed — 실은 2pt-only. `row.twoAtt` 가 total FGA.
  const fgaTotal = row.twoAtt; // total FGA (per-game)
  const threeShare =
    shares?.three ?? (fgaTotal > 0 ? row.threeAtt / fgaTotal : 0);
  const ftaRate = fgaTotal > 0 ? row.ftAtt / fgaTotal : 0;
  const paintShare = shares?.paint ?? null;
  const midShare = shares?.mid ?? null;

  const usgPct = adv?.usgPct ?? 0;
  const astPct = adv?.astPct ?? 0;
  const tsPct = adv?.tsPct ?? 0;
  const rebPct = adv?.rebPct ?? 0;

  const cornerWingOfThree = shares?.cornerWingOfThree ?? null;
  const rimAtt = shares?.rimAtt ?? null;
  const rimPct = shares?.rimPct ?? null;
  const orebPct = adv?.orebPct ?? null;
  const defAct = defActivity(row);

  const usgPctile = percentileOf(usgPct, SORTED.usgPct);
  const astPctile = percentileOf(astPct, SORTED.astPct);
  const tsPctile = percentileOf(tsPct, SORTED.tsPct);
  const rebPctile = percentileOf(rebPct, SORTED.rebPct);
  const blkPctile = percentileOf(row.blocks, SORTED.blocks);
  const stlPctile = percentileOf(row.steals, SORTED.steals);
  const threePctPctile = percentileOf(row.threePct, SORTED.threePct);
  const ftaRatePctile = percentileOf(ftaRate, SORTED.ftaRate);
  const defActivityPctile = percentileOf(defAct, SORTED.defActivity);

  const signals: ArchetypeSignals = {
    games,
    minPerG,
    height,
    pos,
    usgPct,
    usgPctile,
    astPct,
    astPctile,
    tsPct,
    tsPctile,
    rebPct,
    rebPctile,
    threeShare,
    paintShare,
    midShare,
    cornerWingOfThree,
    rimAtt,
    rimPct,
    ftaRate,
    ftaRatePctile,
    threePct: row.threePct,
    threePctPctile,
    blocks: row.blocks,
    blkPctile,
    steals: row.steals,
    stlPctile,
    defActivity: defAct,
    defActivityPctile,
    orebPct,
  };

  const topPct = (p: number) => `상위 ${Math.max(0, 100 - p)}%`;

  // ─── 단계 1 : 빅맨 판정 + 세부 (우선 실행) ────
  //   빅맨 OR 조건:
  //     (1) pos === 'C'
  //     (2) Height ≥ 195 AND Paint% ≥ 65%
  //     (3) Height ≥ 195 AND TRB% ≥ P75 AND USG% ≤ P75
  //         → 포인트 포워드(고USG 빅)는 빅맨에서 튕겨 핸들러로
  //     (4) 외국선수 도메인 룰 — flag === '외국선수' AND Height ≥ 195
  //         → KBL 'FD' 등록 외국선수 빅(USG 매우 높음)이 조건 3에서 탈락하는 문제 차단
  //     (5) info 누락 외국선수 stat fallback —
  //         info 없음 AND (TRB% ≥ P75 OR paint% ≥ 50%)
  const hTall = (height ?? 0) >= TH.big.heightMin;
  const isForeignBig = flag === "외국선수" && hTall;
  const isInfoMissingBig =
    !info &&
    (rebPctile >= TH.big.trbPctileMin ||
      (paintShare != null &&
        paintShare >= TH.big.infoMissingPaintShareMin));
  const isBig =
    pos === "C" ||
    (hTall && paintShare != null && paintShare >= TH.big.paintShareMin) ||
    (hTall &&
      rebPctile >= TH.big.trbPctileMin &&
      usgPctile <= TH.big.trbUsgPctileMax) ||
    isForeignBig ||
    isInfoMissingBig;

  if (isBig) {
    // 1-A. 고볼륨 스코어링 빅
    if (usgPctile >= TH.highVolumeBig.usgPctileMin) {
      return {
        label: "고볼륨 스코어링 빅",
        group: "빅맨",
        stage: 1,
        tone: "buzzer",
        reason: `USG% ${usgPct.toFixed(1)}% (${topPct(usgPctile)}) · TRB% ${rebPct.toFixed(1)}% · ${row.points.toFixed(1)} PPG / ${row.rebounds.toFixed(1)} RPG`,
        signals,
      };
    }
    // 1-B. 스트레치 빅
    if (
      threeShare >= TH.stretchBig.threeShareMin &&
      threePctPctile >= TH.stretchBig.threePctPctileMin
    ) {
      return {
        label: "스트레치 빅",
        group: "빅맨",
        stage: 1,
        tone: "neon",
        reason: `TRB% ${rebPct.toFixed(1)}% · 3PA 비중 ${(threeShare * 100).toFixed(0)}% · 3P% ${row.threePct.toFixed(1)}% (${topPct(threePctPctile)})`,
        signals,
      };
    }
    // 1-C. 롤맨 (전통적 롤맨 / 림 프로텍터 통합)
    const defLine =
      blkPctile >= 80
        ? ` · 블록 ${row.blocks.toFixed(1)} (${topPct(blkPctile)})`
        : "";
    const paintLine =
      paintShare != null
        ? ` · 페인트 슛 ${(paintShare * 100).toFixed(0)}%`
        : "";
    return {
      label: "롤맨",
      group: "빅맨",
      stage: 1,
      tone: "flame",
      reason: `TRB% ${rebPct.toFixed(1)}% (${topPct(rebPctile)}) · ${row.rebounds.toFixed(1)} RPG${paintLine}${defLine}`,
      signals,
    };
  }

  // ─── 단계 2 : 핸들러 (빅맨 제외 인원) ─────
  if (
    usgPctile >= TH.mainHandler.usgPctileMin &&
    astPctile >= TH.mainHandler.astPctileMin
  ) {
    return {
      label: "메인 핸들러",
      group: "핸들러",
      stage: 2,
      tone: "flame",
      reason: `USG% ${usgPct.toFixed(1)}% (${topPct(usgPctile)}) · AST% ${astPct.toFixed(1)}% (${topPct(astPctile)}) · ${row.assists.toFixed(1)} APG`,
      signals,
    };
  }
  if (
    astPctile >= TH.secondaryHandler.astPctileMin &&
    usgPctile >= TH.secondaryHandler.usgPctileMin
  ) {
    return {
      label: "보조 핸들러",
      group: "핸들러",
      stage: 2,
      tone: "neon",
      reason: `AST% ${astPct.toFixed(1)}% (${topPct(astPctile)}) · USG% ${usgPct.toFixed(1)}% · ${row.assists.toFixed(1)} APG`,
      signals,
    };
  }

  // ─── 단계 3 : 윙 ──────────────────────
  // 평가 순서 (1번부터):
  //   1. 올라운더 → 2. 슬래셔 → 3. 트루 3&D → 4. 허슬러 → 5. 코너 스페이서 → 6. 퓨어 슈터 → 7. 일반 윙

  // 3-1. 올라운더 (VIP) — 득점·리딩·내외곽 공격 모두 가능한 엘리트 스윙맨
  if (
    usgPct >= TH.allRounder.usgPctMin &&
    astPct >= TH.allRounder.astPctMin &&
    row.threePct >= TH.allRounder.threePctMin &&
    ((rimAtt != null && rimAtt >= TH.allRounder.rimAttPerGameMin) ||
      (paintShare != null && paintShare >= TH.allRounder.paintShareMin))
  ) {
    const insideMatch =
      rimAtt != null && rimAtt >= TH.allRounder.rimAttPerGameMin
        ? `림 ${rimAtt.toFixed(1)}/G`
        : `페인트 ${((paintShare ?? 0) * 100).toFixed(0)}%`;
    return {
      label: "올라운더",
      group: "윙",
      stage: 3,
      tone: "flame",
      reason: `USG% ${usgPct.toFixed(1)}% · AST% ${astPct.toFixed(1)}% · 3P% ${row.threePct.toFixed(1)}% · ${insideMatch}`,
      signals,
    };
  }

  // 3-2. 슬래셔 — 페인트+림 슈팅 비중 ≥ 임계 OR (림 시도 ≥ 임계 AND 림 성공률 ≥ 임계)
  const slasherByShare =
    paintShare != null && paintShare >= TH.slasher.paintShareMin;
  const slasherByRim =
    rimAtt != null &&
    rimPct != null &&
    rimAtt >= TH.slasher.rimAttPerGameMin &&
    rimPct >= TH.slasher.rimPctMin;
  if (slasherByShare || slasherByRim) {
    const reason = slasherByShare
      ? `페인트+림 ${((paintShare ?? 0) * 100).toFixed(0)}% (≥ ${(TH.slasher.paintShareMin * 100).toFixed(0)}%) · 3PA 비중 ${(threeShare * 100).toFixed(0)}%`
      : `림 시도 ${rimAtt?.toFixed(1)}/G · 림 성공률 ${rimPct?.toFixed(1)}% (≥ ${TH.slasher.rimPctMin}%) · 페인트 ${((paintShare ?? 0) * 100).toFixed(0)}%`;
    return {
      label: "슬래셔",
      group: "윙",
      stage: 3,
      tone: "buzzer",
      reason,
      signals,
    };
  }

  // 3-3. 트루 3&D — 3P% ≥ 임계 + 디펜스 활동성 P임계+
  if (
    row.threePct >= TH.true3AndD.threePctMin &&
    defActivityPctile >= TH.true3AndD.defActivityPctileMin
  ) {
    return {
      label: "트루 3&D",
      group: "윙",
      stage: 3,
      tone: "hoop",
      reason: `3P% ${row.threePct.toFixed(1)}% · STL+BLK ${defAct.toFixed(1)}/G (${topPct(defActivityPctile)}) · STL ${row.steals.toFixed(1)} / BLK ${row.blocks.toFixed(1)}`,
      signals,
    };
  }

  // 3-4. 허슬러 — 슛 약함 + (ORB% ≥ 임계 OR STL/G ≥ 임계 OR BLK/G ≥ 임계)
  //   ※ KBL adv에 STL%/BLK% 키 없어 raw 임계로 대체
  if (
    row.threePct < TH.hustler.threePctMax &&
    ((orebPct != null && orebPct >= TH.hustler.orbPctMin) ||
      row.steals >= TH.hustler.stlPerGameMin ||
      row.blocks >= TH.hustler.blkPerGameMin)
  ) {
    const which =
      orebPct != null && orebPct >= TH.hustler.orbPctMin
        ? `ORB% ${orebPct.toFixed(1)}%`
        : row.steals >= TH.hustler.stlPerGameMin
          ? `STL ${row.steals.toFixed(1)}/G`
          : `BLK ${row.blocks.toFixed(1)}/G`;
    return {
      label: "허슬러",
      group: "윙",
      stage: 3,
      tone: "buzzer",
      reason: `3P% ${row.threePct.toFixed(1)}% (낮음) · ${which}`,
      signals,
    };
  }

  // 3-5. 코너 스페이서 — 저USG + 코너·윙 비중 (3PA% 조건은 식스맨 왜곡 방지 위해 삭제)
  if (
    usgPct <= TH.cornerSpacer.usgPctMax &&
    cornerWingOfThree != null &&
    cornerWingOfThree >= TH.cornerSpacer.cornerWingShareMin
  ) {
    return {
      label: "코너 스페이서",
      group: "윙",
      stage: 3,
      tone: "neon",
      reason: `USG% ${usgPct.toFixed(1)}% (낮음) · 코너+윙 비율 ${(cornerWingOfThree * 100).toFixed(0)}% · 3PA 비중 ${(threeShare * 100).toFixed(0)}%`,
      signals,
    };
  }

  // 3-6. 퓨어 슈터 — 수비/스페이싱 역할 빼고 남은 외곽 시도자
  if (
    threeShare >= TH.pureShooter.threeShareMin &&
    row.threePct >= TH.pureShooter.threePctMin
  ) {
    return {
      label: "퓨어 슈터",
      group: "윙",
      stage: 3,
      tone: "flame",
      reason: `3PA 비중 ${(threeShare * 100).toFixed(0)}% · 3P% ${row.threePct.toFixed(1)}% (${topPct(threePctPctile)}) · USG% ${usgPct.toFixed(1)}%`,
      signals,
    };
  }

  // 3-7. 일반 윙 — default
  return {
    label: "일반 윙",
    group: "윙",
    stage: 3,
    tone: "ink",
    reason: `3PA 비중 ${(threeShare * 100).toFixed(0)}% · 3P% ${row.threePct.toFixed(1)}% · USG% ${usgPct.toFixed(1)}% · ${row.points.toFixed(1)} PPG`,
    signals,
  };
}

function emptySignals(
  games: number,
  minPerG: number,
  height: number | null,
  pos: string | null,
): ArchetypeSignals {
  return {
    games,
    minPerG,
    height,
    pos,
    usgPct: null,
    usgPctile: null,
    astPct: null,
    astPctile: null,
    tsPct: null,
    tsPctile: null,
    rebPct: null,
    rebPctile: null,
    threeShare: null,
    paintShare: null,
    midShare: null,
    cornerWingOfThree: null,
    rimAtt: null,
    rimPct: null,
    ftaRate: null,
    ftaRatePctile: null,
    threePct: null,
    threePctPctile: null,
    blocks: null,
    blkPctile: null,
    steals: null,
    stlPctile: null,
    defActivity: null,
    defActivityPctile: null,
    orebPct: null,
  };
}

// ─── 표시용 tone → tailwind class ───────────────

export function archetypeChipClass(tone: ArchetypeTone): string {
  switch (tone) {
    case "flame":
      return "border-flame-500/30 bg-flame-500/10 text-flame-400";
    case "neon":
      return "border-neon-500/30 bg-neon-500/10 text-neon-400";
    case "hoop":
      return "border-hoop-500/30 bg-hoop-500/10 text-hoop-400";
    case "buzzer":
      return "border-buzzer-500/30 bg-buzzer-500/10 text-buzzer-400";
    case "ink":
    default:
      return "border-court-700 bg-court-800/50 text-ink-300";
  }
}

export function archetypeAccentBar(tone: ArchetypeTone): string {
  switch (tone) {
    case "flame":
      return "bg-flame-500";
    case "neon":
      return "bg-neon-500";
    case "hoop":
      return "bg-hoop-500";
    case "buzzer":
      return "bg-buzzer-500";
    case "ink":
    default:
      return "bg-court-600";
  }
}
