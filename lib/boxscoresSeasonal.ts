/**
 * 시즌별 박스스코어 로더 — /players/season/[code]/[id] 상세 페이지에서 사용.
 *
 * lib/boxscores.ts 는 현재 시즌(49) 을 모듈 로드 시 import 하도록 되어 있어서
 * 과거 시즌 상세용으로 fs 기반 병렬 로더를 둔다.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  BoxRecords,
  BoxScore,
  PlayerGameLogEntry,
  PlayerInfo,
  PlayerSeasonAvg,
} from "./boxscores";
import { totalSeconds } from "./boxscores";
import type { RawGame } from "./gamesUtil";

type SeasonBox = {
  byGmkey: Record<string, BoxScore>;
  games: RawGame[];
};

const CACHE = new Map<string, SeasonBox>();

function loadSeason(seasonCode: string): SeasonBox {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const base = path.join(process.cwd(), "data", "season", seasonCode);
  let byGmkey: Record<string, BoxScore> = {};
  let games: RawGame[] = [];
  try {
    const rawBox = fs.readFileSync(path.join(base, "boxscores.json"), "utf-8");
    byGmkey = (JSON.parse(rawBox) as { byGmkey?: Record<string, BoxScore> }).byGmkey ?? {};
  } catch {
    byGmkey = {};
  }
  try {
    const rawGames = fs.readFileSync(path.join(base, "games.json"), "utf-8");
    games = (JSON.parse(rawGames) as { games?: RawGame[] }).games ?? [];
  } catch {
    games = [];
  }
  const out: SeasonBox = { byGmkey, games };
  CACHE.set(seasonCode, out);
  return out;
}

/** 특정 시즌에서 한 선수의 모든 출장 게임 로그. */
export function playerGameLogForSeason(
  seasonCode: string,
  pcode: string,
): PlayerGameLogEntry[] {
  const { byGmkey, games } = loadSeason(seasonCode);
  const out: PlayerGameLogEntry[] = [];
  for (const [gmkey, box] of Object.entries(byGmkey)) {
    const ps = box.players?.find((p) => p.player?.pcode === pcode);
    if (!ps) continue;
    if (totalSeconds(ps.records as BoxRecords) <= 0) continue;
    const game = games.find((g) => g.gmkey === gmkey);
    if (!game) continue;
    const isHome = String(ps.homeAway) === "1";
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
  out.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  return out;
}

/** 지정 시즌의 gmkey → 박스스코어. 없으면 null. */
export function getBoxScoreForSeason(
  seasonCode: string,
  gmkey: string | undefined,
): BoxScore | null {
  if (!gmkey) return null;
  const { byGmkey } = loadSeason(seasonCode);
  return byGmkey[gmkey] ?? null;
}

/** 지정 시즌에서 특정 시점 이전까지의 팀 선수 명단 + 누적 평균. */
export function teamPlayersBeforeForSeason(
  seasonCode: string,
  teamShort: string,
  beforeDate: string,
  beforeTime?: string,
  minGames = 3,
): { player: PlayerInfo; avg: PlayerSeasonAvg }[] {
  const { byGmkey, games } = loadSeason(seasonCode);
  const gmkeyDate = new Map<string, string>();
  for (const g of games) {
    if (g.gmkey) gmkeyDate.set(g.gmkey, g.date + (g.time ?? "00:00"));
  }
  const cutoff = beforeDate + (beforeTime ?? "99:99");

  type Slot = {
    info: PlayerInfo;
    cum: PlayerSeasonAvg & {
      _pts: number; _reb: number; _oReb: number; _dReb: number;
      _ast: number; _stl: number; _blk: number; _to: number; _foul: number;
      _secs: number; _fgM: number; _fgA: number;
      _tpM: number; _tpA: number; _ftM: number; _ftA: number;
    };
  };
  const byPcode = new Map<string, Slot>();

  for (const [gmkey, box] of Object.entries(byGmkey)) {
    const dt = gmkeyDate.get(gmkey);
    if (!dt) continue;
    if (dt >= cutoff) continue;
    for (const ps of box.players ?? []) {
      if (!ps.player.tname.includes(teamShort) && ps.player.tname !== teamShort) continue;
      const sec = totalSeconds(ps.records as BoxRecords);
      if (sec <= 0) continue;
      const pcode = ps.player.pcode;
      const slot: Slot =
        byPcode.get(pcode) ?? {
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

/** 지정 시즌의 games 배열 — findGameById / standingsAsOf 등에 games arg 로 넘김. */
export function getSeasonGames(seasonCode: string) {
  return loadSeason(seasonCode).games;
}
