import boxscoresJson from "../data/boxscores.json";
import gamesJson from "../data/games.json";

/**
 * KBL 박스스코어 데이터 — game-by-game 선수/팀 stats.
 *
 * Endpoints:
 *   /match/{gmkey}/team-record    → Array[2]
 *   /match/{gmkey}/player-stat    → Array[N]
 *
 * Fetch: npm run fetch:kbl-boxscores
 * 저장 형태: data/boxscores.json
 */

export interface BoxRecords {
  // 출장 시간
  playMin: number;
  playSec: number;
  // 득점
  score: number;
  pscore: number;     // ?
  // 야투
  fg: number; fgA: number;          // 2점
  threep: number; threepA: number;  // 3점
  fgt: number; fgtA: number;        // 야투 합산 (FG total)
  ft: number; ftA: number;          // 자유투
  inout: number; inout1: number;    // 페인트존 야투(추정)
  pp: number; ppA: number;          // 페인트득점
  fb: number;                       // 속공득점
  dk: number; dkA: number;          // 덩크
  // 리바운드
  rb: number;                       // 총 리바
  defr: number;                     // 수비 리바
  offr: number;                     // 공격 리바
  // 기타 카운팅
  ast: number;
  stl: number;
  bs: number;                       // 블록샷
  to: number;                       // 턴오버
  foul: number;
  fo?: number;                      // 5반칙 퇴장 (선수)
  // 허슬
  sast: number;                     // 스크린 어시스트
  dfl: number;                      // 디플렉션
  bf?: number;                      // 볼파이트(추정)
  foulout?: number;                 // 5반칙 퇴장 (팀)
  // 팀 단위 전용 필드 (player 응답에는 없음)
  tfb?: number;                     // 팀 패스트브레이크?
  tto?: number;                     // 팀 턴오버?
  teamR?: number;                   // 팀 리바?
  fbScoreCn?: number;               // 속공 득점
  turnoverScoreCn?: number;         // 턴오버 → 득점
  secChanceScoreCn?: number;        // 세컨드 찬스 득점
  benchScoreCn?: number;            // 벤치 득점
  maxContiScoreCn?: number;         // 최다 연속 득점
  maxLeadScoreCn?: number;          // 최다 점수차
  scoreHighTimeCn?: number;
  // 기타
  gd?: number; idf?: number; ef?: number;
  wft?: number; woft?: number;
  marginCn?: number;                // +/- (선수)
  tf?: number;                      // 테크니컬 파울?
  // ─── 어드밴스드 (선수와 팀 둘 다) ───
  offrtg?: number;
  defrtg?: number;
  netrtg?: number;
  efgRt?: number;                   // eFG%
  tsRt?: number;                    // TS%
  astRt?: number;                   // AST%
  astTo?: number;                   // AST/TO
  astRatio?: number;
  orebRt?: number;                  // OREB%
  drebRt?: number;                  // DREB%
  rebRt?: number;                   // REB%
  usgRt?: number;                   // USG% (선수)
  pace?: number;
  tovRt?: number;                   // TOV%
  toRatio?: number;
  per?: number;                     // PER (선수)
  pie?: number;                     // PIE (선수)
  poss?: number;
}

export interface PlayerInfo {
  pcode: string;
  pname: string;
  tcode: string;
  backNum: string;
  pos: string;          // 포지션 (G/F/C/FD 등)
  tname: string;
  playerFlag: string;
  img: string;
  ename: string;
}

export interface PlayerStat {
  player: PlayerInfo;
  records: BoxRecords;
  /** "1" = 홈, "2" = 원정 (KBL API 그대로) */
  homeAway: "1" | "2" | string;
  /** 0 = 벤치, 1 = 선발 */
  startFlag: number;
}

export interface TeamRecord {
  tcode: string;
  records: BoxRecords;
}

export interface BoxScore {
  team: TeamRecord[];     // length 2
  players: PlayerStat[];
}

const RAW_BOX = (boxscoresJson as { byGmkey?: Record<string, BoxScore> }).byGmkey ?? {};

export function getBoxScore(gmkey: string | undefined): BoxScore | null {
  if (!gmkey) return null;
  return RAW_BOX[gmkey] ?? null;
}

export const HAS_BOXSCORES = Object.keys(RAW_BOX).length > 0;
export const BOXSCORE_COUNT = Object.keys(RAW_BOX).length;

/** playMin + playSec 을 초로 변환 */
export function totalSeconds(r: BoxRecords): number {
  return (r.playMin ?? 0) * 60 + (r.playSec ?? 0);
}

/** "MM:SS" 표기 */
export function fmtMinSec(r: BoxRecords): string {
  const m = r.playMin ?? 0;
  const s = r.playSec ?? 0;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── gmkey → date+time 매핑 (선수 cutoff 계산용) ───

type GameLite = {
  gmkey?: string;
  date: string;
  time: string;
  tag: string;
  homeShort: string;
  awayShort: string;
};
const GAMES = (gamesJson as { games?: GameLite[] }).games ?? [];
const GMKEY_DATE = new Map<string, string>(); // gmkey → "YYYY-MM-DDHH:MM"
for (const g of GAMES) {
  if (g.gmkey) GMKEY_DATE.set(g.gmkey, g.date + (g.time ?? "00:00"));
}

/**
 * 특정 시점 이전(<)까지의 선수 누적 평균.
 * pcode 로 찾고, 박스스코어 데이터에서 해당 시점 이전의 모든 게임을 합산.
 *
 * 출장 게임이 N=0 이면 null 반환.
 */
export interface PlayerSeasonAvg {
  games: number;
  ppg: number;
  rpg: number;
  oRpg: number;
  dRpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fpg: number;             // 파울/G
  mpg: number;             // 분/G
  fgPct: number;           // %
  threePct: number;        // %
  ftPct: number;           // %
}

/**
 * 한 선수의 모든 출장 게임 박스스코어 (시간순).
 * 게임 메타(date, opponent, home/away, win/loss) + records.
 */
export interface PlayerGameLogEntry {
  gmkey: string;
  date: string;     // YYYY-MM-DD
  time: string;
  tag: string;
  isHome: boolean;
  opponent: string; // shortName
  myScore: number;
  oppScore: number;
  result: "W" | "L";
  records: BoxRecords;
  startFlag: number;
}

export function playerGameLog(pcode: string): PlayerGameLogEntry[] {
  const out: PlayerGameLogEntry[] = [];
  for (const [gmkey, box] of Object.entries(RAW_BOX)) {
    const ps = box.players?.find((p) => p.player?.pcode === pcode);
    if (!ps) continue;
    if (totalSeconds(ps.records) <= 0) continue; // DNP 제외
    const game = GAMES.find((g) => g.gmkey === gmkey);
    if (!game) continue;
    // homeAway "1" = 홈, "2" = 원정
    const isHome = String(ps.homeAway) === "1";
    // 팀 score = box.team 의 자기 tcode
    const myTcode = ps.player.tcode;
    const myTeam = box.team.find((t) => t.tcode === myTcode);
    const oppTeam = box.team.find((t) => t.tcode !== myTcode);
    const myScore = myTeam?.records?.score ?? 0;
    const oppScore = oppTeam?.records?.score ?? 0;
    const opponent = isHome ? game.awayShort : game.homeShort;
    out.push({
      gmkey,
      date: game.date,
      time: game.time,
      tag: game.tag,
      isHome,
      opponent,
      myScore,
      oppScore,
      result: myScore > oppScore ? "W" : "L",
      records: ps.records,
      startFlag: Number(ps.startFlag) || 0,
    });
  }
  // 날짜 desc (최신부터)
  out.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return out;
}

export function playerStatsBefore(
  pcode: string,
  beforeDate: string,
  beforeTime?: string,
): PlayerSeasonAvg | null {
  const cutoff = beforeDate + (beforeTime ?? "99:99");

  let games = 0;
  let pts = 0, reb = 0, oReb = 0, dReb = 0;
  let ast = 0, stl = 0, blk = 0, to = 0, foul = 0;
  let secs = 0;
  let fgM = 0, fgA = 0;
  let tpM = 0, tpA = 0;
  let ftM = 0, ftA = 0;

  for (const [gmkey, box] of Object.entries(RAW_BOX)) {
    const dt = GMKEY_DATE.get(gmkey);
    if (!dt) continue;
    if (dt >= cutoff) continue;
    const ps = box.players?.find((p) => p.player?.pcode === pcode);
    if (!ps) continue;
    // 출전 0초 (DNP) 인 경우 출장 게임에 안 셈
    const sec = totalSeconds(ps.records);
    if (sec <= 0) continue;
    games++;
    pts  += ps.records.score ?? 0;
    reb  += ps.records.rb ?? 0;
    oReb += ps.records.offr ?? 0;
    dReb += ps.records.defr ?? 0;
    ast  += ps.records.ast ?? 0;
    stl  += ps.records.stl ?? 0;
    blk  += ps.records.bs ?? 0;
    to   += ps.records.to ?? 0;
    foul += ps.records.foul ?? 0;
    secs += sec;
    fgM  += ps.records.fgt ?? 0;
    fgA  += ps.records.fgtA ?? 0;
    tpM  += ps.records.threep ?? 0;
    tpA  += ps.records.threepA ?? 0;
    ftM  += ps.records.ft ?? 0;
    ftA  += ps.records.ftA ?? 0;
  }

  if (games === 0) return null;
  return {
    games,
    ppg: pts / games,
    rpg: reb / games,
    oRpg: oReb / games,
    dRpg: dReb / games,
    apg: ast / games,
    spg: stl / games,
    bpg: blk / games,
    topg: to / games,
    fpg: foul / games,
    mpg: secs / 60 / games,
    fgPct: fgA > 0 ? (fgM / fgA) * 100 : 0,
    threePct: tpA > 0 ? (tpM / tpA) * 100 : 0,
    ftPct: ftA > 0 ? (ftM / ftA) * 100 : 0,
  };
}

/**
 * 특정 시점 이전까지 활동한 한 팀의 모든 선수 명단 + 누적 평균.
 * "주목할 선수" 픽 같은 용도.
 */
export function teamPlayersBefore(
  teamShort: string,
  beforeDate: string,
  beforeTime?: string,
  minGames = 3,
): { player: PlayerInfo; avg: PlayerSeasonAvg }[] {
  const cutoff = beforeDate + (beforeTime ?? "99:99");
  const byPcode = new Map<string, { info: PlayerInfo; cum: PlayerSeasonAvg & { _pts: number; _reb: number; _oReb: number; _dReb: number; _ast: number; _stl: number; _blk: number; _to: number; _foul: number; _secs: number; _fgM: number; _fgA: number; _tpM: number; _tpA: number; _ftM: number; _ftA: number } }>();

  for (const [gmkey, box] of Object.entries(RAW_BOX)) {
    const dt = GMKEY_DATE.get(gmkey);
    if (!dt) continue;
    if (dt >= cutoff) continue;
    for (const ps of box.players ?? []) {
      // 팀 매칭: tname 풀네임에 teamShort 가 들어있는지
      if (!ps.player.tname.includes(teamShort) && ps.player.tname !== teamShort) continue;
      const sec = totalSeconds(ps.records);
      if (sec <= 0) continue;
      const pcode = ps.player.pcode;
      const slot =
        byPcode.get(pcode) ??
        {
          info: ps.player,
          cum: {
            games: 0,
            ppg: 0, rpg: 0, oRpg: 0, dRpg: 0, apg: 0, spg: 0, bpg: 0, topg: 0, fpg: 0, mpg: 0,
            fgPct: 0, threePct: 0, ftPct: 0,
            _pts: 0, _reb: 0, _oReb: 0, _dReb: 0, _ast: 0, _stl: 0, _blk: 0, _to: 0, _foul: 0, _secs: 0,
            _fgM: 0, _fgA: 0, _tpM: 0, _tpA: 0, _ftM: 0, _ftA: 0,
          },
        };
      slot.cum.games++;
      slot.cum._pts  += ps.records.score ?? 0;
      slot.cum._reb  += ps.records.rb ?? 0;
      slot.cum._oReb += ps.records.offr ?? 0;
      slot.cum._dReb += ps.records.defr ?? 0;
      slot.cum._ast  += ps.records.ast ?? 0;
      slot.cum._stl  += ps.records.stl ?? 0;
      slot.cum._blk  += ps.records.bs ?? 0;
      slot.cum._to   += ps.records.to ?? 0;
      slot.cum._foul += ps.records.foul ?? 0;
      slot.cum._secs += sec;
      slot.cum._fgM  += ps.records.fgt ?? 0;
      slot.cum._fgA  += ps.records.fgtA ?? 0;
      slot.cum._tpM  += ps.records.threep ?? 0;
      slot.cum._tpA  += ps.records.threepA ?? 0;
      slot.cum._ftM  += ps.records.ft ?? 0;
      slot.cum._ftA  += ps.records.ftA ?? 0;
      byPcode.set(pcode, slot);
    }
  }

  const out: { player: PlayerInfo; avg: PlayerSeasonAvg }[] = [];
  for (const [, slot] of byPcode) {
    const g = slot.cum.games;
    if (g < minGames) continue;
    out.push({
      player: slot.info,
      avg: {
        games: g,
        ppg: slot.cum._pts / g,
        rpg: slot.cum._reb / g,
        oRpg: slot.cum._oReb / g,
        dRpg: slot.cum._dReb / g,
        apg: slot.cum._ast / g,
        spg: slot.cum._stl / g,
        bpg: slot.cum._blk / g,
        topg: slot.cum._to / g,
        fpg: slot.cum._foul / g,
        mpg: slot.cum._secs / 60 / g,
        fgPct: slot.cum._fgA > 0 ? (slot.cum._fgM / slot.cum._fgA) * 100 : 0,
        threePct: slot.cum._tpA > 0 ? (slot.cum._tpM / slot.cum._tpA) * 100 : 0,
        ftPct: slot.cum._ftA > 0 ? (slot.cum._ftM / slot.cum._ftA) * 100 : 0,
      },
    });
  }
  return out;
}
