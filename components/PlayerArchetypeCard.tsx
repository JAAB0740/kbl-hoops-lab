import {
  archetypeAccentBar,
  archetypeChipClass,
  type ArchetypeResult,
} from "@/lib/archetype";

/**
 * 선수 "정체성" 카드 — archetype 라벨 + 분류 근거 + 시그니처 시그널 시각화.
 * 슛 분포(페인트/미드/3점), 핵심 advanced 3종(USG/AST/TS), 퍼센타일 미니바.
 */
export function PlayerArchetypeCard({
  archetype,
}: {
  archetype: ArchetypeResult;
}) {
  const { label, group, tone, reason, signals } = archetype;
  const chip = archetypeChipClass(tone);
  const accent = archetypeAccentBar(tone);

  const isSmallSample = label === "표본 부족";

  return (
    <div className="relative overflow-hidden card p-5">
      <span className={`absolute left-0 top-0 h-full w-1 ${accent}`} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[13px] font-medium uppercase tracking-[0.12em] text-ink-500">
            정체성 — Archetype
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-[18px] font-bold ${chip}`}
            >
              {label}
            </span>
            {group !== "—" && (
              <span className="chip border-court-700 bg-court-800/60 text-ink-400">
                {group}
              </span>
            )}
          </div>
          <p className="mt-3 max-w-xl text-[15px] text-ink-300">{reason}</p>
        </div>

        {!isSmallSample && (
          <div className="grid grid-cols-3 gap-2 sm:min-w-[260px]">
            <PctileStat
              label="USG%"
              value={signals.usgPct}
              pctile={signals.usgPctile}
              fmt={(v) => `${v.toFixed(1)}%`}
            />
            <PctileStat
              label="AST%"
              value={signals.astPct}
              pctile={signals.astPctile}
              fmt={(v) => `${v.toFixed(1)}%`}
            />
            <PctileStat
              label="TS%"
              value={signals.tsPct}
              pctile={signals.tsPctile}
              fmt={(v) => `${v.toFixed(1)}%`}
            />
          </div>
        )}
      </div>

      {/* 슛 분포 바 — 페인트 / 미드 / 3점 비중 */}
      {!isSmallSample && hasShotShares(archetype) && (
        <div className="mt-5 border-t border-court-700/60 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium uppercase tracking-[0.12em] text-ink-500">
              슛 분포
            </span>
            <span className="text-[13px] text-ink-500">
              FGA 대비 비중 · 정규시즌
            </span>
          </div>
          <ShotMixBar
            paint={signals.paintShare ?? 0}
            mid={signals.midShare ?? 0}
            three={signals.threeShare ?? 0}
          />
        </div>
      )}

      {/* 슛 분포 데이터 없을 때 — threeShare는 fgAtt 기반으로 계산되므로 항상 있음 */}
      {!isSmallSample && !hasShotShares(archetype) && signals.threeShare != null && (
        <div className="mt-5 border-t border-court-700/60 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-medium uppercase tracking-[0.12em] text-ink-500">
              슛 성향
            </span>
            <span className="text-[13px] text-ink-500">정규시즌</span>
          </div>
          <ShotMixBar
            paint={0}
            mid={1 - signals.threeShare}
            three={signals.threeShare}
            midLabel="2점"
          />
        </div>
      )}
    </div>
  );
}

function hasShotShares(a: ArchetypeResult): boolean {
  return a.signals.paintShare != null && a.signals.midShare != null;
}

function PctileStat({
  label,
  value,
  pctile,
  fmt,
}: {
  label: string;
  value: number | null;
  pctile: number | null;
  fmt: (v: number) => string;
}) {
  return (
    <div className="rounded-md border border-court-700/60 bg-court-900/40 p-2.5">
      <div className="text-[12px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="stat-num mt-1 text-[16px] font-bold text-ink-50">
        {value != null ? fmt(value) : "—"}
      </div>
      {pctile != null && (
        <div className="mt-1.5">
          <div className="h-1 overflow-hidden rounded bg-court-700/60">
            <div
              className={`h-full ${pctileColor(pctile)}`}
              style={{ width: `${pctile}%` }}
            />
          </div>
          <div className="stat-num mt-1 text-[11px] text-ink-500">
            P{pctile}
          </div>
        </div>
      )}
    </div>
  );
}

function pctileColor(p: number): string {
  if (p >= 80) return "bg-hoop-500";
  if (p >= 60) return "bg-flame-500";
  if (p >= 40) return "bg-neon-500";
  if (p >= 20) return "bg-ink-500";
  return "bg-buzzer-500";
}

function ShotMixBar({
  paint,
  mid,
  three,
  midLabel = "미드",
}: {
  paint: number;
  mid: number;
  three: number;
  midLabel?: string;
}) {
  const total = paint + mid + three;
  // normalize (방어적; 1을 살짝 넘거나 모자랄 수 있음)
  const norm = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const p = norm(paint);
  const m = norm(mid);
  const t = norm(three);

  return (
    <div className="mt-2">
      <div className="flex h-3 overflow-hidden rounded-md border border-court-700/60 bg-court-900/40">
        {paint > 0 && (
          <div
            className="h-full bg-flame-500"
            style={{ width: `${p}%` }}
            title={`페인트 ${p.toFixed(0)}%`}
          />
        )}
        {mid > 0 && (
          <div
            className="h-full bg-neon-500"
            style={{ width: `${m}%` }}
            title={`${midLabel} ${m.toFixed(0)}%`}
          />
        )}
        {three > 0 && (
          <div
            className="h-full bg-buzzer-500"
            style={{ width: `${t}%` }}
            title={`3점 ${t.toFixed(0)}%`}
          />
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
        <LegendCell
          color="bg-flame-500"
          label={paint > 0 ? "페인트" : "—"}
          value={`${p.toFixed(0)}%`}
        />
        <LegendCell color="bg-neon-500" label={midLabel} value={`${m.toFixed(0)}%`} />
        <LegendCell color="bg-buzzer-500" label="3점" value={`${t.toFixed(0)}%`} />
      </div>
    </div>
  );
}

function LegendCell({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-3 rounded-sm ${color}`} />
      <span className="text-ink-500">{label}</span>
      <span className="stat-num ml-auto text-ink-100">{value}</span>
    </div>
  );
}
