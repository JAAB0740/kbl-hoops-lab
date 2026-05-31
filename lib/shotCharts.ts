/**
 * KBL 슛 차트 — 클라이언트 안전(types + pure helpers).
 *
 * fs 등 server-only API 는 여기서 import 하지 않음.
 * 데이터 로딩 / 시즌 집계는 lib/shotChartsServer.ts 참고 (server-only).
 *
 * 좌표계 (KBL 차트 캔버스 — 약 720×400, FIBA 28m×15m 풀코트):
 *   d="2" → 왼쪽 골대를 향한 슛 (basket at ~ x=60, y=195)
 *   d="1" → 오른쪽 골대를 향한 슛 (basket at ~ x=660, y=195)
 *   팀이 후반에 코트를 바꾸기 때문에 같은 선수의 슛도 쿼터별로 d 가 다름.
 *
 * 정규화(normalizeShot)로 d=1 슛을 mirror 해 모든 슛이 "왼쪽 골대"(60,195) 기준이 되게 변환.
 * 이후 좌표는 player-relative — basket at (60, 195), 베이스라인 x≈20.
 *
 * 스케일: ~25.7 px/m → FIBA 3pt(6.75m) ≈ 173px, paint(4.9×5.8m) ≈ 126×149px.
 */

// ─── 타입 ──────────────────────────────────────────

export type ShotZone =
  | "at_rim"
  | "paint"
  | "midrange"
  | "corner_3"
  | "wing_3"
  | "top_3";

// ─── 방사형 14존 (영역별 야투) ──────────────────────────────
//
// (distance, angle) 기반 wedge 분할 — 모든 zone 이 골대 중심 부채꼴:
//   · 거리 ring: rim < 30, paint < 100, mid < 160, 3pt ≥ 160
//   · 각도 column (mid/3pt — 5 wedge 분할):
//       theta < -CORNER_ANGLE          → 좌 베이스라인/코너
//       -CORNER_ANGLE ~ -WING_ANGLE    → 좌 엘보/윙
//       |theta| ≤ WING_ANGLE           → 정면/탑
//       +WING_ANGLE ~ +CORNER_ANGLE    → 우 엘보/윙
//       theta > +CORNER_ANGLE          → 우 베이스라인/코너
//   · paint (3 wedge): WING_ANGLE 기준만 (좌/정면/우)

export type ShotZoneDetailed =
  | "rim"               // 1.  림 (RA)
  | "paint_left"        // 2.  페인트 좌
  | "paint_center"      // 3.  페인트 정면
  | "paint_right"       // 4.  페인트 우
  | "mid_baseline_top"  // 5.  좌 베이스라인
  | "mid_elbow_top"     // 6.  좌 엘보
  | "mid_center"        // 7.  FT 정면
  | "mid_elbow_bot"     // 8.  우 엘보
  | "mid_baseline_bot"  // 9.  우 베이스라인
  | "corner_3_top"      // 10. 좌 코너 3
  | "wing_3_top"        // 11. 좌 윙 3
  | "top_3_center"      // 12. 탑 3
  | "wing_3_bot"        // 13. 우 윙 3
  | "corner_3_bot";     // 14. 우 코너 3

export const ZONE_DETAILED_LABELS: Record<ShotZoneDetailed, string> = {
  rim:              "림",
  paint_left:       "페인트 좌",
  paint_center:     "페인트 정면",
  paint_right:      "페인트 우",
  mid_baseline_top: "좌 베이스라인",
  mid_elbow_top:    "좌 엘보",
  mid_center:       "FT 정면",
  mid_elbow_bot:    "우 엘보",
  mid_baseline_bot: "우 베이스라인",
  corner_3_top:     "좌 코너 3",
  wing_3_top:       "좌 윙 3",
  top_3_center:     "탑 3",
  wing_3_bot:       "우 윙 3",
  corner_3_bot:     "우 코너 3",
};

/** 14존 디스플레이 순서 (UI 리스트용) */
export const ZONE_DETAILED_ORDER: ShotZoneDetailed[] = [
  "rim",
  "paint_left", "paint_center", "paint_right",
  "mid_baseline_top", "mid_elbow_top", "mid_center", "mid_elbow_bot", "mid_baseline_bot",
  "corner_3_top", "wing_3_top", "top_3_center", "wing_3_bot", "corner_3_bot",
];

export const ZONE_LABELS: Record<ShotZone, string> = {
  at_rim:    "림 근접",
  paint:     "페인트",
  midrange:  "미드레인지",
  corner_3:  "코너 3",
  wing_3:    "윙 3",
  top_3:     "탑 3",
};

/** 정규화된 슛 (왼쪽 골대 기준, basket at 60,195) */
export interface Shot {
  /** player-relative x — basket 기준 좌표 (basket at x≈60) */
  x: number;
  /** player-relative y — basket 기준 좌표 (basket at y≈195) */
  y: number;
  made: boolean;
  quarter: string; // "Q1"~"Q4", "EQ1"…
  zone: ShotZone;
  pcode: string;
  gmkey: string;
}

export interface ZoneStat {
  zone: ShotZone;
  made: number;
  att: number;
  pct: number; // 0~100, 시도 0 이면 0
}

export interface ZoneStatDetailed {
  zone: ShotZoneDetailed;
  made: number;
  att: number;
  pct: number;
}

export interface PlayerShotChart {
  pcode: string;
  totalShots: number;
  totalMade: number;
  fgPct: number;       // 전체 FG% (FT 제외)
  byZone: Record<ShotZone, ZoneStat>;
  /** NBA-classic 14존 (영역별 야투 패널용) */
  byZoneDetailed: Record<ShotZoneDetailed, ZoneStatDetailed>;
  /** 게임 수 (이 선수가 슛 기록을 남긴 경기 수) */
  gamesWithShots: number;
  /** 정규화된 개별 슛 — 코트 dot plot 용 */
  shots: Shot[];
  /** 헥스빈 (Kirk Goldsberry 스타일) — 시도 수로 크기, 리그 zone 평균 대비 효율로 색상 */
  hexBins: HexBin[];
  /** 리그 전체 zone 별 FG% — hex 효율 비교 baseline */
  leagueZoneAvg: Record<ShotZone, number>;
  /** 리그 전체 14존 FG% — 영역별 야투 패널 비교용 (현재 absolute scale 이라 미사용이지만 보존) */
  leagueZoneDetailedAvg: Record<ShotZoneDetailed, number>;
}

/** 헥스빈 — 슛들을 육각 그리드에 binning 한 결과. 한 셀당 통계 + 좌표 + 비교값. */
export interface HexBin {
  /** 축 좌표 (axial). hex 간 충돌 방지용 key. */
  q: number;
  r: number;
  /** 헥스 중심 (player-relative 좌표계). 렌더링/툴팁 위치용. */
  cx: number;
  cy: number;
  att: number;
  made: number;
  pct: number;       // 0~100
  zone: ShotZone;    // 헥스 중심 기준 zone
  zoneAvg: number;   // 리그 평균 FG% (해당 zone)
  diff: number;      // pct - zoneAvg (양수 = 효율 좋음)
}

// ─── 좌표 정규화 / 존 분류 (pure functions, no I/O) ─────

/** 캔버스 너비 — d=1 mirror 용. 좌·우 basket 의 x 합 ≈ 720 (60+660). */
const CANVAS_W = 720;
const BASKET_X = 60;
/** basket-y — 5px 정밀 빈 분석: 위쪽 코너 슛 피크 y=35-40, 아래쪽 피크 y=375 →
 *  중점 ~205. 이전 195 는 30px 코어즈 빈의 한계로 잘못 잡힘. */
const BASKET_Y = 205;

/** KBL 캔버스 스케일 — 데이터 기반 측정.
 *  basket-to-basket 600px / 24.85m = 24.14 px/m.
 *  Top-10 슈터 dist≥160 매칭이 KBL 공식 3PA 와 ±2 안에 들어옴 → 실제 3pt arc r=160.
 *  (FIBA 6.75m 환산은 163 이지만 KBL 캔버스 스케일/캘리는 약간 다름.) */

/** 3pt arc 반경 (px). 데이터 검증 결과 r=160 일 때 KBL 3PA 와 모든 top 슈터 ±2 매칭. */
const THREE_PT_R = 160;
/** 림 영역 반경 (px). **8 feet = 2.44m → 58px** (scale 23.7 px/m, 3pt arc 160px=6.75m 기준).
 *  baseline 까지 거리=40px 이므로 58 은 18px 더 넘어가는데 clipPath 가 자동 컷 → D 모양. */
const RIM_R = 58;
/** 페인트 사각형 (basket 60,205 기준).
 *  FIBA 4.9m × 5.8m, scale 24.14 px/m → 약 118 × 140 px.
 *  baseline x = 20 (visible court 좌측 경계와 일치), FT line x = 162.
 *  paint width 4.9m × 24.14 ≈ 118 → y center 205, half=59 → [146, 264]. */
const PAINT_X = [20, 162] as const;
const PAINT_Y = [146, 264] as const;
/** 코너 3 — arc r=160 + basket-y=205 → arc 가 닿는 코너 직선 y=50/360.
 *  arc-라인 교차점 x ≈ 100 (chord 310 < 2r 320 ✓). */
const CORNER_Y_LOW = 50;   // y < 50: 위쪽 코너 영역
const CORNER_Y_HIGH = 360; // y > 360: 아래쪽 코너 영역
const CORNER_X_MAX = 100;  // arc-라인 교차점 보다 살짝 여유
/** 윙/탑 구분 — basket-y(205) 와의 y 거리 임계값. < TOP_WIDTH → 탑, 이상 → 윙.
 *  80px ≈ 25° wedge (FIBA 3pt arc 기준). 좁은 정면 탑존만 잡고 사이드는 wing. */
const TOP_WIDTH = 80;

/**
 * d="1" 슛은 x 를 mirror 해 왼쪽 골대 기준으로 통일.
 * y 와 made/quarter 는 그대로 유지.
 */
export function normalizeShot(raw: {
  q: string;
  x: number;
  y: number;
  o: string;
  d: string;
}): Pick<Shot, "x" | "y" | "made" | "quarter"> {
  const x = raw.d === "1" ? CANVAS_W - raw.x : raw.x;
  return {
    x,
    y: raw.y,
    made: raw.o === "O",
    quarter: raw.q,
  };
}

/** (x,y) → 6개 존 중 하나. basket-relative (정규화 후 좌표).
 *
 *  중요: 코너 3 는 *거리* 기반이 아니라 *구간* 기반으로 판정 — 코너-3 boundary 는
 *  직선(arc 아님). 사이드라인-코너라인 사이 strip 안이면 거리 무관 corner_3.
 *  예: 백승엽이 (60, 374) 에서 던진 슛 — basket(60,205)으로부터 169 (arc 안)
 *  지만 y>370 이고 x<105 인 strip 에 있어 명백히 corner_3.
 *
 *  탑 vs 윙: arc 밖 (above-break) 슛을 basket-y 와의 y 거리로 구분.
 *  |y-basket_y| < 80 → 정면 좁은 wedge = top_3, 이상 = wing_3.
 */
export function classifyZone(x: number, y: number): ShotZone {
  const dx = x - BASKET_X;
  const dy = y - BASKET_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // 페인트 박스 (베이스라인 ~ FT line, 4.9m 폭)
  const inPaintBox =
    x >= PAINT_X[0] &&
    x <= PAINT_X[1] &&
    y >= PAINT_Y[0] &&
    y <= PAINT_Y[1];

  if (inPaintBox) {
    return dist < RIM_R ? "at_rim" : "paint";
  }
  // 코너 3 strip — 거리 무관. 코너-3 라인이 *직선*이라서 거리만으론 잡히지 않음.
  if (x < CORNER_X_MAX && (y < CORNER_Y_LOW || y > CORNER_Y_HIGH)) {
    return "corner_3";
  }
  // arc 밖 → 탑 / 윙 분리
  if (dist >= THREE_PT_R) {
    return Math.abs(dy) < TOP_WIDTH ? "top_3" : "wing_3";
  }
  // 페인트·코너·arc 어디에도 속하지 않으면 미드레인지
  if (dist < RIM_R) return "at_rim"; // 페인트 밖 림 근접 (안전망)
  return "midrange";
}

// ─── 방사형 14존 분류기 (전부 radial 부채꼴 — paint 도 wedge) ───────

/** 페인트 ring 외측 반경 (basket 으로부터). **16 feet = 4.88m → 116px** (FT 라인 102px 살짝 너머). */
const PAINT_R = 116;
/** 페인트 정면 wedge ±각도 — 정면 ±30° (총 60° span). 좌/우 페인트와 명확히 구분. */
const PAINT_WING_ANGLE = Math.PI / 6;   // 30°
/** 미드 정면(FT 정면)/엘보 분기 각도. */
const MID_WING_ANGLE = Math.PI / 8;     // 22.5°
/** 미드 엘보/베이스라인 분기 각도. */
const MID_CORNER_ANGLE = Math.PI / 3;   // 60°
/** 3pt 탑/윙 분기 각도 — mid 와 정렬. */
const THREE_WING_ANGLE = Math.PI / 8;   // 22.5°

/** (x,y) → 14존. 모든 zone 이 골대 중심 부채꼴.
 *
 *  - 림 (1) — r < RIM_R 큰 원
 *  - 페인트 (3 wedge) — RIM_R < r < PAINT_R, ±π/8 / ±π/2 분할
 *  - 미드 (5 wedge) — PAINT_R < r < THREE_R, ±π/8 / ±π/3 분할
 *  - 코너 3 (2 rect) — corner-3 라인이 직선이므로 사각형 strip
 *  - 3pt (3 wedge) — r > THREE_R, 코너 제외, ±π/8 분할
 */
export function classifyZoneDetailed(x: number, y: number): ShotZoneDetailed {
  const dx = x - BASKET_X;
  const dy = y - BASKET_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // 1. RIM
  if (dist < RIM_R) return "rim";

  // 2. 코너 3 (직사각형 strip)
  if (x < CORNER_X_MAX) {
    if (y < CORNER_Y_LOW) return "corner_3_top";
    if (y > CORNER_Y_HIGH) return "corner_3_bot";
  }

  const theta = Math.atan2(dy, dx);

  // 3. Paint — radial wedge, 3 분할
  if (dist < PAINT_R) {
    if (theta < -PAINT_WING_ANGLE) return "paint_left";
    if (theta > +PAINT_WING_ANGLE) return "paint_right";
    return "paint_center";
  }

  // 4. Mid — 5 wedge
  if (dist < THREE_PT_R) {
    if (theta < -MID_CORNER_ANGLE) return "mid_baseline_top";
    if (theta < -MID_WING_ANGLE)   return "mid_elbow_top";
    if (theta > +MID_CORNER_ANGLE) return "mid_baseline_bot";
    if (theta > +MID_WING_ANGLE)   return "mid_elbow_bot";
    return "mid_center";
  }

  // 5. 3pt — 3 wedge
  if (theta < -THREE_WING_ANGLE) return "wing_3_top";
  if (theta > +THREE_WING_ANGLE) return "wing_3_bot";
  return "top_3_center";
}

/** 좌표계 상수 — 시각화 컴포넌트에서 viewBox/렌더에 사용. */
export const SHOT_CHART_GEOMETRY = {
  CANVAS_W,
  /** 모든 슛이 정규화된 후 사용하는 "half-court" viewBox 폭/높이.
   *  basket 기준 좌측 절반만 보여줌 — x: 0~360, y: 0~395. */
  HALF_W: 360,
  HALF_H: 395,
  BASKET_X,
  BASKET_Y,
  /** 코트 외곽 사이드라인 (위·아래) — basket(y=205) 기준 대칭이 되도록 조정.
   *  KBL 캔버스 원본은 y=5/y=390 (위 200px, 아래 185px) 비대칭이라 위쪽 3pt 영역이 더
   *  넓어 보이는 문제가 있어서, 위 사이드라인을 15px 내려 y=20 으로 맞춤 → 위·아래 185px 대칭.
   *  코트 좌측 베이스라인은 x=20 (basket-to-baseline 40px). */
  TOP_SIDELINE_Y: 20,
  BOT_SIDELINE_Y: 390,
  COURT_L_X: 20,
  THREE_PT_R,
  RIM_R,
  PAINT_X,
  PAINT_Y,
  CORNER_X_MAX,
  CORNER_Y_LOW,
  CORNER_Y_HIGH,
  TOP_WIDTH,
  PAINT_R,
  PAINT_WING_ANGLE,
  MID_WING_ANGLE,
  MID_CORNER_ANGLE,
  THREE_WING_ANGLE,
} as const;

// ─── 헥스빈 (Hexbin) ──────────────────────────────────

/** 헥스 circumradius (px). pointy-top 기준 width = sqrt(3)*HEX_SIZE, height = 2*HEX_SIZE.
 *  16 → 11 (~31% 축소) — 그리드 해상도 ↑, 데이터 입자성 ↑. */
export const HEX_SIZE = 11;
const SQRT3 = Math.sqrt(3);

/** pixel (x,y) → 가장 가까운 hex 의 axial (q,r). pointy-top. */
export function pixelToHex(x: number, y: number): { q: number; r: number } {
  const qf = (SQRT3 / 3 * x - 1 / 3 * y) / HEX_SIZE;
  const rf = (2 / 3 * y) / HEX_SIZE;
  // cube round 으로 정확한 hex 찾기
  const sf = -qf - rf;
  let rq = Math.round(qf);
  let rr = Math.round(rf);
  const rs = Math.round(sf);
  const dq = Math.abs(rq - qf);
  const dr = Math.abs(rr - rf);
  const ds = Math.abs(rs - sf);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

/** axial (q,r) → 헥스 중심 (cx,cy) — pointy-top. */
export function hexCenter(q: number, r: number): { x: number; y: number } {
  const x = HEX_SIZE * (SQRT3 * q + (SQRT3 / 2) * r);
  const y = HEX_SIZE * (3 / 2) * r;
  return { x, y };
}

/** 슛 배열 + 리그 zone 평균 → 헥스빈 배열. */
export function computeHexBins(
  shots: Shot[],
  leagueZoneAvg: Record<ShotZone, number>,
): HexBin[] {
  const byKey = new Map<string, { q: number; r: number; att: number; made: number }>();
  for (const s of shots) {
    const { q, r } = pixelToHex(s.x, s.y);
    const k = `${q},${r}`;
    let b = byKey.get(k);
    if (!b) {
      b = { q, r, att: 0, made: 0 };
      byKey.set(k, b);
    }
    b.att++;
    if (s.made) b.made++;
  }
  const out: HexBin[] = [];
  for (const b of byKey.values()) {
    const { x: cx, y: cy } = hexCenter(b.q, b.r);
    const zone = classifyZone(cx, cy);
    const pct = b.att > 0 ? (b.made / b.att) * 100 : 0;
    const zoneAvg = leagueZoneAvg[zone] ?? 0;
    out.push({
      q: b.q,
      r: b.r,
      cx,
      cy,
      att: b.att,
      made: b.made,
      pct,
      zone,
      zoneAvg,
      diff: pct - zoneAvg,
    });
  }
  // 시도 많은 순으로 정렬 → 작은 hex 가 큰 hex 위에 렌더 (작은 게 잘 보이게)
  out.sort((a, b) => b.att - a.att);
  return out;
}
