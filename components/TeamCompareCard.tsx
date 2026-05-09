import type { TeamCompareRow } from "@/lib/types";

interface Props {
  leftName: string;
  rightName: string;
  rows: TeamCompareRow[];
}

export function TeamCompareCard({ leftName, rightName, rows }: Props) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">팀 비교</h3>
          <p className="mt-0.5 text-[14px] text-ink-500">
            주요 지표 side-by-side
          </p>
        </div>
        <button className="chip hover:border-court-600 hover:text-ink-100">
          자세히 →
        </button>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamPill name={leftName} align="right" color="text-neon-400" />
        <span className="text-[13px] font-medium tracking-widest text-ink-500">VS</span>
        <TeamPill name={rightName} align="left" color="text-flame-400" />
      </div>

      <ul className="space-y-2.5">
        {rows.map((r) => (
          <CompareRow key={r.label} row={r} />
        ))}
      </ul>
    </div>
  );
}

function TeamPill({
  name,
  align,
  color,
}: {
  name: string;
  align: "left" | "right";
  color: string;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2",
        align === "right" ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      <span className={`text-sm font-semibold ${color}`}>{name}</span>
    </div>
  );
}

function CompareRow({ row }: { row: TeamCompareRow }) {
  const leftAccent = row.leftBetter === true;
  const rightAccent = row.leftBetter === false;

  return (
    <li>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span
          className={[
            "stat-num text-right text-sm font-semibold",
            leftAccent ? "text-neon-400" : "text-ink-300",
          ].join(" ")}
        >
          {row.leftValue}
        </span>
        <span className="text-[13px] font-medium uppercase tracking-wider text-ink-500">
          {row.label}
        </span>
        <span
          className={[
            "stat-num text-left text-sm font-semibold",
            rightAccent ? "text-flame-400" : "text-ink-300",
          ].join(" ")}
        >
          {row.rightValue}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-court-700/60">
        <CompareBar row={row} />
      </div>
    </li>
  );
}

function CompareBar({ row }: { row: TeamCompareRow }) {
  // 수치 기반 bar 길이 (동일 단위라고 가정)
  const l = parseFloat(row.leftValue.replace(/[^\d.]/g, "")) || 0;
  const r = parseFloat(row.rightValue.replace(/[^\d.]/g, "")) || 0;
  const total = l + r || 1;
  const leftPct = Math.round((l / total) * 100);
  return (
    <div className="flex h-full w-full">
      <div
        className="h-full bg-neon-500/70"
        style={{ width: `${leftPct}%` }}
      />
      <div
        className="h-full bg-flame-500/70"
        style={{ width: `${100 - leftPct}%` }}
      />
    </div>
  );
}
