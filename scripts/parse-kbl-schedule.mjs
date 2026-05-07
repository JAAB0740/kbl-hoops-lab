/**
 * KBL 공식 경기 일정 파서 v2
 *
 * 입력: data/raw/kbl-schedule.html
 * 출력: data/games.json
 *
 * v2 변경점:
 *  - 문서 순회 중 자체 텍스트가 "M.D" 형식인 요소를 날짜 섹션 헤더로 인식
 *  - 2개 엠블럼 포함 리프 → 부모 방향으로 올라가서 "한 게임 컨테이너" 찾기
 *    (부모에 3개 이상 엠블럼 있으면 멈춤)
 *  - 그 컨테이너의 text() 로 시간·태그·스코어 추출
 *
 * 실행: npm run parse:kbl-schedule
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { load } from "cheerio";

const FILE = "data/raw/kbl-schedule.html";

if (!existsSync(FILE)) {
  console.error(`✗ ${FILE} 가 없습니다.`);
  console.error(`  https://www.kbl.or.kr/match/schedule?type=PAST 를 Ctrl+S로 저장.`);
  process.exit(1);
}

const EMBLEM_CODE_TO_SHORT = {
  sk: "SK", ss: "삼성", lg: "LG", kgc: "정관장", db: "DB",
  sono: "소노", kcc: "KCC", kt: "KT", hd: "현대모비스",
  pega: "가스공사", kogas: "가스공사", kg: "가스공사",
};

const SHORT_TO_FULL = {
  SK: "서울 SK", 삼성: "서울 삼성", LG: "창원 LG", 정관장: "안양 정관장",
  DB: "원주 DB", 소노: "고양 소노", KCC: "부산 KCC", KT: "수원 KT",
  현대모비스: "울산 현대모비스", 가스공사: "대구 한국가스공사",
};

function teamFromEmblem(className) {
  const m = (className || "").match(/ic-emblem\s+([a-z]+)/i);
  if (!m) return null;
  const code = m[1].toLowerCase();
  const short = EMBLEM_CODE_TO_SHORT[code];
  if (!short) return { short: `?(${code})`, full: `?(${code})`, raw: code };
  return { short, full: SHORT_TO_FULL[short] || short, raw: code };
}

function extractTime(text) {
  const m = text.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

// 날짜 기반으로 플레이오프 라운드 세분화 (KBL 텍스트엔 "플레이오프"까지만 있음)
function extractTag(text, date) {
  if (/챔피언결정/.test(text)) return "챔피언결정전";
  if (/정규시즌|정규리그/.test(text)) return "정규리그";
  if (/플레이오프/.test(text)) {
    if (!date) return "플레이오프";
    const md = date.slice(5);
    if (md <= "04-17") return "6강 PO";
    if (md <= "04-30") return "4강 PO";
    return "챔피언결정전";
  }
  return "";
}

function extractScore(text) {
  // \b 대신 그냥 모든 연속 숫자 시퀀스 추출 (한글·영문자 사이 모두 대응)
  const nums = (text.match(/\d+/g) || []).map(Number);
  const valid = nums.filter((n) => n >= 40 && n <= 180);
  if (valid.length >= 2) return { home: valid[0], away: valid[1], final: true };
  return null;
}

// D리그(2군) 경기 판별
function isDLeague(text) {
  return /D\s*리그|D\-?리그/i.test(text);
}

const html = readFileSync(FILE, "utf-8");
const $ = load(html);

// ─── DOM 순회 — 날짜 헤더 & 게임 리프 수집 ────────────
console.log(`[1/5] DOM 순회 (문서 순서, 날짜 헤더 추적)`);
let currentDate = null;
let datesFound = 0;
const gameLeaves = []; // {leaf, date}

$("*").each((_, el) => {
  const $el = $(el);

  // 자체 텍스트만 (자식 제외) 추출
  const ownText = $el
    .contents()
    .filter((_, n) => n.type === "text")
    .text()
    .trim();

  // 날짜 섹션 헤더 감지: "MM.DD" 포맷 그대로
  const dateMatch = ownText.match(/^\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*$/);
  if (dateMatch) {
    const year = new Date().getFullYear();
    currentDate = `${year}-${dateMatch[1].padStart(2, "0")}-${dateMatch[2].padStart(2, "0")}`;
    datesFound++;
    return;
  }

  // 2개 엠블럼 포함 요소 (리프 판별은 나중에)
  const emblems = $el.find("i[class*='ic-emblem']").toArray();
  if (emblems.length !== 2) return;

  // 리프 판별: 하위 요소 중 2개 엠블럼 포함한 게 있으면 skip
  const hasDeeper = $el
    .find("*")
    .toArray()
    .some((c) => $(c).find("i[class*='ic-emblem']").length === 2);
  if (hasDeeper) return;

  gameLeaves.push({ $leaf: $el, date: currentDate });
});

console.log(`  날짜 헤더 인식: ${datesFound}개`);
console.log(`  게임 리프: ${gameLeaves.length}개`);

// ─── 각 리프에 대해 "게임 컨테이너" 찾기 ─────────────────
console.log(`\n[2/5] 게임 컨테이너 탐색 (부모로 올라가면서 시간·스코어·태그 포함하는 최소 단위 찾기)`);

function findGameContainer($leaf) {
  let $node = $leaf;
  for (let i = 0; i < 8; i++) {
    const $parent = $node.parent();
    if (!$parent.length) break;
    // 부모의 엠블럼 개수 확인 — 3개 이상이면 다른 경기도 포함한 것, 멈춤
    const parentEmblemCount = $parent.find("i[class*='ic-emblem']").length;
    if (parentEmblemCount > 2) break;
    // 부모의 text 가 타당한 길이인지
    const parentTextLen = $parent.text().replace(/\s+/g, " ").trim().length;
    if (parentTextLen > 400) break;
    $node = $parent;
  }
  return $node;
}

const games = [];
let skippedDLeague = 0;
for (const { $leaf, date } of gameLeaves) {
  const $container = findGameContainer($leaf);
  const text = $container.text().replace(/\s+/g, " ").trim();

  // D리그(2군) 경기는 본 리그 아니므로 제외
  if (isDLeague(text)) {
    skippedDLeague++;
    continue;
  }

  const emblems = $leaf.find("i[class*='ic-emblem']").toArray();
  const home = teamFromEmblem($(emblems[0]).attr("class"));
  const away = teamFromEmblem($(emblems[1]).attr("class"));
  if (!home || !away) continue;

  const time = extractTime(text);
  const tag = extractTag(text, date);
  const score = extractScore(text);

  let status = "scheduled";
  if (score) status = "final";
  if (/취소/.test(text)) status = "cancelled";

  games.push({
    date,
    time,
    tag,
    homeTeam: home.full,
    homeShort: home.short,
    awayTeam: away.full,
    awayShort: away.short,
    homeScore: score?.home ?? null,
    awayScore: score?.away ?? null,
    status,
    _containerText: text.slice(0, 120), // 디버그
  });
}

console.log(`  D리그 경기 제외: ${skippedDLeague}개`);
console.log(`  본 리그 경기: ${games.length}개`);

// ─── Dedup ───────────────────────────────────────────
console.log(`\n[3/5] 중복 제거`);
const seen = new Map();
for (const g of games) {
  if (!g.date) continue;
  const key = `${g.date}|${g.time ?? ""}|${g.homeShort}|${g.awayShort}`;
  if (!seen.has(key)) seen.set(key, g);
}
const unique = [...seen.values()];
console.log(`  고유 경기: ${unique.length}개`);

// ─── 진단: 첫 5개 샘플 ───────────────────────────────
console.log(`\n[4/5] 샘플 검증 (처음 5개 경기의 컨테이너 텍스트)`);
for (const g of unique.slice(0, 5)) {
  console.log(`  [${g.date} ${g.time ?? "??:??"} · ${g.tag || "?"}] ${g.homeShort} ${g.homeScore ?? "-"} : ${g.awayScore ?? "-"} ${g.awayShort}`);
  console.log(`    → "${g._containerText}"`);
}

// ─── 정렬 & 저장 ─────────────────────────────────────
unique.sort((a, b) => {
  const k = (x) => (x.date ?? "9999-99-99") + " " + (x.time ?? "99:99");
  return k(a).localeCompare(k(b));
});

const today = new Date().toISOString().slice(0, 10);
const upcoming = unique.filter((g) => g.date >= today).slice(0, 10);

console.log(`\n[5/5] 오늘(${today}) 이후 경기`);
if (upcoming.length === 0) console.log(`  (없음)`);
for (const g of upcoming) {
  const sc = g.homeScore != null ? ` ${g.homeScore}:${g.awayScore}` : "";
  console.log(`  ${g.date} ${g.time ?? "??:??"} · ${(g.tag || "?").padEnd(8)} · ${g.homeShort.padEnd(6)} vs ${g.awayShort.padEnd(6)}${sc} · ${g.status}`);
}

// _containerText 는 저장 전에 제거
const cleanGames = unique.map((g) => {
  const { _containerText, ...rest } = g;
  return rest;
});

mkdirSync("data", { recursive: true });
writeFileSync(
  "data/games.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      sourceFile: FILE,
      totalGames: cleanGames.length,
      games: cleanGames,
    },
    null,
    2
  )
);

console.log(`\n✓ data/games.json 저장 (${cleanGames.length}개)`);
