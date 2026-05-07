/**
 * KBL API 탐사 스크립트
 *
 * 목적: api-stats.kbl.or.kr 의 응답 구조를 확인하고
 *      homeAwaySc 파라미터가 0/1/2 일 때 실제로 어떻게 달라지는지 검증.
 *
 * 실행: npm run probe:kbl-api
 */

// 회사 네트워크 MITM 대응
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { mkdirSync, writeFileSync } from "node:fs";

const BASE_URL = "https://api-stats.kbl.or.kr/api/records/team/general/traditional";
const COMMON_PARAMS = {
  seasonCode: "47",
  gameCode: "01,03,04",
  sortDataSc: "WIN_A",
  sortOrderSc: "desc",
  perCn: "1",
  lastCn: "0",
  partIfList: "0",
  draftNo: "0",
};

function buildUrl(extra) {
  const params = { ...COMMON_PARAMS, ...extra };
  const qs = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `${BASE_URL}?${qs}`;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
};

mkdirSync("data/raw/api", { recursive: true });

const PROBES = [
  { label: "전체 (homeAwaySc=0)", params: { homeAwaySc: "0" }, file: "kbl-team-all.json" },
  { label: "홈만 (homeAwaySc=1)", params: { homeAwaySc: "1" }, file: "kbl-team-home.json" },
  { label: "원정만 (homeAwaySc=2)", params: { homeAwaySc: "2" }, file: "kbl-team-away.json" },
];

for (const probe of PROBES) {
  const url = buildUrl(probe.params);
  console.log(`\n${"=".repeat(70)}`);
  console.log(`▶ ${probe.label}`);
  console.log(`  URL: ${url}`);

  try {
    const started = Date.now();
    const res = await fetch(url, { headers: HEADERS });
    const elapsed = Date.now() - started;
    console.log(`  HTTP ${res.status} · ${elapsed}ms`);

    if (!res.ok) {
      console.log(`  ✗ 실패: ${res.statusText}`);
      const body = await res.text();
      console.log(`  응답 일부: ${body.slice(0, 300)}`);
      continue;
    }

    const text = await res.text();
    console.log(`  응답 크기: ${text.length.toLocaleString()}자`);

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log(`  ⚠ JSON 파싱 실패 — 응답 일부:`);
      console.log(text.slice(0, 500));
      continue;
    }

    // 저장
    writeFileSync(`data/raw/api/${probe.file}`, JSON.stringify(json, null, 2));
    console.log(`  ✓ 저장: data/raw/api/${probe.file}`);

    // 구조 탐색 — 최상위 키 요약
    console.log(`  최상위 키: ${Object.keys(json).join(", ")}`);

    // 흔한 응답 구조 추측: result/data/list 등
    const candidates = ["list", "data", "result", "records", "teams", "rows", "body"];
    let arr = null;
    let arrPath = "";

    // 깊이 2까지 배열 찾기
    function findArray(obj, path = "") {
      for (const [k, v] of Object.entries(obj || {})) {
        const p = path ? `${path}.${k}` : k;
        if (Array.isArray(v) && v.length > 0) {
          return { arr: v, path: p };
        }
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          const sub = findArray(v, p);
          if (sub) return sub;
        }
      }
      return null;
    }
    const found = findArray(json);
    if (found) {
      arr = found.arr;
      arrPath = found.path;
      console.log(`  배열 경로: "${arrPath}" · 길이 ${arr.length}`);
      console.log(`  첫 요소 키: ${Object.keys(arr[0]).slice(0, 15).join(", ")}${Object.keys(arr[0]).length > 15 ? ", ..." : ""}`);

      // LG / 창원 팀 찾아서 스탯 요약
      const lg = arr.find((t) =>
        JSON.stringify(t).includes("LG") || JSON.stringify(t).includes("창원")
      );
      if (lg) {
        const preview = Object.fromEntries(
          Object.entries(lg).slice(0, 20)
        );
        console.log(`  LG 팀 데이터 샘플:`);
        console.log("   ", JSON.stringify(preview).slice(0, 400));
      }
    } else {
      console.log(`  ⚠ 배열 데이터 못 찾음 — JSON 구조:`);
      console.log("   ", JSON.stringify(json, null, 2).slice(0, 800));
    }
  } catch (err) {
    console.log(`  ✗ 오류: ${err.message}`);
    if (err.cause) {
      console.log(`    cause.code: ${err.cause.code ?? "?"}`);
      console.log(`    cause.message: ${err.cause.message ?? ""}`);
    }
  }
}

console.log(`\n${"=".repeat(70)}`);
console.log(`✓ 진단 완료. data/raw/api/ 에 3개 JSON 저장됨.`);
console.log(`  출력 전체를 Claude에게 공유해주세요.`);
