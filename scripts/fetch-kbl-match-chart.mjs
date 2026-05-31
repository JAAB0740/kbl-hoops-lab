/**
 * KBL 경기 차트 (shot chart + 리드 트랙 + 누적 스코어 + 베스트 플레이어) fetch
 *
 * Endpoint: GET https://api.kbl.or.kr/match/{gmkey}/match-chart
 *   (KBL 사이트 JS 번들의 `game.getMatchChartByGmkey` 가 호출하는 경로)
 *
 * 응답 키:
 *   - shootLog:   선수별 슛 로그. 각 선수 { pcode, pname, ename, tcode, logs:[{q,x,y,o,d}] }
 *                 · q: "Q1"|"Q2"|"Q3"|"Q4"|"EQ1".. (연장)
 *                 · x,y: 차트 캔버스 절대 좌표 (전체 코트 기준, ~700×~400)
 *                 · o: "O"(성공) | "X"(실패)
 *                 · d: 코트 방향 / 절반 식별자 "1"|"2" (오프디펜스 방향)
 *   - leadTrack:  쿼터별 점수 차 트래킹 { q1:[...], q2:[...], q3:[...], q4:[...] }
 *   - scoreChart: 누적 점수 추이 { home:[...], away:[...] }
 *   - bestPlayer: 베스트 플레이어 비교 [{ part:"ast"|"pts"|"reb"|"stl"|"blk", home:{...}, away:{...} }]
 *
 * 출력: data/match-charts.json
 *   { fetchedAt, source, byGmkey: { [gmkey]: {shootLog, leadTrack, scoreChart, bestPlayer} } }
 *
 * 캐시: 기존 gmkey 는 skip. 강제 재fetch 는 FORCE=1 환경변수.
 *
 * 실행: npm run fetch:kbl-match-chart
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
  Channel: "WEB",
  TeamCode: "",
};

const OUT_PATH = "data/match-charts.json";
const GAMES_PATH = "data/games.json";
const FORCE = process.env.FORCE === "1";

if (!existsSync(GAMES_PATH)) {
  console.error("✗ data/games.json 없음 — npm run fetch:kbl-schedule 먼저 실행");
  process.exit(1);
}

const gamesJson = JSON.parse(readFileSync(GAMES_PATH, "utf-8"));
const games = gamesJson.games ?? [];
const finals = games.filter((g) => g.status === "final" && g.gmkey);
console.log(`총 ${games.length}경기 / 종료 ${finals.length}경기`);

// 기존 캐시 읽기
let existing = {};
if (existsSync(OUT_PATH) && !FORCE) {
  try {
    const prev = JSON.parse(readFileSync(OUT_PATH, "utf-8"));
    existing = prev.byGmkey ?? {};
    console.log(`기존 캐시: ${Object.keys(existing).length}개 (FORCE=1 로 무시 가능)`);
  } catch {
    console.log("기존 파일 파싱 실패 — 새로 시작");
  }
}

const out = { ...existing };
let fetched = 0;
let skipped = 0;
let failed = 0;
let empty = 0;

for (const g of finals) {
  if (out[g.gmkey] && !FORCE) {
    // 이미 캐시 있고 shootLog 있으면 skip
    if (Array.isArray(out[g.gmkey].shootLog) && out[g.gmkey].shootLog.length > 0) {
      skipped++;
      continue;
    }
  }

  const url = `https://api.kbl.or.kr/match/${g.gmkey}/match-chart`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.log(`  ✗ ${g.gmkey} (${g.date}) — HTTP ${res.status}`);
      failed++;
      continue;
    }
    const j = await res.json();
    // 응답 자체가 데이터 (resultCode wrapper 없음). 키 검증.
    if (!j || typeof j !== "object" || !("shootLog" in j)) {
      console.log(`  · ${g.gmkey} (${g.date}) — 비어있음 (예: ${j?.message ?? ""})`);
      empty++;
      continue;
    }

    out[g.gmkey] = {
      shootLog: j.shootLog ?? [],
      leadTrack: j.leadTrack ?? {},
      scoreChart: j.scoreChart ?? {},
      bestPlayer: j.bestPlayer ?? [],
    };
    fetched++;
    if (fetched % 30 === 0) console.log(`  ... ${fetched}건 fetch`);
  } catch (e) {
    console.log(`  ✗ ${g.gmkey} (${g.date}) — ${e.message}`);
    failed++;
  }
}

// 저장
mkdirSync("data", { recursive: true });
const totalShots = Object.values(out).reduce(
  (s, v) =>
    s + (v.shootLog ?? []).reduce((a, p) => a + (p.logs?.length ?? 0), 0),
  0,
);
writeFileSync(
  OUT_PATH,
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "https://api.kbl.or.kr/match/{gmkey}/match-chart",
      totalGames: Object.keys(out).length,
      totalShots,
      byGmkey: out,
    },
    null,
    0,
  ),
);

console.log(`\n✓ ${OUT_PATH}`);
console.log(`  새로 fetch: ${fetched} · skip: ${skipped} · 빈응답: ${empty} · 실패: ${failed}`);
console.log(`  총 ${Object.keys(out).length}경기, ${totalShots.toLocaleString()}슛`);

if (fetched > 0) {
  const sampleKey = Object.keys(out).pop();
  const sample = out[sampleKey];
  const samplePlayer = sample.shootLog?.[0];
  if (samplePlayer) {
    console.log(`\n샘플 (${sampleKey} / ${samplePlayer.pname}):`);
    console.log(`  ${samplePlayer.logs?.length ?? 0}슛, 첫 슛:`, samplePlayer.logs?.[0]);
  }
}
