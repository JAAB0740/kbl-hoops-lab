/**
 * 시즌별 박스스코어 로더 — /players/season/[code]/[id] 상세 페이지에서 사용.
 *
 * lib/boxscores.ts 는 현재 시즌(49) 을 모듈 로드 시 import 하도록 되어 있어서
 * 과거 시즌 상세용으로 fs 기반 병렬 로더를 둔다.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { BoxRecords, BoxScore, PlayerGameLogEntry } from "./boxscores";
import { totalSeconds } from "./boxscores";

type GameLite = {
  gmkey?: string;
  date: string;
  time: string;
  tag: string;
  homeShort: string;
  awayShort: string;
};

type SeasonBox = {
  byGmkey: Record<string, BoxScore>;
  games: GameLite[];
};

const CACHE = new Map<string, SeasonBox>();

function loadSeason(seasonCode: string): SeasonBox {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const base = path.join(process.cwd(), "data", "season", seasonCode);
  let byGmkey: Record<string, BoxScore> = {};
  let games: GameLite[] = [];
  try {
    const rawBox = fs.readFileSync(path.join(base, "boxscores.json"), "utf-8");
    byGmkey = (JSON.parse(rawBox) as { byGmkey?: Record<string, BoxScore> }).byGmkey ?? {};
  } catch {
    byGmkey = {};
  }
  try {
    const rawGames = fs.readFileSync(path.join(base, "games.json"), "utf-8");
    games = (JSON.parse(rawGames) as { games?: GameLite[] }).games ?? [];
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
