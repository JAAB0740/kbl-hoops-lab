/**
 * KBL 팀 순위 스크래퍼 — 다중 소스 자동 시도
 *
 * 각 소스에서 `<tbody>` 에 5줄 이상의 데이터가 있는 테이블을 찾으면 성공.
 * 모든 소스가 JS 렌더링이라 실패하면 마지막 대안(수동 저장) 안내 출력.
 *
 * 실행: npm run fetch:standings
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { mkdirSync, writeFileSync } from "node:fs";
import { load } from "cheerio";

const SOURCES = [
  { id: "naver-desktop", label: "Naver 스포츠 (데스크탑)", url: "https://sports.news.naver.com/basketball/record/index?category=kbl" },
  { id: "naver-mobile",  label: "Naver 스포츠 (모바일)",    url: "https://m.sports.naver.com/basketball/record?category=kbl" },
  { id: "daum-mobile",   label: "Daum 스포츠 (모바일)",     url: "https://m.sports.daum.net/record/kbl/team" },
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
};

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
  // 긴 키워드 먼저 체크 (정관장, 현대모비스 우선)
  return TEAM_REGISTRY.find((t) => text.includes(t.keyword));
}

function parseNumber(s) {
  const m = String(s ?? "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

mkdirSync("data/raw", { recursive: true });

// ─── 소스 순회 ───────────────────────────────
let chosen = null;

for (const src of SOURCES) {
  console.log(`\n▶ ${src.label}`);
  console.log(`  URL: ${src.url}`);
  try {
    const res = await fetch(src.url, { headers: HEADERS, redirect: "follow" });
    const html = await res.text();
    console.log(`  HTTP ${res.status} · ${html.length.toLocaleString()}자`);

    writeFileSync(`data/raw/${src.id}.html`, html);
    const $ = load(html);

    // 가장 큰 tbody를 가진 table 찾기
    let best = null;
    $("table").each((_, tbl) => {
      const header = $(tbl)
        .find("thead th, thead td")
        .map((_, el) => $(el).text().trim())
        .get();
      const rows = [];
      $(tbl)
        .find("tbody tr")
        .each((_, tr) => {
          const cells = $(tr)
            .find("td")
            .map((_, td) => $(td).text().replace(/\s+/g, " ").trim())
            .get();
          if (cells.length > 0) rows.push(cells);
        });
      if (!best || rows.length > best.rows.length) {
        best = { header, rows };
      }
    });

    const rowCount = best?.rows.length ?? 0;
    console.log(`  최대 tbody 데이터 행: ${rowCount}줄`);

    if (rowCount >= 5) {
      console.log(`  ✓ 이 소스 채택`);
      chosen = { src, ...best };
      break;
    } else {
      console.log(`  ⚠ 실제 데이터가 비어있음 (JS 렌더링 추정) — 다음 소스 시도`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }
}

// ─── 소스 전부 실패 시 안내 ─────────────────────
if (!chosen) {
  console.log("\n====================");
  console.log("✗ 모든 시도 소스가 tbody 데이터를 서버에서 주지 않습니다.");
  console.log("  (모두 JavaScript로 나중에 렌더링하는 SPA 구조)");
  console.log("");
  console.log("다음 대안을 추천드립니다:");
  console.log("  Plan B) 브라우저에서 페이지 열고 수동 저장 → 로컬 HTML 파일에서 데이터 추출");
  console.log("  (브라우저는 JS를 실행하므로 저장된 HTML에는 실제 데이터가 포함됩니다)");
  console.log("  Claude에게 알려주시면 Plan B 스크립트 만들어드립니다.");
  process.exit(1);
}

// ─── 선택된 소스에서 파싱 ────────────────────────
console.log(`\n[파싱] ${chosen.src.label}`);
console.log(`  thead: [ ${chosen.header.join(" | ")} ]`);

const header = chosen.header;
const winIdx = header.findIndex((h) => h.trim() === "승");
const lossIdx = header.findIndex((h) => h.trim() === "패");
const pctIdx = header.findIndex((h) => /승률/.test(h));
const rankIdx = header.findIndex((h) => /순위/.test(h));
const gbIdx = header.findIndex((h) => /게임차|GB/i.test(h));
const streakIdx = header.findIndex((h) => /연속/.test(h));

const standings = [];
for (const cells of chosen.rows) {
  const joined = cells.join(" ");
  const team = findTeam(joined);
  if (!team) continue;

  const rank = rankIdx >= 0 ? parseNumber(cells[rankIdx]) : NaN;
  const wins = winIdx >= 0 ? parseNumber(cells[winIdx]) : NaN;
  const losses = lossIdx >= 0 ? parseNumber(cells[lossIdx]) : NaN;
  let winPct = pctIdx >= 0 ? parseNumber(cells[pctIdx]) : NaN;
  if (isNaN(winPct) && !isNaN(wins) && !isNaN(losses)) {
    winPct = wins / (wins + losses);
  }
  const gb = gbIdx >= 0 ? cells[gbIdx] : "";
  let streak = streakIdx >= 0 ? (cells[streakIdx] || "") : "";
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
    gb,
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

// 상태값 자동 부여 (1위 = 우승, 2위 = 직행, 3~6위 = PO, 나머지 = 탈락)
standings.forEach((s) => {
  if (s.rank === 1) { s.status = "regular-champ"; s.note = "정규리그 우승 · 4강 직행"; }
  else if (s.rank === 2) { s.status = "bye"; s.note = "4강 직행"; }
  else if (s.rank >= 3 && s.rank <= 6) { s.status = "po"; s.note = "6강 PO"; }
  else if (s.rank >= 7 && s.rank <= 9) { s.status = "out"; s.note = "PO 탈락"; }
  else if (s.rank === 10) { s.status = "bottom"; s.note = "최하위"; }
});

console.log(`  인식된 팀: ${standings.length} / 10`);
for (const s of standings) {
  console.log(`    ${String(s.rank).padStart(2)} · ${s.name.padEnd(12)} ${s.wins}승 ${s.losses}패 · ${s.winPct.toFixed(3)}`);
}

// ─── 저장 ─────────────────────────────────────
const out = {
  fetchedAt: new Date().toISOString(),
  source: chosen.src.url,
  sourceLabel: chosen.src.label,
  header,
  parsedCount: standings.length,
  standings,
};
writeFileSync("data/standings.json", JSON.stringify(out, null, 2));

console.log(`\n====================`);
if (standings.length === 10) {
  console.log(`✓ 성공! 10개 팀 모두 추출 → data/standings.json 저장 완료`);
  console.log(`  다음 단계: 대시보드가 이 JSON을 읽도록 lib/data.ts 수정`);
} else {
  console.log(`⚠ ${standings.length}/10 팀만 추출됨. 전체 출력 공유 부탁드립니다.`);
}
