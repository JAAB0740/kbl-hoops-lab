/**
 * KBL 선수 detail API probe v3 — 라운드별 + 게임로그 endpoint 탐색
 *
 * 1차에서 시즌평균은 동작 확인:
 *   /api/records/player/general/traditional?seasonCode=47&gameCode=01&perCn=1&lastCn=0&partIfList=0
 *
 * 이번 목표:
 *   - 라운드별 (partSc=ROUND, partIfList=1~6)
 *   - 게임로그 (한 선수의 경기별 박스스코어)
 *
 * 실행: npm run probe:kbl-player
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
  Channel: "WEB",
  TeamCode: "",
};

const PLAYER_NO = "291248"; // 자밀 워니 (테스트용)

const TESTS = [
  // 라운드별 (팀처럼 동작할 것으로 예상)
  {
    name: "라운드별 (R1)",
    url: "https://api-stats.kbl.or.kr/api/records/player/general/traditional?seasonCode=47&gameCode=01&perCn=1&lastCn=0&partSc=ROUND&partIfList=1&draftNo=0",
  },
  {
    name: "라운드별 (R6)",
    url: "https://api-stats.kbl.or.kr/api/records/player/general/traditional?seasonCode=47&gameCode=01&perCn=1&lastCn=0&partSc=ROUND&partIfList=6&draftNo=0",
  },
  // PO 시즌
  {
    name: "PO 시즌 (gameCode=03)",
    url: "https://api-stats.kbl.or.kr/api/records/player/general/traditional?seasonCode=47&gameCode=03&perCn=1&lastCn=0&partIfList=0&draftNo=0",
  },
  // 게임로그 후보 1: game traditional path
  {
    name: "게임로그 후보 #1 (game/traditional)",
    url: `https://api-stats.kbl.or.kr/api/records/player/game/traditional?seasonCode=47&playerNo=${PLAYER_NO}&perCn=0&lastCn=0`,
  },
  // 게임로그 후보 2: 단일 선수 시즌
  {
    name: "게임로그 후보 #2 (perCn=0 = 합산?)",
    url: `https://api-stats.kbl.or.kr/api/records/player/general/traditional?seasonCode=47&gameCode=01&perCn=0&lastCn=0&partIfList=0&draftNo=0&playerNo=${PLAYER_NO}`,
  },
  // 게임로그 후보 3: dailyGames path
  {
    name: "게임로그 후보 #3 (player/daily)",
    url: `https://api-stats.kbl.or.kr/api/records/player/daily/traditional?seasonCode=47&playerNo=${PLAYER_NO}`,
  },
  // 게임로그 후보 4: matchup
  {
    name: "게임로그 후보 #4 (player/match)",
    url: `https://api-stats.kbl.or.kr/api/records/player/match/traditional?seasonCode=47&playerNo=${PLAYER_NO}`,
  },
  // 게임로그 후보 5: gameNo로 묶음
  {
    name: "게임로그 후보 #5 (perCn=0 + lastCn=0 + playerNo + gameNo)",
    url: `https://api-stats.kbl.or.kr/api/records/player/general/traditional?seasonCode=47&gameCode=01&perCn=0&lastCn=0&partIfList=0&draftNo=0&playerNo=${PLAYER_NO}&listSc=GAME`,
  },
  // 게임로그 후보 6: byGame
  {
    name: "게임로그 후보 #6 (byGame)",
    url: `https://api-stats.kbl.or.kr/api/records/player/byGame/traditional?seasonCode=47&playerNo=${PLAYER_NO}`,
  },
  // 한 경기의 박스스코어 (특정 경기에서 모든 선수 기록)
  {
    name: "특정 경기 박스스코어 (4/23 LG vs 소노)",
    url: "https://api-stats.kbl.or.kr/api/records/player/game/traditional?seasonCode=47&gameCode=03&gameYmd=20260423",
  },
];

mkdirSync("data/raw/api", { recursive: true });

const successes = [];
for (const t of TESTS) {
  console.log("━".repeat(72));
  console.log(`▶ ${t.name}`);
  console.log(`  ${t.url}`);
  try {
    const res = await fetch(t.url, { headers: HEADERS });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const ok = res.ok && json?.resultCode !== "Fail" && (json?.resultcode ?? 0) < 400;
    console.log(`  ${ok ? "✓" : "✗"} HTTP ${res.status} · ${text.length.toLocaleString()}자`);

    if (json?.message) console.log(`  message: ${json.message}`);
    if (json?.detail) console.log(`  detail: ${json.detail.slice(0, 150)}`);

    if (ok && json) {
      function findArr(o, path = "") {
        if (Array.isArray(o) && o.length > 0) return { arr: o, path: path || "(root)" };
        if (o && typeof o === "object") {
          for (const [k, v] of Object.entries(o)) {
            const p = path ? `${path}.${k}` : k;
            if (Array.isArray(v) && v.length > 0) return { arr: v, path: p };
            if (typeof v === "object" && v !== null) {
              const sub = findArr(v, p);
              if (sub) return sub;
            }
          }
        }
        return null;
      }
      const found = findArr(json);
      if (found) {
        console.log(`  배열 위치: ${found.path} (길이 ${found.arr.length})`);
        const sample = found.arr[0];
        const k = Object.keys(sample);
        console.log(`  키 (${k.length}): ${k.slice(0, 18).join(", ")}${k.length > 18 ? ", ..." : ""}`);
        // 게임로그 단서: gameNo, gameYmd, gameDate 같은 필드 있는지
        const gameKeys = k.filter((x) => /game|date|ymd|opponent|vs/i.test(x));
        if (gameKeys.length > 0) {
          console.log(`  ★ 게임 관련 키: ${gameKeys.join(", ")}`);
        }
        console.log(`  미리보기: ${JSON.stringify(sample).slice(0, 350)}`);
      }
      successes.push({ name: t.name, url: t.url, json });
    } else if (text.length < 250) {
      console.log(`  본문: ${text.slice(0, 250)}`);
    }
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
  }
  console.log();
}

console.log("━".repeat(72));
console.log(`✓ 성공한 후보 ${successes.length}개:`);
for (const s of successes) console.log(`  • ${s.name}`);

// 모든 성공 응답 저장
for (const s of successes) {
  const fname =
    "p-" + s.name.replace(/[^a-zA-Z0-9가-힣]/g, "_").slice(0, 40) + ".json";
  writeFileSync(`data/raw/api/${fname}`, JSON.stringify(s.json, null, 2));
}
console.log("\n→ 응답들이 data/raw/api/p-*.json 에 저장됨.");
