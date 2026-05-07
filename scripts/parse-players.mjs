/**
 * 선수 스탯 파서 — Daum 선수 순위 페이지 로컬 저장본에서 전체 스탯 추출
 *
 * 입력: data/raw/daum-kbl-players.html
 * 출력: data/players.json (득점·어시스트·리바운드·스틸·블록·야투/3점/자유투%·턴오버 포함)
 *
 * 실행: npm run parse:players
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { load } from "cheerio";

const FILE = "data/raw/daum-kbl-players.html";

if (!existsSync(FILE)) {
  console.error(`✗ ${FILE} 가 없습니다.`);
  console.error(`  저장 방법:`);
  console.error(`    1) Chrome에서 https://sports.daum.net/record/kbl/player 열기`);
  console.error(`    2) 선수 이름들이 표에 뜰 때까지 기다리기`);
  console.error(`    3) Ctrl+S → "웹페이지, HTML만" → data/raw/daum-kbl-players.html 저장`);
  process.exit(1);
}

const html = readFileSync(FILE, "utf-8");
const $ = load(html);

// ─── 테이블 선택 ─────────────────────────────────────
console.log(`[1/4] 테이블 탐색`);
let best = null;
$("table").each((tblIdx, tbl) => {
  const header = $(tbl).find("thead th, thead td").map((_, el) => $(el).text().trim()).get();
  const rows = $(tbl).find("tbody tr").toArray().map((tr) =>
    $(tr).find("td").map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get()
  );
  const hasPlayer = header.some((h) => h.includes("선수"));
  const hasScoring = header.some((h) => h.includes("득점"));
  if (!hasPlayer || !hasScoring) return;
  if (!best || rows.length > best.rows.length) {
    best = { tblIdx, header, rows };
  }
});

if (!best) {
  console.error(`✗ 선수 데이터 테이블을 찾지 못했습니다.`);
  process.exit(1);
}

// 헤더에서 "정렬" 꼬리 제거
const headerClean = best.header.map((h) => h.replace(/정렬/g, "").trim());
console.log(`  선택: table[${best.tblIdx}]`);
console.log(`  header: [ ${headerClean.join(" | ")} ]`);
console.log(`  데이터 행: ${best.rows.length}줄`);

// ─── 컬럼 매핑 ──────────────────────────────────────
const hasPct = (h) => /%|\(/.test(h);

function findCol(keyword, wantPct = null) {
  for (let i = 0; i < headerClean.length; i++) {
    const h = headerClean[i];
    if (!h.includes(keyword)) continue;
    if (wantPct !== null && hasPct(h) !== wantPct) continue;
    return i;
  }
  return -1;
}

const IDX = {
  rank:      findCol("순위"),
  name:      findCol("선수"),
  team:      findCol("팀"),
  minutes:   findCol("출장"),
  points:    findCol("득점"),
  assists:   findCol("어시스트"),
  rebounds:  findCol("리바운드"),
  steals:    findCol("스틸"),
  blocks:    findCol("블록"),
  fgMade:    findCol("야투", false),
  threeMade: findCol("3점", false),
  ftMade:    findCol("자유투", false),
  fgPct:     findCol("야투", true),
  threePct:  findCol("3점", true),
  ftPct:     findCol("자유투", true),
  turnovers: findCol("턴오버"),
};

console.log(`\n[2/4] 컬럼 매핑`);
for (const [key, i] of Object.entries(IDX)) {
  if (i >= 0) console.log(`  ${key.padEnd(10)} → col${i} (${headerClean[i]})`);
}

// ─── 팀 축약 ───────────────────────────────────────
const TEAM_SHORT = {
  "창원 LG": "LG", "LG": "LG",
  "안양 정관장": "KGC", "정관장": "KGC",
  "원주 DB": "DB", "DB": "DB",
  "서울 SK": "SK", "SK": "SK",
  "고양 소노": "소노", "소노": "소노",
  "부산 KCC": "KCC", "KCC": "KCC",
  "수원 KT": "KT", "KT": "KT",
  "울산 현대모비스": "현대모비스", "현대모비스": "현대모비스",
  "대구 한국가스공사": "가스공사", "한국가스공사": "가스공사", "가스공사": "가스공사",
  "서울 삼성": "삼성", "삼성": "삼성",
};
function normalizeTeam(raw) {
  const s = (raw || "").trim();
  for (const [key, val] of Object.entries(TEAM_SHORT)) {
    if (s.includes(key)) return val;
  }
  return s;
}

function num(cell) {
  const s = String(cell ?? "").replace(/[^\d.\-]/g, "");
  return s ? parseFloat(s) : 0;
}

// ─── 선수 추출 ─────────────────────────────────────
const players = [];
for (const cells of best.rows) {
  const name = (cells[IDX.name] || "").trim();
  if (!name) continue;

  players.push({
    name,
    team: normalizeTeam(cells[IDX.team]),
    stats: {
      minutes:   IDX.minutes   >= 0 ? num(cells[IDX.minutes])   : 0,
      points:    IDX.points    >= 0 ? num(cells[IDX.points])    : 0,
      assists:   IDX.assists   >= 0 ? num(cells[IDX.assists])   : 0,
      rebounds:  IDX.rebounds  >= 0 ? num(cells[IDX.rebounds])  : 0,
      steals:    IDX.steals    >= 0 ? num(cells[IDX.steals])    : 0,
      blocks:    IDX.blocks    >= 0 ? num(cells[IDX.blocks])    : 0,
      fgMade:    IDX.fgMade    >= 0 ? num(cells[IDX.fgMade])    : 0,
      threeMade: IDX.threeMade >= 0 ? num(cells[IDX.threeMade]) : 0,
      ftMade:    IDX.ftMade    >= 0 ? num(cells[IDX.ftMade])    : 0,
      fgPct:     IDX.fgPct     >= 0 ? num(cells[IDX.fgPct])     : 0,
      threePct:  IDX.threePct  >= 0 ? num(cells[IDX.threePct])  : 0,
      ftPct:     IDX.ftPct     >= 0 ? num(cells[IDX.ftPct])     : 0,
      turnovers: IDX.turnovers >= 0 ? num(cells[IDX.turnovers]) : 0,
    },
  });
}

// 득점 기준 정렬 & 순위 부여
players.sort((a, b) => b.stats.points - a.stats.points);
players.forEach((p, i) => (p.rank = i + 1));

// ─── 출력 ─────────────────────────────────────────
console.log(`\n[3/4] 득점 리더 TOP 10`);
for (const p of players.slice(0, 10)) {
  console.log(
    `  ${String(p.rank).padStart(2)} · ${p.name.padEnd(10)} ${p.team.padEnd(8)}  득점 ${p.stats.points.toFixed(1)} · 어시 ${p.stats.assists.toFixed(1)} · 리바 ${p.stats.rebounds.toFixed(1)}`
  );
}

// ─── 저장 ─────────────────────────────────────────
console.log(`\n[4/4] 저장`);
mkdirSync("data", { recursive: true });
const out = {
  fetchedAt: new Date().toISOString(),
  sourceFile: FILE,
  header: headerClean,
  totalPlayers: players.length,
  players,
};
writeFileSync("data/players.json", JSON.stringify(out, null, 2));

console.log(`\n====================`);
console.log(`✓ data/players.json 저장 (${players.length}명 전체)`);
console.log(`  대시보드 "득점 리더" 카드 자동 반영됩니다.`);
