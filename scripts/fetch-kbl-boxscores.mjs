/**
 * KBL 박스스코어 (게임별 팀/선수 stats) 자동 fetch
 *
 * 입력:  data/games.json (gmkey 포함)
 * 출력:  data/boxscores.json
 *   {
 *     fetchedAt,
 *     byGmkey: {
 *       "S47G01N184": {
 *         team:    [{ tcode, records }, { tcode, records }],
 *         players: [{ player, records, homeAway, startFlag }, ...]
 *       },
 *       ...
 *     }
 *   }
 *
 * 증분: 이미 fetched 된 gmkey 는 skip (기존 데이터 유지).
 *
 * 실행: npm run fetch:kbl-boxscores
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

const BASE = "https://api.kbl.or.kr/match";

// ─── games.json 로드 ─────────────────────────────────
const gamesFile = "data/games.json";
if (!existsSync(gamesFile)) {
  console.error(`✗ ${gamesFile} 없음 — npm run fetch:kbl-schedule 먼저`);
  process.exit(1);
}
const gamesJson = JSON.parse(readFileSync(gamesFile, "utf-8"));
const allGames = gamesJson.games ?? [];
const finals = allGames.filter((g) => g.status === "final" && g.gmkey);
console.log(`총 final 경기: ${finals.length} / ${allGames.length} (gmkey 보유)`);

if (finals.length === 0) {
  console.error("✗ gmkey 가 있는 final 경기가 없음. fetch:kbl-schedule 다시 돌려서 gmkey 채우기.");
  process.exit(1);
}

// ─── 기존 boxscores 로드 (증분 처리) ────────────────
const outFile = "data/boxscores.json";
let existing = { byGmkey: {} };
if (existsSync(outFile)) {
  try {
    existing = JSON.parse(readFileSync(outFile, "utf-8"));
    if (!existing.byGmkey) existing.byGmkey = {};
  } catch {
    existing = { byGmkey: {} };
  }
}
const existingCount = Object.keys(existing.byGmkey).length;
console.log(`기존 박스스코어: ${existingCount}개`);

const todo = finals.filter((g) => !existing.byGmkey[g.gmkey]);
console.log(`Fetch 대상: ${todo.length}개 (이미 있는 ${existingCount}개 skip)\n`);

if (todo.length === 0) {
  console.log("✓ 모든 final 게임 박스스코어가 이미 있음");
  process.exit(0);
}

// ─── 호출 ───────────────────────────────────────────
async function fetchBox(gmkey) {
  const teamUrl = `${BASE}/${gmkey}/team-record`;
  const playerUrl = `${BASE}/${gmkey}/player-stat`;
  const [teamRes, playerRes] = await Promise.all([
    fetch(teamUrl, { headers: HEADERS }),
    fetch(playerUrl, { headers: HEADERS }),
  ]);
  if (!teamRes.ok || !playerRes.ok) {
    return { error: `team ${teamRes.status} / player ${playerRes.status}` };
  }
  const team = await teamRes.json();
  const players = await playerRes.json();
  return { team, players };
}

let success = 0;
let failed = 0;
const errors = [];

for (let i = 0; i < todo.length; i++) {
  const g = todo[i];
  const prefix = `[${(i + 1).toString().padStart(3, " ")}/${todo.length}] ${g.gmkey}`;
  try {
    const result = await fetchBox(g.gmkey);
    if (result.error) {
      console.log(`${prefix} ✗ ${result.error}`);
      failed++;
      errors.push({ gmkey: g.gmkey, error: result.error });
    } else {
      existing.byGmkey[g.gmkey] = {
        team: result.team,
        players: result.players,
      };
      const pCount = Array.isArray(result.players) ? result.players.length : 0;
      console.log(`${prefix} ✓ team=${result.team?.length ?? 0}, players=${pCount}  (${g.date} ${g.homeShort} vs ${g.awayShort})`);
      success++;
    }
  } catch (err) {
    console.log(`${prefix} ✗ ${err.message}`);
    failed++;
    errors.push({ gmkey: g.gmkey, error: err.message });
  }
  // rate limit
  await new Promise((r) => setTimeout(r, 100));
  // 50개마다 중간 저장
  if ((i + 1) % 50 === 0) {
    saveBoxscores(existing);
    console.log(`  중간 저장 (${i + 1}/${todo.length})`);
  }
}

// ─── 저장 ───────────────────────────────────────────
function saveBoxscores(data) {
  data.fetchedAt = new Date().toISOString();
  data.totalGames = Object.keys(data.byGmkey).length;
  mkdirSync("data", { recursive: true });
  writeFileSync(outFile, JSON.stringify(data, null, 2));
}

saveBoxscores(existing);

console.log(`\n${"━".repeat(60)}`);
console.log(`✓ 성공: ${success}, 실패: ${failed}`);
console.log(`전체 박스스코어: ${Object.keys(existing.byGmkey).length}개`);
console.log(`저장: ${outFile}`);
if (errors.length > 0) {
  console.log(`\n실패 목록:`);
  for (const e of errors.slice(0, 10)) console.log(`  ${e.gmkey}: ${e.error}`);
}
