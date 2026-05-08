/**
 * KBL 게임 상세 (쿼터 스코어 + 관중 수 + 심판) fetch
 *
 * Endpoint: GET https://api.kbl.or.kr/match/{gmkey}
 *   응답의 teamrecords.home / teamrecords.away 안에
 *   scoreq1~q4 + scoreeq[] (연장) 가 있음.
 *
 * 출력: data/match-details.json
 *   { fetchedAt, byGmkey: { [gmkey]: { home: [..], away: [..], homeEq: [..], awayEq: [..], crowds, gameStart, gameEnd } } }
 *
 * 전략: data/games.json 의 status=final 경기만 호출 (예정·취소 제외).
 *       이미 받은 항목은 skip 옵션 가능 (FORCE=1 환경변수로 강제 재호출).
 *
 * 실행: npm run fetch:kbl-match-detail
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
  Channel: "WEB",
  TeamCode: "",
};

const OUT_PATH = "data/match-details.json";
const GAMES_PATH = "data/games.json";
const FORCE = process.env.FORCE === "1";

if (!existsSync(GAMES_PATH)) {
  console.error("✗ data/games.json 없음 — npm run fetch:kbl-schedule 먼저 실행");
  process.exit(1);
}

const gamesJson = JSON.parse(readFileSync(GAMES_PATH, "utf-8"));
const games = gamesJson.games ?? [];
const finals = games.filter((g) => g.status === "final" && g.gmkey);
console.log(`총 ${games.length}경기 / 종료 ${finals.length}경기`);

// 기존 캐시 읽기
let existing = {};
if (existsSync(OUT_PATH) && !FORCE) {
  try {
    const prev = JSON.parse(readFileSync(OUT_PATH, "utf-8"));
    existing = prev.byGmkey ?? {};
    console.log(`기존 캐시: ${Object.keys(existing).length}개 (FORCE=1 로 무시 가능)`);
  } catch {
    console.log("기존 파일 파싱 실패 — 새로 시작");
  }
}

const out = { ...existing };
let fetched = 0;
let skipped = 0;
let failed = 0;

for (const g of finals) {
  if (out[g.gmkey] && !FORCE) {
    // 이미 캐시 있고 쿼터 데이터도 채워졌으면 skip
    if (out[g.gmkey].home && out[g.gmkey].home.length > 0) {
      skipped++;
      continue;
    }
  }

  const url = `https://api.kbl.or.kr/match/${g.gmkey}`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.log(`  ✗ ${g.gmkey} (${g.date}) — HTTP ${res.status}`);
      failed++;
      continue;
    }
    const json = await res.json();
    const tr = json?.teamrecords;
    const game = json?.game;
    if (!tr) {
      console.log(`  ⚠ ${g.gmkey} — teamrecords 없음`);
      failed++;
      continue;
    }

    out[g.gmkey] = {
      home: [tr.home?.scoreq1 ?? 0, tr.home?.scoreq2 ?? 0, tr.home?.scoreq3 ?? 0, tr.home?.scoreq4 ?? 0],
      away: [tr.away?.scoreq1 ?? 0, tr.away?.scoreq2 ?? 0, tr.away?.scoreq3 ?? 0, tr.away?.scoreq4 ?? 0],
      homeEq: Array.isArray(tr.home?.scoreeq) ? tr.home.scoreeq : [],
      awayEq: Array.isArray(tr.away?.scoreeq) ? tr.away.scoreeq : [],
      crowds: game?.crowds ?? null,
      gameStart: game?.gameStart ?? null, // "1900" → 19:00
      gameEnd: game?.gameEnd ?? null,     // "2101" → 21:01
    };
    fetched++;
    if (fetched % 30 === 0) console.log(`  ... ${fetched}건 fetch`);
    // KBL 서버 부담 줄이기 위해 약간 sleep
    await new Promise((r) => setTimeout(r, 80));
  } catch (err) {
    console.log(`  ✗ ${g.gmkey} — ${err.message}`);
    failed++;
  }
}

mkdirSync("data", { recursive: true });
writeFileSync(
  OUT_PATH,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "https://api.kbl.or.kr/match/{gmkey}",
      total: Object.keys(out).length,
      byGmkey: out,
    },
    null,
    2,
  ),
);

console.log(`\n✓ ${OUT_PATH} 저장 (총 ${Object.keys(out).length}경기)`);
console.log(`  새로 fetch: ${fetched} · skip: ${skipped} · 실패: ${failed}`);
if (fetched > 0) {
  // 마지막 fetch 한 sample 출력
  const last = Object.entries(out).at(-1);
  if (last) {
    console.log(`\n  샘플 — ${last[0]}: home ${last[1].home.join("/")} (총 ${last[1].home.reduce((a, b) => a + b, 0)}) · away ${last[1].away.join("/")} (총 ${last[1].away.reduce((a, b) => a + b, 0)})`);
  }
}
