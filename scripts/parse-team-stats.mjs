/**
 * 팀 평균 스탯 파서 — Daum 팀 페이지의 두 번째 테이블(기록 순위) 추출
 *
 * 입력: data/raw/daum-kbl-team.html  (기존에 저장한 파일 재활용)
 * 출력: data/team-stats.json
 *
 * 실행: npm run parse:team-stats
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { load } from "cheerio";

const FILE = "data/raw/daum-kbl-team.html";

if (!existsSync(FILE)) {
  console.error(`✗ ${FILE} 가 없습니다.`);
  console.error(`  먼저 Daum 팀 페이지를 저장해주세요 (npm run parse:local 과 동일한 파일).`);
  process.exit(1);
}

// 팀 이름 → 축약명 매핑
const TEAM_MAP = {
  "창원 LG": { code: "LG", short: "LG" },
  "안양 정관장": { code: "KGC", short: "정관장" },
  "원주 DB": { code: "DB", short: "DB" },
  "서울 SK": { code: "SK", short: "SK" },
  "고양 소노": { code: "SONO", short: "소노" },
  "부산 KCC": { code: "KCC", short: "KCC" },
  "수원 KT": { code: "KT", short: "KT" },
  "울산 현대모비스": { code: "HDMOBIS", short: "현대모비스" },
  "대구 한국가스공사": { code: "KOGAS", short: "가스공사" },
  "서울 삼성": { code: "SAMSUNG", short: "삼성" },
};

function findTeam(text) {
  const sorted = Object.keys(TEAM_MAP).sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (text.includes(name)) return { name, ...TEAM_MAP[name] };
  }
  return null;
}

function num(cell) {
  const s = String(cell ?? "").replace(/[^\d.\-]/g, "");
  return s ? parseFloat(s) : 0;
}

const html = readFileSync(FILE, "utf-8");
const $ = load(html);

// ─── 테이블 탐색 — 컬럼이 많은 게 "기록 순위" ─────────────
console.log(`[1/3] 테이블 탐색`);
let best = null;

$("table").each((tblIdx, tbl) => {
  const header = $(tbl)
    .find("thead th, thead td")
    .map((_, el) => $(el).text().trim())
    .get();
  const rows = $(tbl)
    .find("tbody tr")
    .toArray()
    .map((tr) =>
      $(tr).find("td").map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get()
    );
  console.log(`  table[${tblIdx}] · header ${header.length}칸, tbody ${rows.length}줄`);

  // "기록 순위" 특징: "득점" 헤더가 있고 10개 이상 행
  const hasScoring = header.some((h) => h === "득점" || h.includes("득점"));
  const hasAssist = header.some((h) => h.includes("어시스트"));
  const hasRebound = header.some((h) => h.includes("리바운드"));
  if (hasScoring && hasAssist && hasRebound && rows.length >= 5) {
    if (!best || header.length > best.header.length) {
      best = { tblIdx, header, rows };
    }
  }
});

if (!best) {
  console.error(`\n✗ 기록 순위 테이블을 찾지 못했습니다.`);
  console.error(`  Daum 팀 페이지가 변했거나 저장본에 해당 섹션이 없어요.`);
  process.exit(1);
}

console.log(`\n  선택: table[${best.tblIdx}]`);
console.log(`  header: [ ${best.header.join(" | ")} ]`);

// ─── 컬럼 인덱스 매핑 ────────────────────────────────
const findCol = (pred) => best.header.findIndex(pred);

const IDX = {
  team:      findCol((h) => h === "팀" || h.includes("팀명")),
  points:    findCol((h) => h === "득점"),
  oppPoints: findCol((h) => h === "실점"),
  assists:   findCol((h) => h.includes("어시스트")),
  rebounds:  findCol((h) => h.includes("리바운드")),
  steals:    findCol((h) => h.includes("스틸")),
  blocks:    findCol((h) => h.includes("블록")),
  fgMade:    findCol((h) => h === "야투"),
  threeMade: findCol((h) => h === "3점"),
  ftMade:    findCol((h) => h === "자유투"),
  fgPct:     findCol((h) => h.includes("야투") && /[%%(]/.test(h)),
  threePct:  findCol((h) => h.includes("3점") && /[%%(]/.test(h)),
  ftPct:     findCol((h) => h.includes("자유투") && /[%%(]/.test(h)),
  turnovers: findCol((h) => h.includes("턴오버")),
};

console.log(`\n[2/3] 컬럼 매핑`);
for (const [k, i] of Object.entries(IDX)) {
  console.log(`  ${k.padEnd(10)} → col${i} ${i >= 0 ? `(${best.header[i]})` : ""}`);
}

// ─── 각 행에서 팀·스탯 추출 ──────────────────────────
const teams = [];
for (const cells of best.rows) {
  const joined = cells.join(" ");
  const t = findTeam(joined);
  if (!t) continue;

  teams.push({
    code: t.code,
    name: t.name,
    shortName: t.short,
    stats: {
      points:    IDX.points    >= 0 ? num(cells[IDX.points])    : 0,
      oppPoints: IDX.oppPoints >= 0 ? num(cells[IDX.oppPoints]) : 0,
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

// ─── 출력 & 저장 ─────────────────────────────────────
console.log(`\n[3/3] 추출 결과`);
console.log(
  `  팀         득점   실점   어시   리바   FG%    3P%   `
);
for (const t of teams) {
  const s = t.stats;
  console.log(
    `  ${t.shortName.padEnd(8)}  ${s.points.toFixed(1).padStart(5)}  ${s.oppPoints.toFixed(1).padStart(5)}  ${s.assists.toFixed(1).padStart(5)}  ${s.rebounds.toFixed(1).padStart(5)}  ${s.fgPct.toFixed(1).padStart(5)}  ${s.threePct.toFixed(1).padStart(5)}`
  );
}

mkdirSync("data", { recursive: true });
writeFileSync(
  "data/team-stats.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      sourceFile: FILE,
      totalTeams: teams.length,
      teams,
    },
    null,
    2
  )
);

console.log(`\n✓ data/team-stats.json 저장 (${teams.length}개 팀)`);
if (teams.length === 10) {
  console.log(`  대시보드 팀 비교 & /compare 페이지에 자동 반영됩니다.`);
}
