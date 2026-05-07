/**
 * KBL 공식 팀 기록 파서
 *
 * 입력: data/raw/kbl-team.html
 *   (https://www.kbl.or.kr/record/team 에서 Ctrl+S로 저장)
 *
 * 출력:
 *   - data/standings.json   (순위, W/L, 승률)
 *   - data/team-stats.json  (팀당 평균 스탯)
 *
 * 누적/평균 자동 감지: PTS가 500 이상이면 누적 → G로 나눠 평균화.
 *
 * 실행: npm run parse:kbl-team
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { load } from "cheerio";

const FILE = "data/raw/kbl-team.html";

if (!existsSync(FILE)) {
  console.error(`✗ ${FILE} 가 없습니다.`);
  console.error(`  Chrome에서 https://www.kbl.or.kr/record/team 열고 Ctrl+S → data/raw/ 에 저장.`);
  process.exit(1);
}

const TEAM_MAP = {
  "창원 LG": { code: "LG", short: "LG", accent: "text-flame-500" },
  "안양 정관장": { code: "KGC", short: "정관장", accent: "text-flame-400" },
  "원주 DB": { code: "DB", short: "DB", accent: "text-hoop-400" },
  "서울 SK": { code: "SK", short: "SK", accent: "text-hoop-400" },
  "고양 소노": { code: "SONO", short: "소노", accent: "text-hoop-400" },
  "부산 KCC": { code: "KCC", short: "KCC", accent: "text-hoop-400" },
  "수원 KT": { code: "KT", short: "KT", accent: "text-ink-300" },
  "울산 현대모비스": { code: "HDMOBIS", short: "현대모비스", accent: "text-ink-300" },
  "대구 한국가스공사": { code: "KOGAS", short: "가스공사", accent: "text-ink-300" },
  "서울 삼성": { code: "SAMSUNG", short: "삼성", accent: "text-buzzer-500" },
};

function findTeam(text) {
  const names = Object.keys(TEAM_MAP).sort((a, b) => b.length - a.length);
  for (const n of names) {
    if (text.includes(n)) return { name: n, ...TEAM_MAP[n] };
  }
  return null;
}

function num(cell) {
  const s = String(cell ?? "").replace(/[^\d.\-]/g, "");
  return s ? parseFloat(s) : 0;
}

const html = readFileSync(FILE, "utf-8");
const $ = load(html);

// ─── 테이블 탐색 ─────────────────────────────────────
console.log(`[1/4] 테이블 탐색`);
let best = null;

$("table").each((idx, tbl) => {
  const header = $(tbl).find("thead th, thead td").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get();
  const bodyRows = $(tbl)
    .find("tbody tr")
    .toArray()
    .map((tr) =>
      $(tr).find("td").map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get()
    )
    // 합계 행 제외 (빈 순위 셀)
    .filter((cells) => cells.length > 3);

  const hasPts = header.some((h) => /PTS|득점/i.test(h));
  const hasWin = header.some((h) => h === "W" || h === "승");
  const hasTeam = header.some((h) => h === "팀" || /team/i.test(h));

  const teamHits = bodyRows.filter((c) => findTeam(c.join(" "))).length;
  console.log(`  table[${idx}] · header ${header.length}칸, 행 ${bodyRows.length}, 팀매칭 ${teamHits}, PTS ${hasPts}, W ${hasWin}, 팀 ${hasTeam}`);

  if (hasPts && hasWin && hasTeam && teamHits >= 8) {
    if (!best || header.length > best.header.length) best = { idx, header, rows: bodyRows };
  }
});

if (!best) {
  console.error(`\n✗ 팀 기록 테이블을 찾지 못했습니다. 저장된 HTML 구조를 확인해주세요.`);
  process.exit(1);
}

console.log(`\n  선택: table[${best.idx}]`);
console.log(`  header: [ ${best.header.join(" | ")} ]`);

// ─── 컬럼 인덱스 매핑 (영어 약어 + 한글 둘 다 대응) ────
const findCol = (...patterns) => {
  for (const p of patterns) {
    const i = best.header.findIndex((h) =>
      typeof p === "string" ? h === p : p.test(h)
    );
    if (i >= 0) return i;
  }
  return -1;
};

const IDX = {
  rank:      findCol("순위", /rank/i),
  team:      findCol("팀", /team/i),
  games:     findCol("G", /^경기$/),
  wins:      findCol("W", /^승$/),
  losses:    findCol("L", /^패$/),
  winPct:    findCol("승률", /win.*%|%.*win/i),
  points:    findCol("PTS", /^득점$/),
  twoPM:     findCol("2PM"),
  twoPA:     findCol("2PA"),
  twoPct:    findCol("2P%"),
  threePM:   findCol("3PM"),
  threePA:   findCol("3PA"),
  threePct:  findCol("3P%"),
  fgMade:    findCol("FGM"),
  fgAtt:     findCol("FGA"),
  fgPct:     findCol("FG%"),
  ftMade:    findCol("FTM"),
  ftAtt:     findCol("FTA"),
  ftPct:     findCol("FT%"),
  oReb:      findCol("OREB", /^공격\s*리바운드|공격리바/),
  dReb:      findCol("DREB", /^수비\s*리바운드|수비리바/),
  reb:       findCol("REB", /^리바운드$/),
  assists:   findCol("AST", /^어시스트$/),
  steals:    findCol("STL", /^스틸$/),
  blocks:    findCol("BLK", /^블록$/),
  turnovers: findCol("TO", "TOV", /턴오버/),
};

console.log(`\n[2/4] 컬럼 매핑`);
for (const [k, i] of Object.entries(IDX)) {
  if (i >= 0) console.log(`  ${k.padEnd(10)} → col${i} (${best.header[i]})`);
  else console.log(`  ${k.padEnd(10)} → (못 찾음)`);
}

// ─── 각 행 파싱 ─────────────────────────────────────
console.log(`\n[3/4] 팀별 데이터 추출`);
const teams = [];

for (const cells of best.rows) {
  const t = findTeam(cells.join(" "));
  if (!t) continue;

  const rank = IDX.rank >= 0 ? num(cells[IDX.rank]) : 0;
  const games = IDX.games >= 0 ? num(cells[IDX.games]) : 0;
  const wins = IDX.wins >= 0 ? num(cells[IDX.wins]) : 0;
  const losses = IDX.losses >= 0 ? num(cells[IDX.losses]) : 0;

  // 승률 — KBL은 65.5% 같은 %로 표기될 수 있음 → 소수로 변환
  let winPctRaw = IDX.winPct >= 0 ? num(cells[IDX.winPct]) : wins / (wins + losses || 1);
  const winPct = winPctRaw > 1 ? winPctRaw / 100 : winPctRaw;

  // 스탯 수집 (raw — 누적이면 큰 값, 평균이면 작은 값)
  const raw = {
    points:    IDX.points    >= 0 ? num(cells[IDX.points])    : 0,
    assists:   IDX.assists   >= 0 ? num(cells[IDX.assists])   : 0,
    rebounds:  IDX.reb       >= 0 ? num(cells[IDX.reb])       : 0,
    oReb:      IDX.oReb      >= 0 ? num(cells[IDX.oReb])      : 0,
    dReb:      IDX.dReb      >= 0 ? num(cells[IDX.dReb])      : 0,
    steals:    IDX.steals    >= 0 ? num(cells[IDX.steals])    : 0,
    blocks:    IDX.blocks    >= 0 ? num(cells[IDX.blocks])    : 0,
    turnovers: IDX.turnovers >= 0 ? num(cells[IDX.turnovers]) : 0,
    twoPM:     IDX.twoPM     >= 0 ? num(cells[IDX.twoPM])     : 0,
    twoPA:     IDX.twoPA     >= 0 ? num(cells[IDX.twoPA])     : 0,
    threePM:   IDX.threePM   >= 0 ? num(cells[IDX.threePM])   : 0,
    threePA:   IDX.threePA   >= 0 ? num(cells[IDX.threePA])   : 0,
    fgMade:    IDX.fgMade    >= 0 ? num(cells[IDX.fgMade])    : 0,
    fgAtt:     IDX.fgAtt     >= 0 ? num(cells[IDX.fgAtt])     : 0,
    ftMade:    IDX.ftMade    >= 0 ? num(cells[IDX.ftMade])    : 0,
    ftAtt:     IDX.ftAtt     >= 0 ? num(cells[IDX.ftAtt])     : 0,
  };

  // rebounds 없으면 oReb+dReb로 보완
  if (!raw.rebounds && (raw.oReb || raw.dReb)) {
    raw.rebounds = raw.oReb + raw.dReb;
  }

  // 누적 vs 평균 자동 감지 — PTS > 500이면 누적
  const isCumulative = raw.points > 500;
  const factor = isCumulative ? games || 1 : 1;

  const stats = {
    points:    raw.points / factor,
    oppPoints: 0, // KBL 기본 페이지엔 실점 컬럼 없음. 필요하면 "수비" 탭에서 별도 파싱.
    assists:   raw.assists / factor,
    rebounds:  raw.rebounds / factor,
    oReb:      raw.oReb / factor,
    dReb:      raw.dReb / factor,
    steals:    raw.steals / factor,
    blocks:    raw.blocks / factor,
    turnovers: raw.turnovers / factor,
    fgMade:    raw.fgMade / factor,
    fgAtt:     raw.fgAtt / factor,
    fgPct:     IDX.fgPct >= 0 ? num(cells[IDX.fgPct]) : (raw.fgAtt ? (raw.fgMade / raw.fgAtt) * 100 : 0),
    threeMade: raw.threePM / factor,
    threeAtt:  raw.threePA / factor,
    threePct:  IDX.threePct >= 0 ? num(cells[IDX.threePct]) : (raw.threePA ? (raw.threePM / raw.threePA) * 100 : 0),
    ftMade:    raw.ftMade / factor,
    ftAtt:     raw.ftAtt / factor,
    ftPct:     IDX.ftPct >= 0 ? num(cells[IDX.ftPct]) : (raw.ftAtt ? (raw.ftMade / raw.ftAtt) * 100 : 0),
  };

  teams.push({
    rank,
    code: t.code,
    name: t.name,
    shortName: t.short,
    accent: t.accent,
    games,
    wins,
    losses,
    winPct,
    isCumulativeSource: isCumulative,
    stats,
  });
}

teams.sort((a, b) => (a.rank || 99) - (b.rank || 99));

console.log(`\n  추출된 팀: ${teams.length}/10`);
console.log(`  ${teams[0]?.isCumulativeSource ? "누적 → 평균 변환됨" : "원본이 이미 평균"}`);

console.log(`\n  팀          rank  W  L  승률   PPG   RPG   APG   FG%`);
for (const t of teams) {
  console.log(
    `  ${t.shortName.padEnd(8)}  ${String(t.rank).padStart(4)}  ${String(t.wins).padStart(2)} ${String(t.losses).padStart(2)}  ${(t.winPct * 100).toFixed(1).padStart(5)}%  ${t.stats.points.toFixed(1).padStart(5)}  ${t.stats.rebounds.toFixed(1).padStart(5)}  ${t.stats.assists.toFixed(1).padStart(5)}  ${t.stats.fgPct.toFixed(1).padStart(5)}`
  );
}

// ─── 저장 ──────────────────────────────────────────
console.log(`\n[4/4] 저장`);
mkdirSync("data", { recursive: true });

// standings.json 형태 (기존 파일 구조 호환)
const standings = teams.map((t) => ({
  rank: t.rank,
  code: t.code,
  name: t.name,
  shortName: t.shortName,
  wins: t.wins,
  losses: t.losses,
  winPct: t.winPct,
  gb: "0", // KBL 페이지엔 GB 컬럼이 있지만 파서에선 생략. 필요시 추가.
  streak: "-",
  last10: "-",
  ppg: t.stats.points,
  oppPpg: 0,
  status:
    t.rank === 1 ? "regular-champ" :
    t.rank === 2 ? "bye" :
    t.rank >= 3 && t.rank <= 6 ? "po" :
    t.rank === 10 ? "bottom" : "out",
  note:
    t.rank === 1 ? "정규리그 우승" :
    t.rank === 2 ? "4강 직행" :
    t.rank >= 3 && t.rank <= 6 ? "6강 PO" :
    "",
  accent: t.accent,
}));

writeFileSync(
  "data/standings.json",
  JSON.stringify({ fetchedAt: new Date().toISOString(), source: "kbl.or.kr/record/team", standings }, null, 2)
);

// team-stats.json 형태
const teamStats = teams.map((t) => ({
  code: t.code,
  name: t.name,
  shortName: t.shortName,
  stats: t.stats,
}));

writeFileSync(
  "data/team-stats.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      sourceFile: FILE,
      totalTeams: teamStats.length,
      teams: teamStats,
    },
    null,
    2
  )
);

console.log(`  ✓ data/standings.json 저장`);
console.log(`  ✓ data/team-stats.json 저장`);
console.log(`\n====================`);
if (teams.length === 10) {
  console.log(`✓ 10개 팀 완성. 대시보드 새로고침 시 즉시 반영.`);
} else {
  console.log(`⚠ ${teams.length}/10 — 출력 공유해주세요.`);
}
