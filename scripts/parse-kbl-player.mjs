/**
 * KBL 공식 선수 기록 파서 v2
 *
 * 입력: data/raw/kbl-player*.html  (파일명 앞에 kbl-player 붙으면 다 읽어 합침)
 *   예: kbl-player.html, kbl-player-01.html, kbl-player-02.html, ...
 *
 * 출력: data/players.json
 *
 * 팀 정보: <i class="ic-emblem XX"> 의 XX 를 팀 약어로 매핑.
 *
 * 실행: npm run parse:kbl-player
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";

const RAW_DIR = "data/raw";

// KBL 엠블럼 CSS 클래스 코드 → 우리 팀 약어
const EMBLEM_CODE_TO_SHORT = {
  sk: "SK",
  ss: "삼성",
  lg: "LG",
  kgc: "정관장",
  db: "DB",
  sono: "소노",
  kcc: "KCC",
  kt: "KT",
  hd: "현대모비스",
  pega: "가스공사",  // 대구 한국가스공사 페가수스
  kogas: "가스공사", // fallback
  kg: "가스공사",    // fallback
};

function teamFromHint(hint) {
  if (!hint) return "";
  const m = hint.match(/ic-emblem\s+([a-z]+)/i);
  if (m) {
    const code = m[1].toLowerCase();
    if (EMBLEM_CODE_TO_SHORT[code]) return EMBLEM_CODE_TO_SHORT[code];
    return `?(${code})`; // 매핑 안 된 새 코드 — 경고용으로 그대로 표시
  }
  return "";
}

function num(cell) {
  const s = String(cell ?? "").replace(/[^\d.\-]/g, "");
  return s ? parseFloat(s) : 0;
}

// ─── 파일 수집 ───────────────────────────────────────
if (!existsSync(RAW_DIR)) {
  console.error(`✗ ${RAW_DIR} 폴더 없음.`);
  process.exit(1);
}

const files = readdirSync(RAW_DIR)
  .filter((f) => /^kbl-player.*\.html$/i.test(f))
  .sort()
  .map((f) => join(RAW_DIR, f));

if (files.length === 0) {
  console.error(`✗ ${RAW_DIR}/kbl-player*.html 파일 없음.`);
  console.error(`  Chrome에서 KBL 선수 페이지를 저장해주세요.`);
  process.exit(1);
}

console.log(`[1/4] 파일 ${files.length}개 읽기 & 진단`);

// ─── 파일별 파싱 ─────────────────────────────────────
const rawAll = [];
let detectedHeader = null;
const newCodes = new Set();
const perFileFirstPlayers = []; // 파일별 진단용

for (const file of files) {
  const html = readFileSync(file, "utf-8");
  const $ = load(html);

  const $table = $("table").first();
  const header = $table
    .find("thead th, thead td")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get();
  if (!detectedHeader && header.length > 0) detectedHeader = header;

  const fileRows = [];
  $table.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.find("td").map((_, td) => $(td).text().replace(/\s+/g, " ").trim()).get();
    if (cells.length < 4) return;

    const $nameCell = $tr.find("td").eq(1);
    const iClass = $nameCell.find("i").attr("class") || "";
    const team = teamFromHint(iClass);
    if (team && team.startsWith("?")) {
      const code = team.slice(2, -1);
      newCodes.add(code);
    }

    fileRows.push({ cells, team, file });
  });

  // 진단: 각 파일의 첫 번째 선수 이름
  const firstName = fileRows[0]?.cells[1] ?? "(비어있음)";
  const lastName = fileRows[fileRows.length - 1]?.cells[1] ?? "";
  console.log(`  · ${file.split(/[\\/]/).pop()} · ${fileRows.length}행 · 첫번째: "${firstName}" · 마지막: "${lastName}"`);

  rawAll.push(...fileRows);
  perFileFirstPlayers.push({ file, first: firstName, last: lastName, count: fileRows.length });
}

console.log(`\n[2/4] 총 ${rawAll.length} 행 수집 (파일 전체 합산)`);

// 페이지 중복·누락 경고
const seenFirsts = new Set();
for (const f of perFileFirstPlayers) {
  if (seenFirsts.has(f.first)) {
    console.log(`  ⚠ 파일 ${f.file.split(/[\\/]/).pop()} 의 첫 선수 "${f.first}" — 다른 파일과 같음. 같은 페이지 중복 저장 가능성.`);
  }
  seenFirsts.add(f.first);
}

// 자밀 워니가 데이터에 있는지 확인 (page 1 체크)
const hasJameel = rawAll.some((r) => r.cells[1] === "자밀 워니");
if (!hasJameel) {
  console.log(`  ⚠ "자밀 워니"(SK, 득점 1위)가 데이터에 없음 → Page 1 저장본이 빠졌을 가능성 매우 높음.`);
}

if (newCodes.size > 0) {
  console.log(`  ⚠ 매핑 안 된 엠블럼 코드: ${[...newCodes].join(", ")}`);
  console.log(`    EMBLEM_CODE_TO_SHORT 에 추가 필요.`);
}

// ─── 헤더 매핑 ────────────────────────────────────────
const header = detectedHeader || [];
const findCol = (...patterns) => {
  for (const p of patterns) {
    const i = header.findIndex((h) => (typeof p === "string" ? h === p : p.test(h)));
    if (i >= 0) return i;
  }
  return -1;
};

const IDX = {
  rank:      findCol("#", "순위", /rank/i),
  name:      findCol("팀/선수", "선수"),
  games:     findCol("GP", "G", /^경기$/),
  minutes:   findCol("MIN", /^분$/),
  points:    findCol("PTS", /^득점$/),
  twoPM:     findCol("2PM"),
  twoPA:     findCol("2PA"),
  threePM:   findCol("3PM"),
  threePA:   findCol("3PA"),
  threePct:  findCol("3P%"),
  fgMade:    findCol("FGM"),
  fgAtt:     findCol("FGA"),
  fgPct:     findCol("FG%"),
  ftMade:    findCol("FTM"),
  ftAtt:     findCol("FTA"),
  ftPct:     findCol("FT%"),
  oReb:      findCol("OREB"),
  dReb:      findCol("DREB"),
  reb:       findCol("REB", /^리바운드$/),
  assists:   findCol("AST", /^어시스트$/),
  steals:    findCol("STL", /^스틸$/),
  blocks:    findCol("BLK", /^블록$/),
  turnovers: findCol("TO", "TOV", /턴오버/),
};

// ─── 선수별 추출 ─────────────────────────────────────
const byKey = new Map();
for (const r of rawAll) {
  const cells = r.cells;
  const name = (IDX.name >= 0 ? cells[IDX.name] : "").trim();
  if (!name || name.length < 2) continue;
  if (/^(합계|평균|총계|팀평균)$/.test(name)) continue;

  const key = `${name}__${r.team}`;
  if (byKey.has(key)) continue; // 중복 — 여러 페이지에 같은 선수 있을 수 있음

  const pick = (idx) => (idx >= 0 ? num(cells[idx]) : 0);

  byKey.set(key, {
    name,
    team: r.team,
    games: pick(IDX.games),
    stats: {
      minutes:   pick(IDX.minutes),
      points:    pick(IDX.points),
      assists:   pick(IDX.assists),
      rebounds:  pick(IDX.reb) || pick(IDX.oReb) + pick(IDX.dReb),
      steals:    pick(IDX.steals),
      blocks:    pick(IDX.blocks),
      fgMade:    pick(IDX.fgMade),
      threeMade: pick(IDX.threePM),
      ftMade:    pick(IDX.ftMade),
      fgPct:     pick(IDX.fgPct),
      threePct:  pick(IDX.threePct),
      ftPct:     pick(IDX.ftPct),
      turnovers: pick(IDX.turnovers),
      twoPM:     pick(IDX.twoPM),
      twoPA:     pick(IDX.twoPA),
      threePA:   pick(IDX.threePA),
      fgAtt:     pick(IDX.fgAtt),
      ftAtt:     pick(IDX.ftAtt),
      oReb:      pick(IDX.oReb),
      dReb:      pick(IDX.dReb),
      games:     pick(IDX.games),
    },
  });
}

const players = [...byKey.values()];
players.sort((a, b) => b.stats.points - a.stats.points);
players.forEach((p, i) => (p.rank = i + 1));

console.log(`\n[3/4] 선수 ${players.length}명 추출 (중복 제거 후)`);
console.log(`  득점 리더 TOP 10:`);
for (const p of players.slice(0, 10)) {
  console.log(
    `    ${String(p.rank).padStart(2)} · ${p.name.padEnd(10)} ${p.team.padEnd(8)}  득 ${p.stats.points.toFixed(1)} · 어 ${p.stats.assists.toFixed(1)} · 리 ${p.stats.rebounds.toFixed(1)} · FG% ${p.stats.fgPct.toFixed(1)}`
  );
}

// 팀별 선수 수 요약 (누락된 팀 있는지 체크)
const byTeam = {};
for (const p of players) byTeam[p.team || "(없음)"] = (byTeam[p.team || "(없음)"] || 0) + 1;
console.log(`\n  팀별 선수 수:`);
for (const [t, n] of Object.entries(byTeam).sort(([, a], [, b]) => b - a)) {
  console.log(`    ${t.padEnd(10)} ${n}명`);
}

// ─── 저장 ─────────────────────────────────────────────
console.log(`\n[4/4] 저장`);
mkdirSync("data", { recursive: true });
writeFileSync(
  "data/players.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      sourceFiles: files.map((f) => f.replace(/\\/g, "/")),
      sourceLabel: "KBL 공식 (kbl.or.kr/record/player)",
      totalPlayers: players.length,
      players,
    },
    null,
    2
  )
);

console.log(`  ✓ data/players.json 저장 (${players.length}명)`);
console.log(`\n====================`);
if (newCodes.size > 0) {
  console.log(`⚠ 매핑 안 된 엠블럼 코드 ${[...newCodes].join(", ")} 를 저한테 알려주세요. 파서 업데이트 하겠습니다.`);
}
if (players.length >= 150) {
  console.log(`✓ ${players.length}명 — 대시보드 새로고침 시 즉시 반영.`);
} else if (players.length >= 20) {
  console.log(`✓ ${players.length}명 확보. 200명 전체 원하시면 kbl-player-01.html ~ kbl-player-10.html 식으로 10페이지 개별 저장 후 재실행.`);
} else {
  console.log(`⚠ ${players.length}명만 잡힘 — 출력 공유해주세요.`);
}
