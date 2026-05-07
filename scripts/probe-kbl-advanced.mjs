/**
 * KBL 2차 스탯 (advanced) endpoint probe
 *
 * 1차(traditional) 동작 확인됨:
 *   /api/records/team/general/traditional
 *   /api/records/player/general/traditional
 *
 * 후보 path:
 *   - .../general/advanced
 *   - .../advanced/traditional
 *   - .../general/secondary
 *
 * 실행: npm run probe:kbl-advanced
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
};

const TEAM_BASE = "https://api-stats.kbl.or.kr/api/records/team";
const PLAYER_BASE = "https://api-stats.kbl.or.kr/api/records/player";
const COMMON = "seasonCode=47&gameCode=01&perCn=1&lastCn=0&partIfList=0&draftNo=0";

const TESTS = [
  // 팀
  { name: "team general advanced", url: `${TEAM_BASE}/general/advanced?${COMMON}` },
  { name: "team advanced traditional", url: `${TEAM_BASE}/advanced/traditional?${COMMON}` },
  { name: "team general secondary", url: `${TEAM_BASE}/general/secondary?${COMMON}` },
  { name: "team secondary traditional", url: `${TEAM_BASE}/secondary/traditional?${COMMON}` },
  { name: "team general fourFactors", url: `${TEAM_BASE}/general/fourFactors?${COMMON}` },
  { name: "team general miscellaneous", url: `${TEAM_BASE}/general/miscellaneous?${COMMON}` },
  // 선수
  { name: "player general advanced", url: `${PLAYER_BASE}/general/advanced?${COMMON}` },
  { name: "player advanced traditional", url: `${PLAYER_BASE}/advanced/traditional?${COMMON}` },
  { name: "player general secondary", url: `${PLAYER_BASE}/general/secondary?${COMMON}` },
  { name: "player secondary traditional", url: `${PLAYER_BASE}/secondary/traditional?${COMMON}` },
  { name: "player general miscellaneous", url: `${PLAYER_BASE}/general/miscellaneous?${COMMON}` },
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

    if (ok && json?.data?.length > 0) {
      const sample = json.data[0];
      const k = Object.keys(sample);
      console.log(`  배열 길이: ${json.data.length}`);
      console.log(`  키 (${k.length}): ${k.slice(0, 25).join(", ")}${k.length > 25 ? ", ..." : ""}`);
      // 2차 스탯 후보 키
      const advKeys = k.filter((x) =>
        /eFG|TS|usage|usg|pace|ortg|drtg|netRtg|net_|rating|ratio|four|effi|poss/i.test(x)
      );
      if (advKeys.length > 0) {
        console.log(`  ★ 2차 스탯 후보 키: ${advKeys.join(", ")}`);
      }
      console.log(`  미리보기: ${JSON.stringify(sample).slice(0, 350)}`);
      successes.push({ name: t.name, url: t.url, json });
    }
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
  }
  console.log();
}

console.log("━".repeat(72));
if (successes.length > 0) {
  console.log(`✓ 성공한 후보 ${successes.length}개:`);
  for (const s of successes) console.log(`  • ${s.name}`);
  for (const s of successes) {
    const fname = "adv-" + s.name.replace(/[^a-zA-Z0-9가-힣]/g, "_").slice(0, 40) + ".json";
    writeFileSync(`data/raw/api/${fname}`, JSON.stringify(s.json, null, 2));
  }
  console.log(`\n→ 응답들이 data/raw/api/adv-*.json 에 저장됨.`);
} else {
  console.log("✗ 모두 실패. 직접 계산으로 가야 합니다.");
}
