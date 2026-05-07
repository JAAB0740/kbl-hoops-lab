/**
 * 경기 일정 파서 v3 — leaf 필터 제거, 문서 순서 traversal, forward-fill
 *
 * 입력: data/raw/daum-kbl-schedule.html
 * 출력: data/games.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { load } from "cheerio";

const FILE = "data/raw/daum-kbl-schedule.html";

if (!existsSync(FILE)) {
  console.error(`✗ ${FILE} 가 없습니다.`);
  console.error(`  Chrome에서 https://sports.daum.net/schedule/kbl → Ctrl+S → data/raw/ 에 저장.`);
  process.exit(1);
}

const TEAMS = [
  { full: "창원 LG",        short: "LG",      code: "LG" },
  { full: "안양 정관장",     short: "정관장",   code: "KGC" },
  { full: "원주 DB",         short: "DB",      code: "DB" },
  { full: "서울 SK",         short: "SK",      code: "SK" },
  { full: "고양 소노",       short: "소노",    code: "SONO" },
  { full: "부산 KCC",        short: "KCC",     code: "KCC" },
  { full: "수원 KT",         short: "KT",      code: "KT" },
  { full: "울산 현대모비스",  short: "현대모비스", code: "HDMOBIS" },
  { full: "대구 한국가스공사", short: "가스공사", code: "KOGAS" },
  { full: "서울 삼성",       short: "삼성",    code: "SAMSUNG" },
];

const TEAM_SEARCH = [
  ...TEAMS.map((t) => ({ needle: t.full, team: t })),
  ...TEAMS.map((t) => ({ needle: t.short, team: t })),
].sort((a, b) => b.needle.length - a.needle.length);

function findTeams(text) {
  const found = [];
  const spans = [];
  for (const { needle, team } of TEAM_SEARCH) {
    let from = 0;
    while (true) {
      const idx = text.indexOf(needle, from);
      if (idx < 0) break;
      const overlap = spans.some(([s, e]) => idx < e && idx + needle.length > s);
      if (!overlap && !found.find((f) => f.team.code === team.code)) {
        found.push({ team, index: idx });
        spans.push([idx, idx + needle.length]);
      }
      from = idx + needle.length;
    }
  }
  return found.sort((a, b) => a.index - b.index);
}

const YEAR = new Date().getFullYear();

function extractDate(text) {
  const m1 = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m1) return `${YEAR}-${m1[1].padStart(2, "0")}-${m1[2].padStart(2, "0")}`;
  const m2 = text.match(/(?:^|\s|\()(\d{1,2})[.\-\/](\d{1,2})(?!\d)/);
  if (m2) return `${YEAR}-${m2[1].padStart(2, "0")}-${m2[2].padStart(2, "0")}`;
  return null;
}

function extractTime(text) {
  const m = text.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

function extractScore(text) {
  const matches = [...text.matchAll(/(\d{2,3})\s*[:\-]\s*(\d{2,3})/g)];
  const valid = matches.find((m) => {
    const a = +m[1], b = +m[2];
    return a >= 40 && a <= 180 && b >= 40 && b <= 180;
  });
  return valid ? { home: +valid[1], away: +valid[2] } : null;
}

// KBL 2025-26 일정 기반: 정규리그 ~4/8, 6강 PO 4/9-4/17, 4강 PO 4/18-4/30, 챔결 5/1+
function inferTag(dateStr) {
  if (!dateStr) return "";
  const md = dateStr.slice(5); // "MM-DD"
  if (md <= "04-08") return "정규리그";
  if (md <= "04-17") return "6강 PO";
  if (md <= "04-30") return "4강 PO";
  return "챔피언결정전";
}

const html = readFileSync(FILE, "utf-8");
const $ = load(html);

// ─── 수집 (문서 순서) ─────────────────────────────────
console.log(`[1/4] 경기 후보 수집 (문서 순서, leaf 필터 없음)`);
const candidates = [];
$("tr, li, article, div").each((_, el) => {
  const $el = $(el);
  const text = $el.text().replace(/\s+/g, " ").trim();
  if (text.length < 10 || text.length > 300) return;
  const matches = findTeams(text);
  if (matches.length !== 2) return;

  candidates.push({
    text,
    home: matches[0].team,
    away: matches[1].team,
    date: extractDate(text),
    time: extractTime(text),
    score: extractScore(text),
  });
});
console.log(`  후보 ${candidates.length}개`);

// ─── Forward-fill ────────────────────────────────────
console.log(`\n[2/4] 날짜 forward-fill`);
let lastDate = null;
let filled = 0;
for (const c of candidates) {
  if (c.date) {
    lastDate = c.date;
  } else if (lastDate) {
    c.date = lastDate;
    filled++;
  }
}
console.log(`  ${filled}개 경기에 날짜 채움`);

// ─── Dedup (시간 없으면 버림) ──────────────────────────
console.log(`\n[3/4] 중복 제거`);
const seen = new Map();
for (const c of candidates) {
  if (!c.date || !c.time) continue;
  const key = `${c.home.code}|${c.away.code}|${c.date}|${c.time}`;
  if (!seen.has(key)) seen.set(key, c);
}
const unique = [...seen.values()];
console.log(`  유효 경기 ${unique.length}개`);

// ─── 변환 & 정렬 ─────────────────────────────────────
const games = unique
  .map((c) => ({
    homeTeam: c.home.full,
    homeShort: c.home.short,
    awayTeam: c.away.full,
    awayShort: c.away.short,
    date: c.date,
    time: c.time,
    homeScore: c.score?.home ?? null,
    awayScore: c.score?.away ?? null,
    status: c.score
      ? "final"
      : /취소/.test(c.text)
      ? "cancelled"
      : "scheduled",
    tag: inferTag(c.date),
  }))
  .sort((a, b) => {
    const aKey = (a.date ?? "9999-99-99") + " " + (a.time ?? "99:99");
    const bKey = (b.date ?? "9999-99-99") + " " + (b.time ?? "99:99");
    return aKey.localeCompare(bKey);
  });

// ─── 출력 ───────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const past = games.filter((g) => g.date && g.date < today).slice(-5);
const upcoming = games.filter((g) => g.date && g.date >= today).slice(0, 10);

console.log(`\n[4/4] 결과 (오늘 ${today} 기준)`);
console.log(`  [과거 5개]`);
if (past.length === 0) console.log(`   (없음)`);
for (const g of past) {
  const sc = g.homeScore != null ? ` ${g.homeScore}:${g.awayScore}` : "";
  console.log(`   ${g.date} ${g.time} · ${g.tag.padEnd(8)} · ${g.homeShort.padEnd(6)} vs ${g.awayShort.padEnd(6)}${sc}`);
}
console.log(`\n  [오늘 이후 10개]`);
if (upcoming.length === 0) console.log(`   (없음)`);
for (const g of upcoming) {
  const sc = g.homeScore != null ? ` ${g.homeScore}:${g.awayScore}` : "";
  console.log(`   ${g.date} ${g.time} · ${g.tag.padEnd(8)} · ${g.homeShort.padEnd(6)} vs ${g.awayShort.padEnd(6)}${sc}`);
}

mkdirSync("data", { recursive: true });
writeFileSync(
  "data/games.json",
  JSON.stringify({ fetchedAt: new Date().toISOString(), sourceFile: FILE, totalGames: games.length, games }, null, 2)
);

console.log(`\n✓ data/games.json 저장 (${games.length}개)`);
if (upcoming.length === 0) {
  console.log(`  ⚠ 오늘 이후 경기 없음 — 저장된 페이지가 과거 월 위주거나 플레이오프 미표시일 수 있음`);
  console.log(`    Daum에서 월을 ${today.slice(0,7)} (현재월) 으로 설정해 다시 저장해보세요.`);
}
