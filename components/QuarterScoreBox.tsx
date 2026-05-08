import { TEAM_COLORS } from "@/lib/data";
import { getMatchDetail } from "@/lib/matchDetails";

/**
 * 쿼터별 스코어 박스 — 1Q/2Q/3Q/4Q (+ EQ) + Total
 *
 * KBL 공식 박스스코어 화면과 동일한 가로 레이아웃.
 * gmkey 가 없거나 데이터 없는 게임은 null 반환.
 */
export function QuarterScoreBox({
  gmkey,
  homeShort,
  awayShort,
  homeFull,
  awayFull,
  size = "md",
}: {
  gmkey: string | undefined;
  homeShort: string;
  awayShort: string;
  /** 풀네임 (mb) — 없으면 short 사용 */
  homeFull?: string;
  awayFull?: string;
  /** "sm"=카드 펼침용 컴팩트, "md"=상세 페이지 */
  size?: "sm" | "md";
}) {
  const detail = getMatchDetail(gmkey);
  if (!detail) return null;

  const homeColor = TEAM_COLORS[homeShort] ?? "#94a3b8";
  const awayColor = TEAM_COLORS[awayShort] ?? "#94a3b8";

  const homeQ = detail.home;
  const awayQ = detail.away;
  const homeEq = detail.homeEq;
  const awayEq = detail.awayEq;
  const hasEq = homeEq.length > 0 || awayEq.length > 0;

  const homeTotal = [...homeQ, ...homeEq].reduce((a, b) => a + b, 0);
  const awayTotal = [...awayQ, ...awayEq].reduce((a, b) => a + b, 0);

  // 쿼터 라벨
  const labels: string[] = ["1Q", "2Q", "3Q", "4Q"];
  if (hasEq) {
    const eqMax = Math.max(homeEq.length, awayEq.length);
    for (let i = 0; i < eqMax; i++) labels.push(eqMax === 1 ? "EQ" : `EQ${i + 1}`);
  }

  // 패딩/폰트
  const cellPad = size === "sm" ? "px-1.5 py-1" : "px-2.5 py-1.5";
  const cellFont = size === "sm" ? "text-[11px]" : "text-[13px]";
  const totalFont = size === "sm" ? "text-[13px]" : "text-[16px]";
  const labelFont = size === "sm" ? "text-[9px]" : "text-[10px]";

  function row(short: string, full: string | undefined, q: number[], eq: number[], total: number, color: string, won: boolean) {
    const cells = [...q, ...eq];
    while (cells.length < labels.length) cells.push(0); // 길이 맞춤
    return (
      <tr className={won ? "" : "opacity-70"}>
        <td className={`${cellPad} text-left whitespace-nowrap`}>
          <span
            className={`${cellFont} font-semibold`}
            style={{ color: won ? color : undefined }}
          >
            {full ?? short}
          </span>
        </td>
        {cells.map((v, i) => (
          <td key={i} className={`${cellPad} stat-num ${cellFont} text-center`}>
            {v}
          </td>
        ))}
        <td className={`${cellPad} stat-num ${totalFont} text-center font-bold`} style={{ color: won ? color : undefined }}>
          {total}
        </td>
      </tr>
    );
  }

  const homeWon = homeTotal > awayTotal;
  const awayWon = awayTotal > homeTotal;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-court-700/60">
            <th className={`${cellPad} text-left ${labelFont} uppercase tracking-wider text-ink-500 font-medium`}>팀</th>
            {labels.map((l) => (
              <th key={l} className={`${cellPad} text-center ${labelFont} uppercase tracking-wider text-ink-500 font-medium`}>
                {l}
              </th>
            ))}
            <th className={`${cellPad} text-center ${labelFont} uppercase tracking-wider text-flame-400 font-bold`}>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {row(homeShort, homeFull, homeQ, homeEq, homeTotal, homeColor, homeWon)}
          {row(awayShort, awayFull, awayQ, awayEq, awayTotal, awayColor, awayWon)}
        </tbody>
      </table>
    </div>
  );
}
