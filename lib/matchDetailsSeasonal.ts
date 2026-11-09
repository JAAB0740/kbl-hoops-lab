/**
 * 시즌별 match-details 로더 — /games/season/[code]/[id] 상세 페이지용.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { MatchDetail } from "./matchDetails";

type MatchDetailsFile = {
  fetchedAt?: string | null;
  byGmkey?: Record<string, MatchDetail>;
};

const CACHE = new Map<string, MatchDetailsFile>();

function loadMatchDetails(seasonCode: string): MatchDetailsFile {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const p = path.join(process.cwd(), "data", "season", seasonCode, "match-details.json");
  let out: MatchDetailsFile = { byGmkey: {} };
  try {
    out = JSON.parse(fs.readFileSync(p, "utf-8")) as MatchDetailsFile;
  } catch {
    out = { byGmkey: {} };
  }
  CACHE.set(seasonCode, out);
  return out;
}

export function getMatchDetailForSeason(
  seasonCode: string,
  gmkey: string | undefined,
): MatchDetail | null {
  if (!gmkey) return null;
  return loadMatchDetails(seasonCode).byGmkey?.[gmkey] ?? null;
}
