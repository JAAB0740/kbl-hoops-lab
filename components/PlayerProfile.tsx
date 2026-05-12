"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { aggregateRoundSet, REGULAR_POPULATION, PLAYOFF_POPULATION } from "@/lib/playerProfiles";
import { ShootingRangeChart } from "@/components/ShootingRangeChart";
import { ShotChartCourt } from "@/components/ShotChartCourt";
import { StatRadar, type RadarSeries } from "@/components/StatRadar";
import { percentilesOf } from "@/lib/percentile";
import {
  ageOf,
  fmtCountry,
  fmtDraft,
  fmtPos,
  getPlayerInfo,
  getSeasonsExperience,
  topSchool,
} from "@/lib/playerInfo";
import type {
  ClutchPlayerStats,
  HustlePlayerStats,
  PlayerAdvancedStats,
  PlayerDetailRow,
  PlayerProfile,
} from "@/lib/types";

interface Props {
  profile: PlayerProfile;
  trend: ReturnType<typeof import("@/lib/playerProfiles").getRoundTrend>;
  teammates: PlayerDetailRow[];
}

type TrendKey = "points" | "rebounds" | "assists" | "fgPct" | "threePct" | "minutes";

const TREND_OPTIONS: { key: TrendKey; label: string; color: string; fmt: (v: number) => string }[] = [
  { key: "points",   label: "득점",  color: "#f59e0b", fmt: (v) => v.toFixed(1) },
  { key: "rebounds", label: "리바",  color: "#10b981", fmt: (v) => v.toFixed(1) },
  { key: "assists",  label: "어시",  color: "#0ea5e9", fmt: (v) => v.toFixed(1) },
  { key: "fgPct",    label: "FG%",   color: "#fbbf24", fmt: (v) => v.toFixed(1) + "%" },
  { key: "threePct", label: "3P%",   color: "#fb7185", fmt: (v) => v.toFixed(1) + "%" },
  { key: "minutes",  label: "출장 분", color: "#a1a1aa", fmt: (v) => (v / 60).toFixed(1) },
];

export function PlayerProfileView({ profile, trend, teammates }: Props) {
  const { season, playoff } = profile;
  const games = season?.games ?? 0;

  return (
    <div className="space-y-6">
      {/* 헤더 카드 */}
      <Header profile={profile} />

      {/* 핵심 스탯 카드 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <BigStat
          label="득점"
          value={fmt(season?.points)}
          unit="PPG"
          color="bg-flame-500"
          subtitle={season ? `합산 ${fmtInt(profile.seasonTotal?.points)} 점` : null}
        />
        <BigStat
          label="리바운드"
          value={fmt(season?.rebounds)}
          unit="RPG"
          color="bg-hoop-500"
          subtitle={
            season
              ? `OFF ${fmt(season.oReb)} · DEF ${fmt(season.dReb)}`
              : null
          }
        />
        <BigStat
          label="어시스트"
          value={fmt(season?.assists)}
          unit="APG"
          color="bg-neon-500"
          subtitle={season ? `턴오버 ${fmt(season.turnovers)}` : null}
        />
        <BigStat
          label="출장"
          value={season ? `${games}` : "—"}
          unit="경기"
          color="bg-buzzer-500"
          subtitle={
            season
              ? `${(season.minutes / 60).toFixed(1)}분 · ${season.wins}승 ${season.losses}패`
              : null
          }
        />
      </section>

      {/* 슈팅 효율 + 라운드 추이 (2단) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ShootingPanel row={season} />
        <RoundTrendPanel trend={trend} />
      </section>

      {/* 8축 Spider Chart — 리그 분포 대비 어디에 강한지 */}
      {season && (
        <section>
          <PlayerSpiderPanel season={season} playoff={playoff ?? null} />
        </section>
      )}

      {/* 2차 스탯 (Advanced) */}
      {profile.advanced?.season && (
        <section>
          <AdvancedPanel
            season={profile.advanced.season}
            playoff={profile.advanced.playoff}
          />
        </section>
      )}

      {/* 쿼터별 / 홈원정 패턴 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuarterBreakdownPanel quarters={profile.quarters} halves={profile.halves} />
        <VenueBreakdownPanel venue={profile.venue} season={profile.season} />
      </section>

      {/* 영역별 야투 (KBL 6분할) — 코트 heat map + 막대 차트 */}
      {profile.shooting?.regular && profile.shooting.regular.length > 0 && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
          <ShotChartCourt
            ranges={profile.shooting.regular}
            title="영역별 야투 — 코트 맵"
            subtitle="KBL 공식 6분할 · 정규시즌 평균"
          />
          <ShootingRangeChart
            regular={profile.shooting.regular}
            playoff={profile.shooting.playoff}
          />
        </section>
      )}

      {/* 클러치 + 허슬 (보이지 않는 영향력) */}
      {(profile.clutch?.regular || profile.hustle?.regular) && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ClutchPanel
            regular={profile.clutch?.regular}
            playoff={profile.clutch?.playoff}
            seasonAvg={profile.season}
          />
          <HustlePanel
            regular={profile.hustle?.regular}
            playoff={profile.hustle?.playoff}
          />
        </section>
      )}

      {/* 라운드 범위 비교 */}
      <section>
        <RoundCompare profile={profile} />
      </section>

      {/* PO 비교 + 동료 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PostseasonPanel season={season} playoff={playoff} />
        <TeammatesPanel
          teammates={teammates}
          teamShort={profile.team.short}
        />
      </section>

      {/* 라운드별 상세 테이블 */}
      <section>
        <RoundTable rounds={profile.rounds} />
      </section>
    </div>
  );
}

// ─── 헤더 ──────────────────────────────────────

function Header({ profile }: { profile: PlayerProfile }) {
  const { season, playoff } = profile;
  const info = getPlayerInfo(profile.playerNo);
  const flagTone =
    info?.flag === "외국선수"
      ? "border-buzzer-500/30 bg-buzzer-500/10 text-buzzer-400"
      : info?.flag === "아시아쿼터"
        ? "border-hoop-500/30 bg-hoop-500/10 text-hoop-400"
        : "border-neon-500/30 bg-neon-500/10 text-neon-400";

  return (
    <section className="card overflow-hidden">
      <div className="relative px-6 py-6">
        <div className="absolute left-0 top-0 h-full w-1 bg-flame-500" />

        <div className="flex flex-wrap items-start justify-between gap-6">
          {/* 좌: 사진 + 이름/팀 */}
          <div className="flex items-start gap-4">
            {info?.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={info.photoUrl}
                alt={profile.kname}
                className="h-24 w-20 shrink-0 rounded-md border border-court-700 bg-court-800 object-cover"
                loading="lazy"
              />
            )}
            <div>
              <div className="flex items-center gap-2 text-[14px] font-medium uppercase tracking-[0.12em] text-ink-500">
                <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
                  {profile.team.short}
                </span>
                <span>{profile.team.name}</span>
                {info && (
                  <span className={`chip ${flagTone}`}>
                    {info.flag}
                  </span>
                )}
                {playoff && (
                  <span className="chip border-hoop-500/30 bg-hoop-500/10 text-hoop-400">
                    POST-SEASON
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-50">
                {profile.kname}
                {profile.ename && profile.ename !== profile.kname && (
                  <span className="ml-2 text-base font-normal text-ink-500">
                    {profile.ename}
                  </span>
                )}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 stat-num text-[15px] text-ink-300">
                <span>#{profile.playerNo}</span>
                {info?.backNum && (
                  <span>
                    <span className="text-ink-500">등번호</span> {info.backNum}
                  </span>
                )}
                {info?.pos && (
                  <span>
                    <span className="text-ink-500">포지션</span>{" "}
                    {fmtPos(info.pos)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 우: 시즌 평균 */}
          {season && (
            <div className="flex items-baseline gap-1">
              <span className="text-[14px] uppercase tracking-[0.12em] text-ink-500">
                정규 평균
              </span>
              <span className="ml-3 stat-num text-2xl font-bold text-flame-400">
                {fmt(season.points)}
              </span>
              <span className="stat-num text-sm text-ink-500">/</span>
              <span className="stat-num text-2xl font-bold text-hoop-400">
                {fmt(season.rebounds)}
              </span>
              <span className="stat-num text-sm text-ink-500">/</span>
              <span className="stat-num text-2xl font-bold text-neon-400">
                {fmt(season.assists)}
              </span>
            </div>
          )}
        </div>

        {/* 메타정보 grid */}
        {info && (
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-court-700/60 pt-4 sm:grid-cols-3 md:grid-cols-6">
            <Meta label="국적" value={fmtCountry(info.country, info.flag)} />
            <Meta
              label="생년월일"
              value={
                info.birthday
                  ? `${info.birthday.replace(/-/g, ".")}${
                      ageOf(info.birthday) ? ` (만 ${ageOf(info.birthday)}세)` : ""
                    }`
                  : "—"
              }
            />
            <Meta
              label="신장 / 체중"
              value={
                info.pHeight && info.pWeight
                  ? `${info.pHeight}cm · ${info.pWeight}kg`
                  : info.pHeight
                    ? `${info.pHeight}cm`
                    : "—"
              }
            />
            <Meta
              label="학교"
              value={topSchool(info.schools) ?? "—"}
            />
            <Meta
              label="드래프트"
              value={fmtDraft(info.draft) ?? "—"}
            />
            {info.flag === "국내" ? (
              <Meta
                label="시즌차"
                value={(() => {
                  const s = getSeasonsExperience(info);
                  return s != null ? `${s}년차` : "—";
                })()}
              />
            ) : (
              // 외국선수 / 아시아쿼터 — KBL API의 inSeason 신뢰 불가
              // (예: 자밀 워니 35, 대릴 먼로 33 등 비현실적 값) →
              // 시즌차 대신 선수 구분을 명시
              <Meta label="선수 구분" value={info.flag} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[13px] uppercase tracking-[0.12em] text-ink-500">
        {label}
      </div>
      <div className="mt-0.5 text-[16px] font-medium text-ink-100">{value}</div>
    </div>
  );
}

// ─── 8축 Spider Chart 패널 ──────────────────────────────

/** Radar 8축 — 선수 강점 한 눈에. percentile 기반 (리그 분포 대비 위치). */
const RADAR_AXES = ["PPG", "RPG", "APG", "STL", "BLK", "FG%", "3P%", "FT%"] as const;
const RADAR_KEYS: (keyof PlayerDetailRow)[] = [
  "points", "rebounds", "assists", "steals", "blocks",
  "fgPct", "threePct", "ftPct",
];

function PlayerSpiderPanel({
  season,
  playoff,
}: {
  season: PlayerDetailRow;
  playoff: PlayerDetailRow | null;
}) {
  // 정규시즌 percentile 계산
  const regularPctls = percentilesOf(season, REGULAR_POPULATION, RADAR_KEYS);

  // PO 가 있고 모집단도 있을 때만 PO 시리즈 추가
  const playoffPctls =
    playoff && PLAYOFF_POPULATION.length > 0
      ? percentilesOf(playoff, PLAYOFF_POPULATION, RADAR_KEYS)
      : null;

  // raw 값 라벨 (tooltip 용)
  function rawLabels(row: PlayerDetailRow): string[] {
    return [
      row.points.toFixed(1),
      row.rebounds.toFixed(1),
      row.assists.toFixed(1),
      row.steals.toFixed(1),
      row.blocks.toFixed(1),
      `${row.fgPct.toFixed(1)}%`,
      `${row.threePct.toFixed(1)}%`,
      `${row.ftPct.toFixed(1)}%`,
    ];
  }

  const series: RadarSeries[] = [
    {
      label: "정규시즌",
      color: "#f59e0b",
      values: regularPctls,
      rawLabels: rawLabels(season),
    },
  ];
  if (playoff && playoffPctls) {
    series.push({
      label: "플레이오프",
      color: "#0ea5e9",
      values: playoffPctls,
      rawLabels: rawLabels(playoff),
    });
  }

  const subtitle = playoff
    ? "정규시즌 vs 플레이오프 — 리그 분포 기준 percentile"
    : "리그 분포 대비 8축 강점 비교";

  return (
    <StatRadar
      title="8축 강점 비교"
      subtitle={subtitle}
      axes={[...RADAR_AXES]}
      series={series}
      height={360}
    />
  );
}

// ─── 핵심 스탯 카드 ──────────────────────────────

function BigStat({
  label,
  value,
  unit,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  subtitle: string | null;
}) {
  return (
    <div className="relative overflow-hidden card p-4">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${color}`} />
      <div className="text-[14px] font-medium uppercase tracking-[0.12em] text-ink-500">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="stat-num text-2xl font-bold text-ink-50">{value}</span>
        <span className="text-[14px] text-ink-500">{unit}</span>
      </div>
      {subtitle && (
        <div className="mt-1 text-[14px] text-ink-300">{subtitle}</div>
      )}
    </div>
  );
}

// ─── 슈팅 패널 ──────────────────────────────────

function ShootingPanel({ row }: { row: PlayerDetailRow | null }) {
  if (!row) return <div className="card p-5 text-[16px] text-ink-500">정규 시즌 데이터 없음</div>;
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight text-ink-50">
        슈팅 효율 — 정규 시즌
      </h3>
      <p className="mt-1 text-[14px] text-ink-500">경기당 평균</p>

      <div className="mt-4 space-y-3">
        <ShotBar
          label="필드골"
          made={row.fgMade}
          att={row.fgAtt}
          pct={row.fgPct}
          color="bg-flame-500"
        />
        <ShotBar
          label="3점슛"
          made={row.threeMade}
          att={row.threeAtt}
          pct={row.threePct}
          color="bg-buzzer-500"
        />
        <ShotBar
          label="자유투"
          made={row.ftMade}
          att={row.ftAtt}
          pct={row.ftPct}
          color="bg-neon-500"
        />
        <ShotBar
          label="2점슛"
          made={row.twoMade}
          att={row.twoAtt}
          pct={row.twoPct}
          color="bg-hoop-500"
        />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-court-700/60 pt-4 text-center">
        <MiniStat label="스틸" value={fmt(row.steals)} />
        <MiniStat label="블록" value={fmt(row.blocks)} />
        <MiniStat label="파울" value={fmt(row.fouls)} />
      </div>
    </div>
  );
}

function ShotBar({
  label,
  made,
  att,
  pct,
  color,
}: {
  label: string;
  made: number;
  att: number;
  pct: number;
  color: string;
}) {
  const safe = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] text-ink-300">{label}</span>
        <span className="stat-num text-[15px] text-ink-300">
          <span className="text-ink-50 font-medium">{fmt(made)}</span>
          <span className="text-ink-500"> / {fmt(att)}</span>
          <span className="ml-2 text-flame-400">{fmt1(pct)}%</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-court-700/60">
        <div className={`h-full ${color}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="stat-num text-base font-semibold text-ink-50">{value}</div>
      <div className="mt-0.5 text-[13px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
    </div>
  );
}

// ─── 라운드 추이 차트 ────────────────────────────

function RoundTrendPanel({ trend }: { trend: Props["trend"] }) {
  const [statKey, setStatKey] = useState<TrendKey>("points");
  const opt = TREND_OPTIONS.find((o) => o.key === statKey)!;

  // 값이 모두 null이거나 0이면 빈 상태
  const data = useMemo(
    () =>
      trend.map((t) => ({
        label: t.label,
        value:
          t[statKey] === null
            ? null
            : statKey === "minutes"
              ? Math.round((t.minutes ?? 0) / 60 * 10) / 10
              : (t[statKey] as number),
        games: t.games,
      })),
    [trend, statKey],
  );

  const hasData = data.some((d) => d.value !== null && d.value > 0);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink-50">
            라운드별 추이
          </h3>
          <p className="mt-1 text-[14px] text-ink-500">정규시즌 1~6라운드</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {TREND_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setStatKey(o.key)}
              className={[
                "rounded-md border px-2 py-1 text-[14px] transition",
                statKey === o.key
                  ? "border-flame-500/50 bg-flame-500/10 text-flame-400"
                  : "border-court-700 bg-court-800/50 text-ink-300 hover:border-court-500",
              ].join(" ")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4" style={{ width: "100%", height: 240, minWidth: 0 }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid stroke="#1b1e24" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={{ stroke: "#1b1e24" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={{ stroke: "#1b1e24" }}
                tickLine={false}
                width={30}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "#131519",
                  border: "1px solid #1b1e24",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#fafafa" }}
                formatter={(value: any) =>
                  value == null ? "-" : opt.fmt(Number(value))
                }
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={opt.color}
                strokeWidth={2}
                dot={{ r: 4, fill: opt.color, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[15px] text-ink-500">
            라운드 데이터 없음
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 클러치 패널 ────────────────────────────────

function ClutchPanel({
  regular,
  playoff,
  seasonAvg,
}: {
  regular?: ClutchPlayerStats;
  playoff?: ClutchPlayerStats;
  seasonAvg: PlayerDetailRow | null;
}) {
  if (!regular || regular.games === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold tracking-tight text-ink-50">
          클러치 (박빙 시 stats)
        </h3>
        <p className="mt-3 text-[15px] text-ink-500">
          박빙 시 출장 기록 없음 (4Q 마지막 5분 + 5점차 이내)
        </p>
      </div>
    );
  }

  // 박빙 vs 시즌 평균 비교
  const ROWS: {
    label: string;
    cv: number;
    sv: number | null;
    fmt: (v: number) => string;
  }[] = [
    { label: "득점/G", cv: regular.points, sv: seasonAvg?.points ?? null, fmt: (v) => v.toFixed(1) },
    { label: "FG%", cv: regular.fgPct, sv: seasonAvg?.fgPct ?? null, fmt: (v) => v.toFixed(1) + "%" },
    { label: "3P%", cv: regular.threePct, sv: seasonAvg?.threePct ?? null, fmt: (v) => v.toFixed(1) + "%" },
    { label: "FT%", cv: regular.ftPct, sv: seasonAvg?.ftPct ?? null, fmt: (v) => v.toFixed(1) + "%" },
    { label: "어시", cv: regular.assists, sv: seasonAvg?.assists ?? null, fmt: (v) => v.toFixed(1) },
    { label: "TOV", cv: regular.turnovers, sv: seasonAvg?.turnovers ?? null, fmt: (v) => v.toFixed(1) },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight text-ink-50">
        클러치 (박빙 시 stats)
      </h3>
      <p className="mt-1 text-[14px] text-ink-500">
        4Q 마지막 5분 + 5점차 이내 · {regular.games}경기 출장
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <BigClutchStat label="박빙 PPG" value={regular.points.toFixed(1)} accent="bg-buzzer-500" />
        <BigClutchStat
          label="박빙 FG%"
          value={regular.fgPct.toFixed(1) + "%"}
          accent="bg-flame-500"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-court-700/60">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="bg-court-900/60 text-[13px] uppercase tracking-[0.1em] text-ink-500">
              <th className="px-3 py-2 text-left font-medium">스탯</th>
              <th className="px-3 py-2 text-right font-medium text-buzzer-400">박빙</th>
              <th className="px-3 py-2 text-right font-medium">시즌 평균</th>
              <th className="px-3 py-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody className="divider-y">
            {ROWS.map((r) => {
              const delta = r.sv != null ? r.cv - r.sv : null;
              const isPositive = r.label.startsWith("TOV") ? (delta ?? 0) < 0 : (delta ?? 0) > 0;
              return (
                <tr key={r.label}>
                  <td className="px-3 py-2 text-ink-300">{r.label}</td>
                  <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                    {r.fmt(r.cv)}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {r.sv != null ? r.fmt(r.sv) : "—"}
                  </td>
                  <td
                    className={[
                      "stat-num px-3 py-2 text-right",
                      delta == null
                        ? "text-ink-500"
                        : Math.abs(delta) < 0.05
                          ? "text-ink-500"
                          : isPositive
                            ? "text-hoop-400"
                            : "text-buzzer-400",
                    ].join(" ")}
                  >
                    {delta == null
                      ? "—"
                      : (delta > 0 ? "+" : "") + r.fmt(delta).replace("%", "%p")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {playoff && playoff.games > 0 && (
        <p className="mt-3 text-[14px] text-ink-500">
          PO 박빙: {playoff.games}G · {playoff.points.toFixed(1)}점 · FG {playoff.fgPct.toFixed(1)}%
        </p>
      )}
    </div>
  );
}

function BigClutchStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-court-700/60 bg-court-900/40 p-3">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${accent}`} />
      <div className="text-[13px] font-medium uppercase tracking-[0.12em] text-ink-500">
        {label}
      </div>
      <div className="stat-num mt-1 text-lg font-bold text-ink-50">{value}</div>
    </div>
  );
}

// ─── 허슬 패널 ──────────────────────────────────

function HustlePanel({
  regular,
  playoff,
}: {
  regular?: HustlePlayerStats;
  playoff?: HustlePlayerStats;
}) {
  if (!regular || regular.games === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold tracking-tight text-ink-50">
          허슬 stats
        </h3>
        <p className="mt-3 text-[15px] text-ink-500">데이터 없음</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight text-ink-50">
        허슬 stats
      </h3>
      <p className="mt-1 text-[14px] text-ink-500">
        스탯 시트에 잘 안 보이는 영향력 · {regular.games}경기 평균
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <HustleStat
          label="스크린 어시스트"
          hint="스크린으로 만들어 낸 어시"
          value={regular.screenAssists.toFixed(2)}
          unit="회/G"
          subValue={`= ${regular.screenAssistsPts.toFixed(2)}점/G 기여`}
          color="bg-flame-500"
        />
        <HustleStat
          label="디플렉션"
          hint="공 끊거나 방향 바꾼 횟수"
          value={regular.deflections.toFixed(2)}
          unit="회/G"
          color="bg-neon-500"
        />
      </div>

      {playoff && playoff.games > 0 && (
        <div className="mt-4 rounded-md border border-court-700/60 bg-court-900/40 p-3">
          <div className="text-[13px] uppercase tracking-wider text-ink-500">
            플레이오프 ({playoff.games}G)
          </div>
          <div className="stat-num mt-1 text-[15px] text-ink-300">
            스크린 어시 <span className="font-semibold text-ink-50">{playoff.screenAssists.toFixed(2)}</span> · 디플렉션{" "}
            <span className="font-semibold text-ink-50">{playoff.deflections.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function HustleStat({
  label,
  hint,
  value,
  unit,
  subValue,
  color,
}: {
  label: string;
  hint?: string;
  value: string;
  unit: string;
  subValue?: string;
  color: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-court-700/60 bg-court-900/40 p-3">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${color}`} />
      <div className="text-[14px] font-medium text-ink-100">{label}</div>
      {hint && <div className="text-[13px] text-ink-500">{hint}</div>}
      <div className="mt-2 flex items-baseline gap-1">
        <span className="stat-num text-xl font-bold text-ink-50">{value}</span>
        <span className="text-[13px] text-ink-500">{unit}</span>
      </div>
      {subValue && <div className="mt-1 text-[13px] text-ink-300">{subValue}</div>}
    </div>
  );
}

// ─── 쿼터별 / 전후반 패턴 패널 ───────────────────

function QuarterBreakdownPanel({
  quarters,
  halves,
}: {
  quarters: Record<string, PlayerDetailRow | null>;
  halves: Record<string, PlayerDetailRow | null>;
}) {
  const qData = ["q1", "q2", "q3", "q4"].map((k) => ({
    label: k.toUpperCase(),
    row: quarters[k],
  }));
  const totalPts = qData.reduce(
    (n, q) => n + (q.row?.points ?? 0),
    0,
  );
  const hasData = totalPts > 0;
  const maxPts = Math.max(...qData.map((q) => q.row?.points ?? 0), 0.001);

  // 전후반
  const h1 = halves.h1;
  const h2 = halves.h2;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight text-ink-50">
        쿼터별 평균 득점
      </h3>
      <p className="mt-1 text-[14px] text-ink-500">
        총 {totalPts.toFixed(1)}점 · 정규시즌 누적 평균
      </p>

      {hasData ? (
        <div className="mt-4 space-y-2.5">
          {qData.map((q) => {
            const pts = q.row?.points ?? 0;
            const pct = (pts / maxPts) * 100;
            const sharePct = totalPts > 0 ? (pts / totalPts) * 100 : 0;
            return (
              <div
                key={q.label}
                className="grid grid-cols-[40px_minmax(0,1fr)_120px] items-center gap-3"
              >
                <span className="text-[14px] font-medium uppercase tracking-wider text-ink-500">
                  {q.label}
                </span>
                <div className="relative h-5 overflow-hidden rounded bg-court-700/40">
                  <div
                    className="h-full bg-flame-500/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="stat-num text-right text-[15px]">
                  <span className="font-semibold text-ink-50">
                    {pts.toFixed(1)}
                  </span>
                  <span className="ml-2 text-ink-500">
                    {sharePct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-[15px] text-ink-500">쿼터별 데이터 없음</p>
      )}

      {/* 전후반 비교 */}
      {(h1 || h2) && (
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-court-700/60 pt-4">
          <HalfStat label="전반 (1·2Q)" row={h1} />
          <HalfStat label="후반 (3·4Q)" row={h2} />
        </div>
      )}
    </div>
  );
}

function HalfStat({
  label,
  row,
}: {
  label: string;
  row: PlayerDetailRow | null;
}) {
  if (!row) {
    return (
      <div className="rounded-md border border-court-700/60 bg-court-900/40 p-3">
        <div className="text-[13px] uppercase tracking-wider text-ink-500">
          {label}
        </div>
        <div className="stat-num mt-1 text-[16px] text-ink-500">—</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-court-700/60 bg-court-900/40 p-3">
      <div className="text-[13px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="stat-num mt-1 text-base font-bold text-ink-50">
        {row.points.toFixed(1)}점
      </div>
      <div className="stat-num mt-0.5 text-[14px] text-ink-300">
        {row.rebounds.toFixed(1)}리바 · {row.assists.toFixed(1)}어시 · FG{" "}
        {row.fgPct.toFixed(1)}%
      </div>
    </div>
  );
}

// ─── 홈/원정 패턴 패널 ───────────────────────────

function VenueBreakdownPanel({
  venue,
  season,
}: {
  venue: Record<string, PlayerDetailRow | null>;
  season: PlayerDetailRow | null;
}) {
  const home = venue.home;
  const away = venue.away;

  if (!home && !away) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold tracking-tight text-ink-50">
          홈 / 원정 패턴
        </h3>
        <p className="mt-3 text-[15px] text-ink-500">데이터 없음</p>
      </div>
    );
  }

  const ROWS: {
    label: string;
    pick: (r: PlayerDetailRow) => number;
    fmt: (v: number) => string;
  }[] = [
    { label: "득점", pick: (r) => r.points, fmt: (v) => v.toFixed(1) },
    { label: "리바", pick: (r) => r.rebounds, fmt: (v) => v.toFixed(1) },
    { label: "어시", pick: (r) => r.assists, fmt: (v) => v.toFixed(1) },
    { label: "FG%", pick: (r) => r.fgPct, fmt: (v) => v.toFixed(1) + "%" },
    { label: "3P%", pick: (r) => r.threePct, fmt: (v) => v.toFixed(1) + "%" },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight text-ink-50">
        홈 / 원정 패턴
      </h3>
      <p className="mt-1 text-[14px] text-ink-500">
        같은 선수의 환경별 평균 비교
      </p>

      <div className="mt-4 overflow-hidden rounded-md border border-court-700/60">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="bg-court-900/60 text-[13px] uppercase tracking-[0.1em] text-ink-500">
              <th className="px-3 py-2 text-left font-medium">스탯</th>
              <th className="px-3 py-2 text-right font-medium">홈</th>
              <th className="px-3 py-2 text-right font-medium">원정</th>
              <th className="px-3 py-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody className="divider-y">
            {ROWS.map((r) => {
              const hv = home ? r.pick(home) : null;
              const av = away ? r.pick(away) : null;
              const delta =
                hv != null && av != null ? hv - av : null;
              return (
                <tr key={r.label}>
                  <td className="px-3 py-2 text-ink-300">{r.label}</td>
                  <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                    {hv != null ? r.fmt(hv) : "—"}
                  </td>
                  <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                    {av != null ? r.fmt(av) : "—"}
                  </td>
                  <td
                    className={[
                      "stat-num px-3 py-2 text-right",
                      delta == null
                        ? "text-ink-500"
                        : delta > 0.05
                          ? "text-hoop-400"
                          : delta < -0.05
                            ? "text-buzzer-400"
                            : "text-ink-500",
                    ].join(" ")}
                  >
                    {delta == null
                      ? "—"
                      : (delta > 0 ? "+" : "") + r.fmt(delta).replace("%", "%p")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {home && away && (
        <p className="mt-3 text-[14px] text-ink-500">
          홈 {home.games}G · 원정 {away.games}G
        </p>
      )}
    </div>
  );
}

// ─── 2차 스탯 패널 ──────────────────────────────

function AdvancedPanel({
  season,
  playoff,
}: {
  season: PlayerAdvancedStats;
  playoff?: PlayerAdvancedStats;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-court-700/60 bg-court-800/40 px-5 py-4">
        <h3 className="text-sm font-semibold tracking-tight text-ink-50">
          2차 스탯 (Advanced)
        </h3>
        <p className="mt-1 text-[14px] text-ink-500">
          {playoff ? "정규 / 플레이오프 비교" : "정규 시즌 평균"}
        </p>
      </div>

      {/* 핵심 4개 큰 카드 */}
      <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
        <BigAdvCard
          label="PER"
          hint="Player Efficiency Rating"
          value={season.per.toFixed(1)}
          color="bg-flame-500"
        />
        <BigAdvCard
          label="USG%"
          hint="Usage Rate — 출장 중 공격 점유율"
          value={season.usgPct.toFixed(1) + "%"}
          color="bg-neon-500"
        />
        <BigAdvCard
          label="TS%"
          hint="True Shooting — 자유투 포함 슈팅 효율"
          value={season.tsPct.toFixed(1) + "%"}
          color="bg-hoop-500"
        />
        <BigAdvCard
          label="Net Rating"
          hint="100포제션당 (득점 − 실점)"
          value={(season.netRtg > 0 ? "+" : "") + season.netRtg.toFixed(1)}
          color={season.netRtg >= 0 ? "bg-hoop-500" : "bg-buzzer-500"}
        />
      </div>

      {/* 상세 표 */}
      <div className="overflow-x-auto border-t border-court-700/60">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="bg-court-900/50 text-[13px] uppercase tracking-[0.1em] text-ink-500">
              <th className="px-5 py-2 text-left font-medium">스탯</th>
              <th className="px-3 py-2 text-right font-medium text-flame-400">정규</th>
              {playoff && (
                <>
                  <th className="px-3 py-2 text-right font-medium text-neon-400">PO</th>
                  <th className="px-5 py-2 text-right font-medium">Δ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divider-y">
            {ADV_ROW_DEFS.map((d) => {
              const sv = season[d.key];
              const pv = playoff?.[d.key];
              const delta = pv != null ? pv - sv : null;
              return (
                <tr key={String(d.key)}>
                  <td className="px-5 py-2 text-ink-300" title={d.hint}>
                    <span className="font-medium text-ink-100">{d.label}</span>
                    {d.hint && (
                      <span className="ml-2 text-[13px] text-ink-500">
                        {d.hint}
                      </span>
                    )}
                  </td>
                  <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                    {d.fmt(sv)}
                  </td>
                  {playoff && (
                    <>
                      <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                        {pv != null ? d.fmt(pv) : "—"}
                      </td>
                      <td
                        className={[
                          "stat-num px-5 py-2 text-right",
                          delta == null
                            ? "text-ink-500"
                            : delta > 0.05
                              ? d.higherIsBetter === false
                                ? "text-buzzer-400"
                                : "text-hoop-400"
                              : delta < -0.05
                                ? d.higherIsBetter === false
                                  ? "text-hoop-400"
                                  : "text-buzzer-400"
                                : "text-ink-500",
                        ].join(" ")}
                      >
                        {delta == null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${d.fmt(delta).replace("%", "%p")}`}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ADV_ROW_DEFS: {
  key: keyof PlayerAdvancedStats;
  label: string;
  hint?: string;
  fmt: (v: number) => string;
  higherIsBetter?: boolean;
}[] = [
  { key: "per",      label: "PER",   hint: "효율성 종합", fmt: (v) => v.toFixed(1) },
  { key: "tsPct",    label: "TS%",   hint: "자유투 포함 슈팅 효율", fmt: (v) => v.toFixed(1) + "%" },
  { key: "efgPct",   label: "eFG%",  hint: "3점 가중 FG%", fmt: (v) => v.toFixed(1) + "%" },
  { key: "usgPct",   label: "USG%",  hint: "공격 점유율", fmt: (v) => v.toFixed(1) + "%" },
  { key: "offRtg",   label: "ORtg",  hint: "100포제션당 득점", fmt: (v) => v.toFixed(1) },
  { key: "defRtg",   label: "DRtg",  hint: "100포제션당 실점", fmt: (v) => v.toFixed(1), higherIsBetter: false },
  { key: "netRtg",   label: "Net",   fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1) },
  { key: "astPct",   label: "AST%",  hint: "동료 득점 어시스트 비율", fmt: (v) => v.toFixed(1) + "%" },
  { key: "astTo",    label: "AST/TO", fmt: (v) => v.toFixed(2) },
  { key: "tovPct",   label: "TOV%",  hint: "포제션 대비 턴오버 비율", fmt: (v) => v.toFixed(1) + "%", higherIsBetter: false },
  { key: "orebPct",  label: "ORB%",  hint: "공격 리바 비율", fmt: (v) => v.toFixed(1) + "%" },
  { key: "drebPct",  label: "DRB%",  hint: "수비 리바 비율", fmt: (v) => v.toFixed(1) + "%" },
  { key: "rebPct",   label: "TRB%",  hint: "총 리바 비율", fmt: (v) => v.toFixed(1) + "%" },
  { key: "pace",     label: "Pace",  hint: "페이스 (포제션/48분)", fmt: (v) => v.toFixed(1) },
  { key: "pie",      label: "PIE",   hint: "Player Impact Estimate", fmt: (v) => v.toFixed(1) + "%" },
];

function BigAdvCard({
  label,
  hint,
  value,
  color,
}: {
  label: string;
  hint?: string;
  value: string;
  color: string;
}) {
  return (
    <div className="relative overflow-hidden card p-4">
      <span className={`absolute left-0 top-0 h-full w-[3px] ${color}`} />
      <div className="text-[14px] font-medium uppercase tracking-[0.12em] text-ink-500" title={hint}>
        {label}
      </div>
      <div className="stat-num mt-2 text-2xl font-bold text-ink-50">{value}</div>
      {hint && <div className="mt-1 text-[13px] text-ink-500">{hint}</div>}
    </div>
  );
}

// ─── 라운드 범위 비교 ───────────────────────────

const ROUND_NUMS_PROFILE = [1, 2, 3, 4, 5, 6] as const;

const PRESETS: { label: string; a: number[]; b: number[] }[] = [
  { label: "전반기 vs 후반기", a: [1, 2, 3], b: [4, 5, 6] },
  { label: "1~4R vs 5~6R",    a: [1, 2, 3, 4], b: [5, 6] },
  { label: "개막 vs 막판",     a: [1, 2], b: [5, 6] },
  { label: "홀수 vs 짝수 R",   a: [1, 3, 5], b: [2, 4, 6] },
  { label: "1R vs 6R",        a: [1], b: [6] },
];

/** 선택된 라운드 set → 짧은 라벨. 연속이면 "X~YR", 불연속이면 "1+3+5R" */
function roundsLabel(set: Set<number> | number[]): string {
  const sorted = [...set].sort((a, b) => a - b);
  if (sorted.length === 0) return "—";
  if (sorted.length === 6) return "1~6R";
  const isContiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  if (isContiguous && sorted.length >= 2) {
    return `${sorted[0]}~${sorted[sorted.length - 1]}R`;
  }
  return sorted.map((n) => `${n}R`).join("+");
}

const COMPARE_STATS: {
  key: keyof PlayerDetailRow;
  label: string;
  fmt: (v: number) => string;
}[] = [
  { key: "points",   label: "득점",  fmt: (v) => v.toFixed(1) },
  { key: "rebounds", label: "리바",  fmt: (v) => v.toFixed(1) },
  { key: "assists",  label: "어시",  fmt: (v) => v.toFixed(1) },
  { key: "steals",   label: "스틸",  fmt: (v) => v.toFixed(1) },
  { key: "blocks",   label: "블록",  fmt: (v) => v.toFixed(1) },
  { key: "turnovers", label: "턴오버", fmt: (v) => v.toFixed(1) },
  { key: "fgPct",    label: "FG%",   fmt: (v) => v.toFixed(1) + "%" },
  { key: "threePct", label: "3P%",   fmt: (v) => v.toFixed(1) + "%" },
  { key: "ftPct",    label: "FT%",   fmt: (v) => v.toFixed(1) + "%" },
  { key: "minutes",  label: "출장 분", fmt: (v) => (v / 60).toFixed(1) },
];

function RoundCompare({ profile }: { profile: PlayerProfile }) {
  const [aSet, setASet] = useState<Set<number>>(new Set([1, 2, 3]));
  const [bSet, setBSet] = useState<Set<number>>(new Set([4, 5, 6]));
  const [bEnabled, setBEnabled] = useState(true);

  const aRow = useMemo(
    () => aggregateRoundSet(profile, [...aSet]),
    [profile, aSet],
  );
  const bRow = useMemo(
    () => (bEnabled ? aggregateRoundSet(profile, [...bSet]) : null),
    [profile, bSet, bEnabled],
  );

  const aLabel = roundsLabel(aSet);
  const bLabel = roundsLabel(bSet);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-court-700/60 bg-court-800/40 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-ink-50">
              라운드 조합 비교
            </h3>
            <p className="mt-1 text-[14px] text-ink-500">
              임의의 라운드를 다중 선택해 평균을 보거나, 두 조합을 비교
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setASet(new Set(p.a));
                  setBSet(new Set(p.b));
                  setBEnabled(true);
                }}
                className="rounded-md border border-court-700 bg-court-800/50 px-2.5 py-1 text-[14px] text-ink-300 transition hover:border-flame-500/50 hover:text-flame-400"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* A / B 다중 선택기 */}
      <div className="grid grid-cols-1 gap-3 border-b border-court-700/40 px-5 py-4 md:grid-cols-2">
        <RoundSetPicker
          label="조합 A"
          color="flame"
          set={aSet}
          onChange={setASet}
          enabled
          onToggle={undefined}
          row={aRow}
        />
        <RoundSetPicker
          label="조합 B"
          color="neon"
          set={bSet}
          onChange={setBSet}
          enabled={bEnabled}
          onToggle={() => setBEnabled(!bEnabled)}
          row={bRow}
        />
      </div>

      {/* 비교 표 */}
      <div className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="bg-court-900/60 text-[13px] uppercase tracking-[0.1em] text-ink-500">
              <th className="px-5 py-2 text-left font-medium">스탯</th>
              <th className="px-3 py-2 text-right font-medium text-flame-400">
                A · {aLabel}
                <div className="stat-num text-[9px] text-ink-500">
                  {aRow ? `${aRow.games}G · ${aRow.wins}승 ${aRow.losses}패` : "-"}
                </div>
              </th>
              {bEnabled && (
                <>
                  <th className="px-3 py-2 text-right font-medium text-neon-400">
                    B · {bLabel}
                    <div className="stat-num text-[9px] text-ink-500">
                      {bRow ? `${bRow.games}G · ${bRow.wins}승 ${bRow.losses}패` : "-"}
                    </div>
                  </th>
                  <th className="px-5 py-2 text-right font-medium">B − A</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divider-y">
            {COMPARE_STATS.map((s) => {
              const av = aRow ? Number(aRow[s.key] ?? 0) : 0;
              const bv = bRow ? Number(bRow[s.key] ?? 0) : 0;
              const delta = bv - av;
              return (
                <tr key={String(s.key)}>
                  <td className="px-5 py-2 text-ink-300">{s.label}</td>
                  <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                    {aRow ? s.fmt(av) : "—"}
                  </td>
                  {bEnabled && (
                    <>
                      <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                        {bRow ? s.fmt(bv) : "—"}
                      </td>
                      <td
                        className={[
                          "stat-num px-5 py-2 text-right",
                          !aRow || !bRow
                            ? "text-ink-500"
                            : delta > 0.05
                              ? "text-hoop-400"
                              : delta < -0.05
                                ? "text-buzzer-400"
                                : "text-ink-500",
                        ].join(" ")}
                      >
                        {!aRow || !bRow
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${s.fmt(delta).replace("%", "%p")}`}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoundSetPicker({
  label,
  color,
  set,
  onChange,
  enabled,
  onToggle,
  row,
}: {
  label: string;
  color: "flame" | "neon";
  set: Set<number>;
  onChange: (s: Set<number>) => void;
  enabled: boolean;
  onToggle: (() => void) | undefined;
  row: PlayerDetailRow | null;
}) {
  const accent =
    color === "flame"
      ? "border-flame-500/40 bg-flame-500/5"
      : "border-neon-500/40 bg-neon-500/5";
  const activeChip =
    color === "flame"
      ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
      : "bg-neon-500/20 text-neon-400 ring-1 ring-neon-500/40";

  return (
    <div
      className={[
        "rounded-md border p-3 transition",
        enabled ? accent : "border-court-700 bg-court-800/30 opacity-50",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium uppercase tracking-[0.12em] text-ink-300">
          {label}
          <span className="ml-2 stat-num text-ink-500">
            {roundsLabel(set)}
            {row ? ` · ${row.games}G` : ""}
          </span>
        </span>
        {onToggle && (
          <label className="flex cursor-pointer items-center gap-1.5 text-[14px] text-ink-300">
            <input
              type="checkbox"
              checked={enabled}
              onChange={onToggle}
              className="h-3 w-3 accent-neon-500"
            />
            비교 활성
          </label>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {ROUND_NUMS_PROFILE.map((n) => {
          const active = set.has(n);
          return (
            <button
              key={n}
              onClick={() => {
                if (!enabled) return;
                const next = new Set(set);
                if (next.has(n)) next.delete(n);
                else next.add(n);
                onChange(next);
              }}
              disabled={!enabled}
              className={[
                "rounded-md px-2.5 py-1 text-[15px] font-medium transition",
                active
                  ? activeChip
                  : "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100",
                !enabled ? "cursor-not-allowed opacity-50" : "",
              ].join(" ")}
            >
              {n}R
            </button>
          );
        })}
        <button
          onClick={() => enabled && onChange(new Set([1, 2, 3, 4, 5, 6]))}
          disabled={!enabled}
          className="ml-1 rounded-md border border-court-700 bg-court-800/30 px-2 py-1 text-[13px] text-ink-400 hover:border-court-500 hover:text-ink-100 disabled:opacity-50"
        >
          전체
        </button>
        <button
          onClick={() => enabled && onChange(new Set())}
          disabled={!enabled}
          className="rounded-md border border-court-700 bg-court-800/30 px-2 py-1 text-[13px] text-ink-400 hover:border-buzzer-500/50 hover:text-buzzer-400 disabled:opacity-50"
        >
          비움
        </button>
      </div>
    </div>
  );
}

// ─── 정규 vs PO 비교 ────────────────────────────

function PostseasonPanel({
  season,
  playoff,
}: {
  season: PlayerDetailRow | null;
  playoff: PlayerDetailRow | null;
}) {
  if (!playoff) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold tracking-tight text-ink-50">
          포스트시즌
        </h3>
        <p className="mt-3 text-[15px] text-ink-500">
          이 선수는 이번 PO에 출장하지 않았어요.
        </p>
      </div>
    );
  }

  const rows: { label: string; reg: number | null; po: number | null; fmt?: (v: number) => string }[] = [
    { label: "득점", reg: season?.points ?? null, po: playoff.points },
    { label: "리바", reg: season?.rebounds ?? null, po: playoff.rebounds },
    { label: "어시", reg: season?.assists ?? null, po: playoff.assists },
    { label: "스틸", reg: season?.steals ?? null, po: playoff.steals },
    { label: "블록", reg: season?.blocks ?? null, po: playoff.blocks },
    { label: "FG%",  reg: season?.fgPct ?? null, po: playoff.fgPct, fmt: fmt1 },
    { label: "3P%",  reg: season?.threePct ?? null, po: playoff.threePct, fmt: fmt1 },
  ];

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight text-ink-50">
        정규 vs 플레이오프
      </h3>
      <p className="mt-1 text-[14px] text-ink-500">
        정규 평균 {season?.games ?? 0}G · PO 평균 {playoff.games}G
      </p>

      <div className="mt-4 overflow-hidden rounded-md border border-court-700/60">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="bg-court-900/60 text-[13px] uppercase tracking-[0.1em] text-ink-500">
              <th className="px-3 py-2 text-left font-medium">스탯</th>
              <th className="px-3 py-2 text-right font-medium">정규</th>
              <th className="px-3 py-2 text-right font-medium">PO</th>
              <th className="px-3 py-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody className="divider-y">
            {rows.map((r) => {
              const reg = r.reg ?? 0;
              const po = r.po ?? 0;
              const delta = po - reg;
              const fmtFn = r.fmt ?? fmt;
              return (
                <tr key={r.label}>
                  <td className="px-3 py-2 text-ink-300">{r.label}</td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {fmtFn(reg)}
                  </td>
                  <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                    {fmtFn(po)}
                  </td>
                  <td
                    className={[
                      "stat-num px-3 py-2 text-right",
                      delta > 0.05
                        ? "text-hoop-400"
                        : delta < -0.05
                          ? "text-buzzer-400"
                          : "text-ink-500",
                    ].join(" ")}
                  >
                    {delta > 0 ? "+" : ""}
                    {fmtFn(delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 동료 패널 ──────────────────────────────────

function TeammatesPanel({
  teammates,
  teamShort,
}: {
  teammates: PlayerDetailRow[];
  teamShort: string;
}) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold tracking-tight text-ink-50">
        같은 팀 동료 — 득점 TOP {teammates.length}
      </h3>
      <p className="mt-1 text-[14px] text-ink-500">{teamShort} 소속, 클릭으로 이동</p>

      <div className="mt-4 divider-y">
        {teammates.length === 0 && (
          <div className="py-4 text-[15px] text-ink-500">동료 데이터 없음</div>
        )}
        {teammates.map((t) => (
          <a
            key={t.playerNo}
            href={`/players/${t.playerNo}`}
            className="flex items-center justify-between py-2.5 text-[16px] transition hover:text-flame-400"
          >
            <span className="font-medium text-ink-50">{t.kname}</span>
            <span className="stat-num text-ink-300">
              {fmt(t.points)}득 · {fmt(t.rebounds)}리바 · {fmt(t.assists)}어시
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── 라운드별 테이블 ────────────────────────────

function RoundTable({ rounds }: { rounds: Record<string, PlayerDetailRow | null> }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-court-700/60 bg-court-800/40 px-5 py-4">
        <h3 className="text-sm font-semibold tracking-tight text-ink-50">
          라운드별 상세 테이블
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="text-[13px] uppercase tracking-[0.1em] text-ink-500">
              <th className="pl-5 pr-3 py-2 text-left">라운드</th>
              <th className="px-3 py-2 text-right">G</th>
              <th className="px-3 py-2 text-right">분</th>
              <th className="px-3 py-2 text-right">득점</th>
              <th className="px-3 py-2 text-right">리바</th>
              <th className="px-3 py-2 text-right">어시</th>
              <th className="px-3 py-2 text-right">스틸</th>
              <th className="px-3 py-2 text-right">블록</th>
              <th className="px-3 py-2 text-right">FG%</th>
              <th className="px-3 py-2 text-right">3P%</th>
              <th className="pl-3 pr-5 py-2 text-right">FT%</th>
            </tr>
          </thead>
          <tbody className="divider-y">
            {["r1", "r2", "r3", "r4", "r5", "r6"].map((r) => {
              const row = rounds[r];
              return (
                <tr key={r}>
                  <td className="pl-5 pr-3 py-2 font-medium text-ink-50">
                    {r.toUpperCase()}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {row?.games ?? "—"}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {row ? (row.minutes / 60).toFixed(1) : "—"}
                  </td>
                  <td className="stat-num px-3 py-2 text-right font-semibold text-ink-50">
                    {fmt(row?.points)}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {fmt(row?.rebounds)}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {fmt(row?.assists)}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {fmt(row?.steals)}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {fmt(row?.blocks)}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {row?.fgPct != null ? fmt1(row.fgPct) : "—"}
                  </td>
                  <td className="stat-num px-3 py-2 text-right text-ink-300">
                    {row?.threePct != null ? fmt1(row.threePct) : "—"}
                  </td>
                  <td className="stat-num pl-3 pr-5 py-2 text-right text-ink-300">
                    {row?.ftPct != null ? fmt1(row.ftPct) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 유틸 ──────────────────────────────────────

function fmt(v?: number | null): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

function fmt1(v?: number | null): string {
  if (v == null) return "—";
  return v.toFixed(1);
}

function fmtInt(v?: number | null): string {
  if (v == null) return "—";
  return Math.round(v).toString();
}
