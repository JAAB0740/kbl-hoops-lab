/**
 * KBL API fetcher v3 — 정규리그 기반 + 전체/홈/원정 + 1~6라운드
 *
 * 출력: data/team-filtered.json
 *   평면 구조: { filters: { all, home, away, r1, r2, r3, r4, r5, r6 } }
 *   모두 gameCode=01 (정규리그만, 팀당 54경기 기준)
 *
 * 실행: npm run fetch:kbl-api
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

// ─── Head-to-Head 타이브레이커 ─────────────────────────
// games.json 의 정규시즌 결과로 모든 팀 쌍의 head-to-head 계산
// 동률 시 KBL 공식 순서: 승률 → 승수 → 상대전적 승수 → 상대전적 득실차
function loadHeadToHead() {
  const path = "data/games.json";
  if (!existsSync(path)) return null;
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    const games = (data.games || []).filter(
      (g) => g.status === "final" && g.tag === "정규리그"
    );
    /** Map<"A|B", { aWins, bWins, aPts, bPts }>  (A,B sorted alphabetically) */
    const h2h = new Map();
    for (const g of games) {
      const A = g.homeShort, B = g.awayShort;
      if (!A || !B) continue;
      const [k1, k2] = [A, B].sort();
      const key = `${k1}|${k2}`;
      if (!h2h.has(key)) h2h.set(key, { aWins: 0, bWins: 0, aPts: 0, bPts: 0 });
      const rec = h2h.get(key);
      const aIsHome = A === k1;
      const aScore = aIsHome ? g.homeScore : g.awayScore;
      const bScore = aIsHome ? g.awayScore : g.homeScore;
      rec.aPts += aScore; rec.bPts += bScore;
      if (aScore > bScore) rec.aWins++;
      else rec.bWins++;
    }
    return h2h;
  } catch (err) {
    console.log(`  ⚠ head-to-head 계산 실패: ${err.message}`);
    return null;
  }
}

/** 두 팀 사이 head-to-head 비교: 양수 = a 우위 */
function compareH2H(h2h, a, b) {
  if (!h2h) return 0;
  const [k1, k2] = [a.shortName, b.shortName].sort();
  const rec = h2h.get(`${k1}|${k2}`);
  if (!rec) return 0;
  const aIsK1 = a.shortName === k1;
  const aWins = aIsK1 ? rec.aWins : rec.bWins;
  const bWins = aIsK1 ? rec.bWins : rec.aWins;
  if (aWins !== bWins) return aWins - bWins;
  const aDiff = aIsK1 ? rec.aPts - rec.bPts : rec.bPts - rec.aPts;
  return aDiff;
}

const BASE = "https://api-stats.kbl.or.kr/api/records/team/general/traditional";
const COMMON = {
  seasonCode: "47",
  gameCode: "01",            // 정규리그만 (PO/챔결 제외)
  sortDataSc: "WIN_A",
  sortOrderSc: "desc",
  perCn: "1",                // 경기당 평균
  lastCn: "0",
  draftNo: "0",
};

function buildUrl(extra) {
  const p = { ...COMMON, ...extra };
  return BASE + "?" + Object.entries(p).map(([k, v]) => `${k}=${v}`).join("&");
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
};

const TEAM_SHORT_MAP = {
  LG: "LG",
  "JUNG KWAN JANG": "정관장",
  JUNGKWANJANG: "정관장",
  KGC: "정관장",
  DB: "DB",
  SK: "SK",
  SONO: "소노",
  KCC: "KCC",
  KT: "KT",
  "HYUNDAI MOBIS": "현대모비스",
  HYUNDAIMOBIS: "현대모비스",
  HD: "현대모비스",
  KOGAS: "가스공사",
  PEGA: "가스공사",
  KG: "가스공사",
  SAMSUNG: "삼성",
  SS: "삼성",
};

function toKoreanShort(teamName4) {
  const s = String(teamName4 ?? "").trim();
  return TEAM_SHORT_MAP[s] ?? null;
}

function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k];
  }
  return 0;
}

function normalizeRow(row) {
  const short = toKoreanShort(row.teamName4);
  return {
    rank: row.rankNo ?? 0,
    code: row.teamCode,
    name: row.teamName1,
    shortName: short,
    partIfList: "0",  // 회사 네트워크 MITM 대응 대응값 (안 쓰지만 디폴트)
    games: pick(row, "gameCount"),
    wins: pick(row, "win"),
    losses: pick(row, "lose"),
    winPct: (pick(row, "winA") ?? 0) / 100,
    stats: {
      points:    pick(row, "score"),
      assists:   pick(row, "aS"),
      rebounds:  pick(row, "rb"),
      oReb:      pick(row, "oR"),
      dReb:      pick(row, "dR"),
      steals:    pick(row, "sT"),
      blocks:    pick(row, "bS"),
      fgMade:    pick(row, "fg"),
      fgAtt:     pick(row, "fgA"),
      fgPct:     pick(row, "fgRt"),
      threeMade: pick(row, "threep"),
      threeAtt:  pick(row, "threepA"),
      threePct:  pick(row, "threepRt"),
      ftMade:    pick(row, "ft"),
      ftAtt:     pick(row, "ftA"),
      ftPct:     pick(row, "ftRt"),
      turnovers: pick(row, "tO"),
      fouls:     pick(row, "foulTot"),
      margin:    pick(row, "margin"),
    },
  };
}

async function fetchOne(label, params, h2h) {
  const url = buildUrl(params);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.log(`  ${label.padEnd(10)} ✗ HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const raw = json.data || [];
    const teams = raw
      .filter((t) => toKoreanShort(t.teamName4))
      .map(normalizeRow);
    // 승률 → 승수 → head-to-head (KBL 공식 타이브레이커)
    teams.sort((a, b) => {
      const dPct = b.winPct - a.winPct;
      if (Math.abs(dPct) > 1e-9) return dPct;
      const dW = b.wins - a.wins;
      if (dW !== 0) return dW;
      return compareH2H(h2h, b, a); // h2h: 우위 팀이 위로 (b 기준 양수)
    });
    teams.forEach((t, i) => (t.rank = i + 1));
    console.log(`  ${label.padEnd(10)} ✓ ${teams.length}팀`);
    return teams;
  } catch (err) {
    console.log(`  ${label.padEnd(10)} ✗ ${err.message}`);
    return [];
  }
}

// ─── 실행 ─────────────────────────────────────────

const FETCHES = [
  // 기본
  { key: "all",  label: "전체",     params: {} },
  { key: "home", label: "홈",       params: { homeAwaySc: "1" } },
  { key: "away", label: "원정",     params: { homeAwaySc: "2" } },
  // 라운드
  { key: "r1",   label: "1라운드",  params: { partSc: "ROUND", partIfList: "1" } },
  { key: "r2",   label: "2라운드",  params: { partSc: "ROUND", partIfList: "2" } },
  { key: "r3",   label: "3라운드",  params: { partSc: "ROUND", partIfList: "3" } },
  { key: "r4",   label: "4라운드",  params: { partSc: "ROUND", partIfList: "4" } },
  { key: "r5",   label: "5라운드",  params: { partSc: "ROUND", partIfList: "5" } },
  { key: "r6",   label: "6라운드",  params: { partSc: "ROUND", partIfList: "6" } },
  // 쿼터
  { key: "q1",   label: "1쿼터",   params: { quarterSc: "Q1" } },
  { key: "q2",   label: "2쿼터",   params: { quarterSc: "Q2" } },
  { key: "q3",   label: "3쿼터",   params: { quarterSc: "Q3" } },
  { key: "q4",   label: "4쿼터",   params: { quarterSc: "Q4" } },
  // 전후반
  { key: "h1",   label: "전반",     params: { quarterSc: "Q1,Q2" } },
  { key: "h2",   label: "후반",     params: { quarterSc: "Q3,Q4" } },
  // 플레이오프 (gameCode=03 override)
  { key: "po",   label: "PO",       params: { gameCode: "03" } },
  // 홈 × 라운드
  { key: "home_r1", label: "홈 R1",  params: { homeAwaySc: "1", partSc: "ROUND", partIfList: "1" } },
  { key: "home_r2", label: "홈 R2",  params: { homeAwaySc: "1", partSc: "ROUND", partIfList: "2" } },
  { key: "home_r3", label: "홈 R3",  params: { homeAwaySc: "1", partSc: "ROUND", partIfList: "3" } },
  { key: "home_r4", label: "홈 R4",  params: { homeAwaySc: "1", partSc: "ROUND", partIfList: "4" } },
  { key: "home_r5", label: "홈 R5",  params: { homeAwaySc: "1", partSc: "ROUND", partIfList: "5" } },
  { key: "home_r6", label: "홈 R6",  params: { homeAwaySc: "1", partSc: "ROUND", partIfList: "6" } },
  // 원정 × 라운드
  { key: "away_r1", label: "원정 R1", params: { homeAwaySc: "2", partSc: "ROUND", partIfList: "1" } },
  { key: "away_r2", label: "원정 R2", params: { homeAwaySc: "2", partSc: "ROUND", partIfList: "2" } },
  { key: "away_r3", label: "원정 R3", params: { homeAwaySc: "2", partSc: "ROUND", partIfList: "3" } },
  { key: "away_r4", label: "원정 R4", params: { homeAwaySc: "2", partSc: "ROUND", partIfList: "4" } },
  { key: "away_r5", label: "원정 R5", params: { homeAwaySc: "2", partSc: "ROUND", partIfList: "5" } },
  { key: "away_r6", label: "원정 R6", params: { homeAwaySc: "2", partSc: "ROUND", partIfList: "6" } },
];

console.log(`[1/2] KBL API 수집 — 정규리그 기준 (gameCode=01)`);
console.log(`   총 ${FETCHES.length}개 필터 호출`);

// 쿼터/전후반은 W/L이 시즌 전체와 동일해서 순위 의미 없음
// → 해당 시간대 PPG 기준으로 재정렬
const PPG_SORT_KEYS = new Set(["q1", "q2", "q3", "q4", "h1", "h2"]);

// games.json 에서 head-to-head 사전 계산 (정규시즌만)
const H2H = loadHeadToHead();
if (H2H) console.log(`   head-to-head 사전 계산: ${H2H.size}개 매치업 (KBL 공식 타이브레이커)`);

const results = {};
for (const f of FETCHES) {
  const teams = await fetchOne(f.label, f.params, H2H);
  if (PPG_SORT_KEYS.has(f.key)) {
    teams.sort((a, b) => b.stats.points - a.stats.points);
    teams.forEach((t, i) => (t.rank = i + 1));
  }
  results[f.key] = teams;
  await new Promise((r) => setTimeout(r, 200));
}

// ─── 요약 ─────────────────────────────────────────
console.log(`\n[2/2] 요약`);

function summarize(label, arr) {
  if (arr.length === 0) return;
  console.log(`\n── ${label} ${"─".repeat(50 - label.length)}`);
  console.log(`  팀        rank  W  L  승률     PPG   RPG   APG`);
  for (const t of arr.slice(0, 3)) {
    console.log(
      `  ${t.shortName.padEnd(8)}  ${String(t.rank).padStart(4)}  ${String(t.wins).padStart(2)} ${String(t.losses).padStart(2)}  ${(t.winPct * 100).toFixed(1).padStart(5)}%  ${t.stats.points.toFixed(1).padStart(5)}  ${t.stats.rebounds.toFixed(1).padStart(5)}  ${t.stats.assists.toFixed(1).padStart(5)}`
    );
  }
  if (arr.length > 3) console.log(`  ... (총 ${arr.length}팀)`);
}

for (const f of FETCHES) {
  summarize(f.label, results[f.key]);
}

// ─── 저장 ─────────────────────────────────────────
mkdirSync("data", { recursive: true });
writeFileSync(
  "data/team-filtered.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "kbl.or.kr API (api-stats.kbl.or.kr)",
      gameCode: "01 (정규리그)",
      filters: results,
    },
    null,
    2
  )
);

console.log(`\n✓ data/team-filtered.json 저장 (${Object.keys(results).length}개 필터)`);
const sample = results.all[0];
if (sample) console.log(`  샘플 — 정규리그 전체 1위: ${sample.name} ${sample.wins}승 ${sample.losses}패`);
