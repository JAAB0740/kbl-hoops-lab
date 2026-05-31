// 모든 선수에게 classifyArchetype 돌리고 라벨 dump.
// 사용: tsx scripts/dump-archetype-labels.mts [출력파일.json]

import fs from "node:fs";
import { classifyArchetype } from "../lib/archetype";
import { getAllPlayerNos, getPlayerProfile } from "../lib/playerProfiles";
import { getPlayerShotChart } from "../lib/shotChartsServer";

const outPath = process.argv[2] ?? "archetype-labels.json";

const results: Array<{
  pcode: string;
  kname: string;
  label: string;
  group: string;
  paint: number | null;
  mid: number | null;
  three: number | null;
}> = [];

for (const pcode of getAllPlayerNos()) {
  const profile = getPlayerProfile(pcode);
  if (!profile) continue;
  // shotChart 를 profile 에 attach (page 에서 하는 것과 동일하게)
  const shotChart = getPlayerShotChart(pcode);
  if (shotChart) profile.shotChart = shotChart;
  const arch = classifyArchetype(profile);
  if (arch.label === "표본 부족") continue;
  results.push({
    pcode,
    kname: profile.kname,
    label: arch.label,
    group: arch.group,
    paint: arch.signals.paintShare,
    mid: arch.signals.midShare,
    three: arch.signals.threeShare,
  });
}

results.sort((a, b) => a.kname.localeCompare(b.kname, "ko"));
fs.writeFileSync(outPath, JSON.stringify(results, null, 2), "utf-8");
console.log(`${results.length} 선수 → ${outPath}`);
