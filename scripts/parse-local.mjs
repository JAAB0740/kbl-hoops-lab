/**
 * 로컬 HTML 파서 — 사용자가 브라우저에서 Ctrl+S로 저장한 페이지를 읽어
 * 팀 순위 데이터를 추출합니다. 네트워크 필요 없음.
 *
 * 사용법:
 *  1) 브라우저에서 KBL 순위 페이지를 연다
 *  2) Ctrl+S → data/raw/ 에 .html 로 저장
 *  3) npm run parse:local
 *
 * data/raw/ 안의 모든 .html 을 훑어서 팀 이름이 가장 많이 들어있는 테이블을
 * 자동으로 고릅니다. 파일명·저장 소스는 상관없음.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";

const RAW_DIR = "data/raw";

if (!existsSync(RAW_DIR)) {
  console.error(`✗ ${RAW_DIR} 폴더가 없습니다.`);
  console.error(`  브라우저에서 KBL 순위 페이지를 연 뒤 Ctrl+S로 이 폴더에 저장해주세요.`);
  process.exit(1);
}

const files = readdirSync(RAW_DIR).filter((f) => f.toLowerCase().endsWith(".html"));
if (files.length === 0) {
  console.error(`✗ ${RAW_DIR} 에 .html 파일이 없습니다.`);
  console.error(`  사용 안내:`);
  console.error(`    1) Chrome에서 https://sports.daum.net/record/kbl/team 열기`);
  console.error(`    2) 팀 순위가 다 보일 때까지 기다리기`);
  console.error(`    3) Ctrl+S → 파일 형식 "웹페이지, HTML만" → ${RAW_DIR}/ 에 저장`);
  process.exit(1);
}

console.log(`[1/3] data/raw/ 에서 .html 파일 스캔`);
for (const f of files) {
  const path = join(RAW_DIR, f);
  const size = statSync(path).size;
  console.log(`  · ${f} (${size.toLocaleString()} bytes)`);
}

// 팀 레지스트리
const TEAM_REGISTRY = [
  { keyword: "현대모비스", name: "울산 현대모비스", code: "HDMOBIS",  shortName: "현대모비스", accent: "text-ink-300" },
  { keyword: "가스공사",   name: "대구 한국가스공사", code: "KOGAS",  shortName: "가스공사",   accent: "text-ink-300" },
  { keyword: "정관장",     name: "안양 정관장",     code: "KGC",      shortName: "정관장",    accent: "text-flame-400" },
  { keyword: "소노",       name: "고양 소노",       code: "SONO",     shortName: "소노",      accent: "text-hoop-400" },
  { keyword: "KCC",        name: "부산 KCC",        code: "KCC",      shortName: "KCC",       accent: "text-hoop-400" },
  { keyword: "LG",         name: "창원 LG",         code: "LG",       shortName: "LG",        accent: "text-flame-500" },
  { keyword: "DB",         name: "원주 DB",         code: "DB",       shortName: "DB",        accent: "text-hoop-400" },
  { keyword: "SK",         name: "서울 SK",         code: "SK",       shortName: "SK",        accent: "text-hoop-400" },
  { keyword: "KT",         name: "수원 KT",         code: "KT",       shortName: "KT",        accent: "text-ink-300" },
  { keyword: "삼성",       name: "서울 삼성",       code: "SAMSUNG",  shortName: "삼성",      accent: "text-buzzer-500" },
];

function findTeam(text) {
  return TEAM_REGISTRY.find((t) => text.includes(t.keyword));
}

function parseNumber(s) {
  const m = String(s ?? "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

// 테이블 하나에서 팀 행 얼마나 뽑히는지 측정
function scoreTable($tbl, $) {
  const header = $tbl
    .find("thead th, thead td")
    .map((_, el) => $(el).text().trim())
    .get();

  let bodyRows = $tbl.find("tbody tr").toArray();
  if (bodyRows.length === 0) {
    bodyRows = $tbl
      .find("tr")
      .toArray()
      .filter((tr) => $(tr).find("th").length === 0 && $(tr).find("td").length > 0);
  }

  const rows = bodyRows.map((tr) =>
    $(tr)
      .find("td")
      .map((_, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get()
  );

  const matched = rows.filter((cells) => findTeam(cells.join(" "))).length;
  return { header, rows, matched };
}

console.log(`\n[2/3] 파일별 테이블 평가`);

let winner = null;

for (const file of files) {
  const path = join(RAW_DIR, file);
  const html = readFileSync(path, "utf-8");
  const $ = load(html);

  $("table").each((tblIdx, tbl) => {
    const s = scoreTable($(tbl), $);
    console.log(`  ${file} · table[${tblIdx}] · header ${s.header.length}칸, 행 ${s.rows.length}, 팀매칭 ${s.matched}`);
    if (!winner || s.matched > winner.matched) {
      winner = { file, tblIdx, ...s };
    }
  });
}

if (!winner || winner.matched < 5) {
  console.error(`\n✗ 팀 이름이 5개 이상 들어있는 테이블을 찾지 못했습니다.`);
  console.error(`  저장한 HTML이 JavaScript 렌더링 전이거나(=내용 안 들어있는 상태) 잘못된 페이지일 수 있어요.`);
  console.error(`  Chrome에서 https://sports.daum.net/record/kbl/team 을 연 뒤,`);
  console.error(`  화면에 10개 팀 이름이 다 보일 때까지 기다렸다가 Ctrl+S 하셨는지 확인해주세요.`);
  process.exit(1);
}

console.log(`\n[3/3] 선택된 테이블: ${winner.file} · table[${winner.tblIdx}]`);
console.log(`  thead: [ ${winner.header.join(" | ")} ]`);
console.log(`  팀매칭 ${winner.matched}/10`);

// 헤더에서 각 필드 인덱스 찾기
const header = winner.header;
const rankIdx = header.findIndex((h) => /순위/.test(h));
const winIdx = header.findIndex((h) => h.trim() === "승");
const lossIdx = header.findIndex((h) => h.trim() === "패");
const pctIdx = header.findIndex((h) => /승률/.test(h));
const gbIdx = header.findIndex((h) => /게임차|GB/i.test(h));
const streakIdx = header.findIndex((h) => /연속/.test(h));

const standings = [];
for (const cells of winner.rows) {
  const team = findTeam(cells.join(" "));
  if (!team) continue;

  const rank = rankIdx >= 0 ? parseNumber(cells[rankIdx]) : NaN;
  const wins = winIdx >= 0 ? parseNumber(cells[winIdx]) : NaN;
  const losses = lossIdx >= 0 ? parseNumber(cells[lossIdx]) : NaN;
  let winPct = pctIdx >= 0 ? parseNumber(cells[pctIdx]) : NaN;
  if (isNaN(winPct) && !isNaN(wins) && !isNaN(losses)) {
    winPct = wins / (wins + losses);
  }

  let streak = streakIdx >= 0 ? cells[streakIdx] || "" : "";
  if (/연승|연패/.test(streak)) {
    const n = streak.match(/\d+/)?.[0] ?? "1";
    streak = (streak.includes("연승") ? "W" : "L") + n;
  }

  standings.push({
    rank: isNaN(rank) ? 0 : rank,
    code: team.code,
    name: team.name,
    shortName: team.shortName,
    wins: isNaN(wins) ? 0 : wins,
    losses: isNaN(losses) ? 0 : losses,
    winPct: isNaN(winPct) ? 0 : winPct,
    gb: gbIdx >= 0 ? cells[gbIdx] || "" : "",
    streak: streak || "-",
    last10: "-",
    ppg: 0,
    oppPpg: 0,
    status: "out",
    note: "",
    accent: team.accent,
    rawCells: cells,
  });
}

standings.sort((a, b) => (a.rank || 99) - (b.rank || 99));

standings.forEach((s) => {
  if (s.rank === 1) { s.status = "regular-champ"; s.note = "정규리그 우승 · 4강 직행"; }
  else if (s.rank === 2) { s.status = "bye"; s.note = "4강 직행"; }
  else if (s.rank >= 3 && s.rank <= 6) { s.status = "po"; s.note = "6강 PO"; }
  else if (s.rank >= 7 && s.rank <= 9) { s.status = "out"; s.note = "PO 탈락"; }
  else if (s.rank === 10) { s.status = "bottom"; s.note = "최하위"; }
});

console.log(`\n── 추출 결과 ──────────────────`);
for (const s of standings) {
  console.log(
    `  ${String(s.rank).padStart(2)} · ${s.name.padEnd(14)}  ${String(s.wins).padStart(2)}승 ${String(s.losses).padStart(2)}패  ${s.winPct.toFixed(3)}`
  );
}

mkdirSync("data", { recursive: true });
const out = {
  fetchedAt: new Date().toISOString(),
  sourceFile: winner.file,
  header,
  parsedCount: standings.length,
  standings,
};
writeFileSync("data/standings.json", JSON.stringify(out, null, 2));

console.log(`\n====================`);
console.log(`✓ data/standings.json 저장 (${standings.length}개 팀)`);
if (standings.length === 10) {
  console.log(`  완벽! 다음 단계는 이 JSON을 대시보드에 연결하기.`);
} else {
  console.log(`  ⚠ 10개 팀 중 ${standings.length}개만 인식. 위 결과를 Claude에게 보내주세요.`);
}
