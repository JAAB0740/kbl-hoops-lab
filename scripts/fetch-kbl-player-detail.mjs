/**
 * KBL 선수 detail 자동 fetch
 *
 * 출력: data/players-detail.json
 *   {
 *     fetchedAt,
 *     splits: {
 *       regularSeason: [...],     // 시즌 평균 (정규)
 *       regularTotal: [...],      // 시즌 합산
 *       playoff: [...],            // PO 시즌 평균
 *       round: { r1: [...], r2: [...], ..., r6: [...] }
 *     }
 *   }
 *
 * 실행: npm run fetch:kbl-player
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
  Channel: "WEB",
  TeamCode: "",
};

const BASE = "https://api-stats.kbl.or.kr/api/records/player/general/traditional";
const COMMON = {
  seasonCode: "47",
  perCn: "1",      // 1=평균, 0=합산
  lastCn: "0",
  partIfList: "0",
  draftNo: "0",
};

function url(extra) {
  return BASE + "?" + Object.entries({ ...COMMON, ...extra }).map(([k, v]) => `${k}=${v}`).join("&");
}

const FETCHES = [
  // 정규 시즌
  { key: "regularSeason", label: "정규 평균", params: { gameCode: "01" } },
  { key: "regularTotal",  label: "정규 합산", params: { gameCode: "01", perCn: "0" } },
  // 라운드별
  ...Array.from({ length: 6 }, (_, i) => ({
    key: `r${i + 1}`,
    label: `${i + 1}라운드`,
    params: { gameCode: "01", partSc: "ROUND", partIfList: String(i + 1) },
  })),
  // 홈 / 원정
  { key: "home", label: "홈",   params: { gameCode: "01", homeAwaySc: "1" } },
  { key: "away", label: "원정", params: { gameCode: "01", homeAwaySc: "2" } },
  // 쿼터
  { key: "q1",   label: "1쿼터", params: { gameCode: "01", quarterSc: "Q1" } },
  { key: "q2",   label: "2쿼터", params: { gameCode: "01", quarterSc: "Q2" } },
  { key: "q3",   label: "3쿼터", params: { gameCode: "01", quarterSc: "Q3" } },
  { key: "q4",   label: "4쿼터", params: { gameCode: "01", quarterSc: "Q4" } },
  // 전후반
  { key: "h1",   label: "전반",  params: { gameCode: "01", quarterSc: "Q1,Q2" } },
  { key: "h2",   label: "후반",  params: { gameCode: "01", quarterSc: "Q3,Q4" } },
  // 플레이오프 — 03 (6강·4강) + 04 (챔결) 합산
  { key: "playoff",       label: "PO 평균",  params: { gameCode: "03,04" } },
  { key: "playoffTotal",  label: "PO 합산",  params: { gameCode: "03,04", perCn: "0" } },
  // 챔피언결정전만 별도 (CF 화면용 백업)
  { key: "championship",  label: "CF 평균",  params: { gameCode: "04" } },
];

console.log(`[1/2] KBL 선수 detail 수집 — 총 ${FETCHES.length}개 split`);

async function fetchOne(label, params) {
  const u = url(params);
  try {
    const res = await fetch(u, { headers: HEADERS });
    if (!res.ok) {
      console.log(`  ${label.padEnd(8)} ✗ HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const arr = json?.data ?? [];
    console.log(`  ${label.padEnd(8)} ✓ ${arr.length}명`);
    return arr;
  } catch (e) {
    console.log(`  ${label.padEnd(8)} ✗ ${e.message}`);
    return [];
  }
}

const splits = {};
const round = {};
for (const f of FETCHES) {
  const data = await fetchOne(f.label, f.params);
  if (f.key.startsWith("r") && f.key.length <= 2) {
    round[f.key] = data;
  } else {
    splits[f.key] = data;
  }
  await new Promise((r) => setTimeout(r, 150));
}
splits.round = round;

console.log(`\n[2/2] 저장`);

// 정규화: 모든 split의 row를 동일 shape로 정리
function normalize(row) {
  if (!row) return null;
  return {
    rank: row.rankNo,
    playerNo: String(row.playerNo),
    kname: row.kname,
    ename: row.ename,
    teamCode: row.teamCode,
    teamName1: row.teamName1,
    teamName4: row.teamName4,
    games: row.gameCount,
    wins: row.win,
    losses: row.lose,
    minutes: row.playSec,
    points: row.score,
    fgMade: row.fg, fgAtt: row.fgA, fgPct: row.fgRt,
    threeMade: row.threep, threeAtt: row.threepA, threePct: row.threepRt,
    twoMade: row.fdg, twoAtt: row.fdgA, twoPct: row.fdgRt,
    ftMade: row.ft, ftAtt: row.ftA, ftPct: row.ftRt,
    rebounds: row.rb, oReb: row.oR, dReb: row.dR,
    assists: row.aS,
    steals: row.sT,
    blocks: row.bS,
    turnovers: row.tO,
    fouls: row.foul,
  };
}

const normalized = {
  regularSeason: (splits.regularSeason ?? []).map(normalize),
  regularTotal: (splits.regularTotal ?? []).map(normalize),
  playoff: (splits.playoff ?? []).map(normalize),
  playoffTotal: (splits.playoffTotal ?? []).map(normalize),
  championship: (splits.championship ?? []).map(normalize),
  // 홈/원정/쿼터/전후반
  home: (splits.home ?? []).map(normalize),
  away: (splits.away ?? []).map(normalize),
  q1: (splits.q1 ?? []).map(normalize),
  q2: (splits.q2 ?? []).map(normalize),
  q3: (splits.q3 ?? []).map(normalize),
  q4: (splits.q4 ?? []).map(normalize),
  h1: (splits.h1 ?? []).map(normalize),
  h2: (splits.h2 ?? []).map(normalize),
  round: Object.fromEntries(
    Object.entries(round).map(([k, v]) => [k, v.map(normalize)]),
  ),
};

mkdirSync("data", { recursive: true });
writeFileSync(
  "data/players-detail.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "api-stats.kbl.or.kr",
      seasonCode: "47",
      splits: normalized,
    },
    null,
    2,
  ),
);

console.log(`✓ data/players-detail.json 저장`);
console.log(`  정규 평균 ${normalized.regularSeason.length}명, PO 평균 ${normalized.playoff.length}명`);
console.log(`  라운드별: ${Object.entries(normalized.round).map(([k, v]) => `${k}:${v.length}`).join(", ")}`);

// 미리보기 — 한 선수 (자밀 워니) 추적
const wonny = normalized.regularSeason.find((p) => p?.kname === "자밀 워니");
if (wonny) {
  console.log(`\n샘플 — 자밀 워니 정규 평균:`);
  console.log(`  ${wonny.points}득 ${wonny.rebounds}리바 ${wonny.assists}어시 (FG ${wonny.fgPct?.toFixed(1)}%)`);
  for (const r of ["r1", "r2", "r3", "r4", "r5", "r6"]) {
    const w = normalized.round[r]?.find((p) => p?.kname === "자밀 워니");
    if (w) {
      console.log(`  ${r}: ${w.points?.toFixed(1)}득 ${w.rebounds?.toFixed(1)}리바 (${w.games}G)`);
    }
  }
}
