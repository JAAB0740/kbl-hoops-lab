/**
 * KBL 데이터 소스 진단 스크립트 (v3 — 회사 네트워크 TLS 우회 포함)
 *
 * 목적:
 *  - Node가 인터넷을 쓸 수 있는지 기준 사이트(google, naver)로 먼저 확인
 *  - 그 다음 KBL 관련 후보 사이트들 찔러서 HTML 구조 진단
 *  - fetch 실패 시 err.cause 까지 풀어서 실제 원인 코드 확인
 *
 * ⚠ 회사/학교 컴퓨터에서 SELF_SIGNED_CERT_IN_CHAIN 오류가 날 경우,
 *   보안 프로그램(알약/V3/PCFilter 등)이 HTTPS 통신에 자체 서명 인증서를
 *   삽입하기 때문입니다. 이 스크립트 안에서만 인증서 검사를 건너뛰도록
 *   아래 한 줄을 세팅합니다. (이 프로세스 밖으로는 영향 없음)
 *
 * 실행: npm run fetch:discover
 */

// ─── 회사 네트워크 MITM 대응 ───────────────────────────────
// 이 설정은 오직 이 스크립트 실행 동안만 유효합니다.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { mkdirSync, writeFileSync } from "node:fs";
import { load } from "cheerio";

const SOURCES = [
  // 기준 사이트 — Node의 인터넷 자체가 되는지 확인용
  {
    id: "baseline-example",
    name: "[기준] example.com",
    url: "https://example.com/",
    baseline: true,
  },
  {
    id: "baseline-naver",
    name: "[기준] naver.com",
    url: "https://www.naver.com/",
    baseline: true,
  },
  // 실제 KBL 데이터 후보
  {
    id: "kbl-official-home",
    name: "KBL 공식 사이트 (메인)",
    url: "https://www.kbl.or.kr/",
  },
  {
    id: "kbl-official-rank",
    name: "KBL 공식 사이트 (팀순위 추정)",
    url: "https://www.kbl.or.kr/record/team/rank",
  },
  {
    id: "daum-kbl",
    name: "Daum 스포츠 KBL",
    url: "https://sports.daum.net/record/kbl",
  },
  {
    id: "daum-kbl-team",
    name: "Daum 스포츠 KBL 팀순위",
    url: "https://sports.daum.net/record/kbl/team",
  },
];

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
};

const RANK_HINTS = ["순위", "승", "패", "승률", "LG", "정관장", "DB", "SK", "KCC", "소노"];

function ellipsis(s, n) {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? clean.slice(0, n) + "…" : clean;
}

// ─── 환경 정보 ─────────────────────────────────────────────
console.log("================ 환경 정보 ================");
console.log(`Node.js: ${process.version}`);
console.log(`플랫폼: ${process.platform} ${process.arch}`);
const proxyVars = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
  "NO_PROXY",
  "no_proxy",
];
const setProxies = proxyVars.filter((v) => process.env[v]);
if (setProxies.length > 0) {
  console.log("프록시 환경변수 감지:");
  for (const v of setProxies) console.log(`  ${v} = ${process.env[v]}`);
} else {
  console.log("프록시 환경변수: 없음");
}

mkdirSync("data/raw", { recursive: true });
const summary = [];

for (const src of SOURCES) {
  console.log("\n" + "─".repeat(50));
  console.log(`▶ ${src.name}`);
  console.log(`  URL: ${src.url}`);

  try {
    const started = Date.now();
    const res = await fetch(src.url, { headers: HEADERS, redirect: "follow" });
    const elapsed = Date.now() - started;
    const html = await res.text();
    console.log(`  ✓ HTTP ${res.status} · ${elapsed}ms · ${html.length.toLocaleString()}자`);

    const rawPath = `data/raw/${src.id}.html`;
    writeFileSync(rawPath, html);

    if (src.baseline) {
      summary.push({ ...src, ok: true, status: res.status, bytes: html.length });
      continue;
    }

    const $ = load(html);
    const tables = $("table");
    console.log(`  <table> 개수: ${tables.length}`);

    let rankLikeCount = 0;
    tables.each((i, tbl) => {
      const $tbl = $(tbl);
      const rows = $tbl.find("tr").length;
      const preview = ellipsis($tbl.text(), 120);
      const hitCount = RANK_HINTS.filter((h) => preview.includes(h)).length;
      const isRankLike = hitCount >= 3;
      if (isRankLike) rankLikeCount++;
      console.log(
        `    · table[${i}]: ${rows}줄 · 힌트 ${hitCount}개 ${isRankLike ? "★" : ""}`
      );
      if (isRankLike) console.log(`        미리보기: ${preview}`);
    });

    summary.push({
      ...src,
      ok: true,
      status: res.status,
      bytes: html.length,
      tables: tables.length,
      rankLikeTables: rankLikeCount,
    });
  } catch (err) {
    console.log(`  ✗ 오류: ${err.message}`);
    const cause = err.cause;
    if (cause) {
      console.log(`    cause.name: ${cause.name ?? "(없음)"}`);
      console.log(`    cause.code: ${cause.code ?? "(없음)"}`);
      console.log(`    cause.errno: ${cause.errno ?? "(없음)"}`);
      console.log(`    cause.message: ${cause.message ?? JSON.stringify(cause)}`);
    } else {
      console.log(`    (err.cause 없음 — err.stack 첫 줄):`);
      console.log(`    ${(err.stack || "").split("\n")[1] || ""}`);
    }
    summary.push({
      ...src,
      ok: false,
      error: err.message,
      cause: cause ? { name: cause.name, code: cause.code, errno: cause.errno } : null,
    });
  }
}

// ─── 요약 ─────────────────────────────────────────────
console.log("\n\n================ 진단 결과 요약 ================");
for (const s of summary) {
  const mark = s.ok ? "✓" : "✗";
  if (s.ok) {
    const rankNote = s.baseline ? "(기준)" : `<table> ${s.tables}개 · 순위표 후보 ${s.rankLikeTables}개`;
    console.log(` ${mark}  ${s.name} · ${s.bytes.toLocaleString()}자 · ${rankNote}`);
  } else {
    const code = s.cause?.code ?? "?";
    console.log(` ${mark}  ${s.name} · ${s.error} · code=${code}`);
  }
}

writeFileSync("data/raw/_summary.json", JSON.stringify(summary, null, 2));

// ─── 안내 ─────────────────────────────────────────────
const baselineOk = summary.filter((s) => s.baseline && s.ok).length;
console.log("\n--- 해석 가이드 ---");
if (baselineOk === 0) {
  console.log("⚠ 기준 사이트(google, naver)도 실패했습니다.");
  console.log("  → Node.js 자체가 인터넷을 못 쓰는 상태예요. 가능한 원인:");
  console.log("     ① 백신/방화벽이 Node.js 차단 (가장 흔함)");
  console.log("     ② VPN/프록시가 켜져 있음");
  console.log("     ③ 회사·학교 네트워크 제한");
  console.log("  → 위 출력과 함께 ‘지금 사용하는 네트워크 환경’을 알려주세요.");
} else if (baselineOk < 2) {
  console.log("⚠ 일부 기준 사이트만 성공 — 특정 도메인이 선택적으로 차단된 상태일 수 있어요.");
} else {
  console.log("✓ 기준 사이트는 모두 성공 — Node 인터넷 연결은 정상입니다.");
  console.log("  KBL 사이트들이 실패했다면 그 사이트들이 봇 차단(WAF)을 했거나 URL이 달라진 것.");
}
console.log("\n위 출력 전체를 복사해서 Claude에게 보내주세요.");
