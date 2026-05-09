"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateTeamRoundSet,
  combineTeamLists,
  TEAM_COLORS,
  VENUE_BY_ROUND,
  type FilterKey,
  type FilteredTeam,
} from "@/lib/data";
import { TeamReboundBars } from "@/components/TeamReboundBars";
import { TeamEfficiencyScatter } from "@/components/TeamEfficiencyScatter";
import { TeamShotProfile } from "@/components/TeamShotProfile";
import { TeamFourFactors } from "@/components/TeamFourFactors";
import { TeamFilterInsights } from "@/components/TeamFilterInsights";
import { TeamClutchCompare } from "@/components/TeamClutchCompare";
import { TeamRoundTrend } from "@/components/TeamRoundTrend";

const ROUND_NUMS = [1, 2, 3, 4, 5, 6] as const;

type StatMode = "traditional" | "advanced";
type Scope = "regular" | "playoff" | "all";
type VenueKey = "home" | "away";
type TimeKey = "q1" | "q2" | "q3" | "q4" | "h1" | "h2";

const VENUE_LABELS: Record<VenueKey, string> = { home: "홈", away: "원정" };
const TIME_LABELS: Record<TimeKey, string> = {
  q1: "1쿼터", q2: "2쿼터", q3: "3쿼터", q4: "4쿼터",
  h1: "전반", h2: "후반",
};

function roundsLabel(set: Set<number>): string {
  const sorted = [...set].sort((a, b) => a - b);
  if (sorted.length === 6) return "1~6라운드";
  const isContiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  if (isContiguous && sorted.length >= 2) {
    return `${sorted[0]}~${sorted[sorted.length - 1]}R`;
  }
  return sorted.map((n) => `${n}R`).join("+");
}

export function TeamAnalytics({
  filters,
}: {
  filters: Record<FilterKey, FilteredTeam[]>;
}) {
  // 스코프 (정규/PO/전체)
  const [scope, setScope] = useState<Scope>("regular");
  // venue (홈/원정/null) — 라운드/시간대와 동시 적용 가능
  const [venueKey, setVenueKey] = useState<VenueKey | null>(null);
  // 라운드 다중 선택
  const [roundSet, setRoundSet] = useState<Set<number>>(new Set());
  // 시간대 (q1~q4, h1, h2) — venue/라운드와 동시 적용 가능
  const [timeKey, setTimeKey] = useState<TimeKey | null>(null);
  // 스탯 모드 (1차 / 2차)
  const [statMode, setStatMode] = useState<StatMode>("traditional");

  // 동적 조합 결과 (time + (venue or rounds)). null = 정적 데이터 사용
  const [dynamicTeams, setDynamicTeams] = useState<FilteredTeam[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, FilteredTeam[]>>(new Map());

  const isRoundMode = scope === "regular" && roundSet.size > 0;
  const isTimeMode = scope === "regular" && timeKey !== null;

  // time 이 활성이면서 venue 또는 round 가 추가로 활성 → 동적 fetch 필요
  const needsDynamic =
    scope === "regular" &&
    timeKey !== null &&
    (venueKey !== null || roundSet.size > 0);

  // 정적 데이터 (단일 차원이거나 venue+round 조합)
  const staticTeams = useMemo<FilteredTeam[]>(() => {
    if (scope === "playoff") return filters.po ?? [];
    if (scope === "all") return combineTeamLists(filters.all ?? [], filters.po ?? []);
    // 시간대만 단일 선택
    if (isTimeMode && timeKey && !venueKey && roundSet.size === 0) {
      return filters[timeKey] ?? [];
    }
    if (isRoundMode) {
      // venue + round → VENUE_BY_ROUND[venue] 가중집계
      const venueRounds = VENUE_BY_ROUND[venueKey ?? "all"];
      return (
        aggregateTeamRoundSet(
          venueRounds as unknown as Record<FilterKey, FilteredTeam[]>,
          [...roundSet],
        ) ?? []
      );
    }
    // 라운드 0개: 단순 venue 데이터
    const v: FilterKey = venueKey === "home" ? "home" : venueKey === "away" ? "away" : "all";
    return filters[v] ?? [];
  }, [scope, filters, venueKey, roundSet, timeKey, isRoundMode, isTimeMode]);

  // 동적 fetch
  useEffect(() => {
    if (!needsDynamic) {
      setDynamicTeams(null);
      setErrMsg(null);
      return;
    }
    const venue = venueKey ?? "";
    const time = timeKey ?? "";
    const roundsCsv = [...roundSet].sort((a, b) => a - b).join(",");
    const cacheKey = `regular|${roundsCsv}|${venue}|${time}`;

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setDynamicTeams(cached);
      setErrMsg(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrMsg(null);
    const params = new URLSearchParams();
    if (roundsCsv) params.set("rounds", roundsCsv);
    if (venue) params.set("venue", venue);
    if (time) params.set("time", time);
    fetch(`/api/team-stats?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        return json.teams as FilteredTeam[];
      })
      .then((teams) => {
        if (cancelled) return;
        cacheRef.current.set(cacheKey, teams);
        setDynamicTeams(teams);
      })
      .catch((e) => {
        if (cancelled) return;
        setErrMsg(e.message);
        setDynamicTeams([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsDynamic, roundSet, venueKey, timeKey]);

  const teams: FilteredTeam[] = needsDynamic ? dynamicTeams ?? [] : staticTeams;

  // 활성 라벨 — 차원 조합
  const activeLabel = useMemo(() => {
    if (scope === "playoff") return "플레이오프";
    if (scope === "all") return "정규 + PO 전체";
    const parts: string[] = [];
    if (roundSet.size > 0) parts.push(roundsLabel(roundSet));
    if (venueKey) parts.push(VENUE_LABELS[venueKey]);
    if (timeKey) parts.push(TIME_LABELS[timeKey]);
    if (parts.length === 0) return "정규시즌 전체";
    return parts.join(" · ");
  }, [scope, roundSet, venueKey, timeKey]);

  // GB 계산
  const gb = useMemo(() => {
    const leader = teams[0];
    return (t: FilteredTeam) => {
      if (!leader) return "-";
      const v = ((leader.wins - t.wins) - (leader.losses - t.losses)) / 2;
      return v <= 0 ? "-" : v.toFixed(1);
    };
  }, [teams]);

  // venue 토글 (같은 키 다시 클릭 시 해제)
  function toggleVenue(k: VenueKey) {
    setVenueKey((prev) => (prev === k ? null : k));
  }
  // time 토글
  function toggleTime(k: TimeKey) {
    setTimeKey((prev) => (prev === k ? null : k));
  }

  const isEmpty = teams.length === 0;

  return (
    <>
      {/* 필터 카드 */}
      <div className="card mb-4 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-ink-50">
              필터
            </h3>
            <p className="mt-1 text-[12px] text-ink-500">
              스코프·홈/원정·쿼터/전후반·라운드를 자유롭게 조합. time + venue/round 조합 시 KBL API에서 동적 fetch.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="chip border-neon-500/30 bg-neon-500/10 text-neon-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-500" />
                로딩 중
              </span>
            )}
            {errMsg && (
              <span className="chip border-buzzer-500/30 bg-buzzer-500/10 text-buzzer-400">
                ✗ {errMsg.slice(0, 30)}
              </span>
            )}
            <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
              현재 기준: {activeLabel}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {/* 스코프 */}
          <FilterRow label="스코프">
            {([
              { key: "regular", label: "정규시즌" },
              { key: "playoff", label: "플레이오프" },
              { key: "all", label: "전체" },
            ] as { key: Scope; label: string }[]).map((opt) => {
              const active = scope === opt.key;
              const available =
                opt.key === "regular"
                  ? (filters.all?.length ?? 0) > 0
                  : opt.key === "playoff"
                    ? (filters.po?.length ?? 0) > 0
                    : (filters.all?.length ?? 0) > 0 && (filters.po?.length ?? 0) > 0;
              return (
                <Chip
                  key={opt.key}
                  active={active}
                  available={available}
                  activeTone="flame"
                  onClick={() => {
                    if (!available) return;
                    setScope(opt.key);
                    if (opt.key !== "regular") {
                      setRoundSet(new Set());
                      setVenueKey(null);
                      setTimeKey(null);
                    }
                  }}
                >
                  {opt.label}
                </Chip>
              );
            })}
          </FilterRow>

          {/* 기본 (홈/원정) — venue 차원 */}
          <FilterRow label="기본">
            <Chip
              active={scope === "regular" && venueKey === null}
              available={scope === "regular"}
              activeTone="flame"
              onClick={() => scope === "regular" && setVenueKey(null)}
            >
              전체
            </Chip>
            {(["home", "away"] as VenueKey[]).map((k) => {
              const active = scope === "regular" && venueKey === k;
              const available = scope === "regular" && (filters[k]?.length ?? 0) > 0;
              return (
                <Chip
                  key={k}
                  active={active}
                  available={available}
                  activeTone="flame"
                  onClick={() => available && toggleVenue(k)}
                >
                  {VENUE_LABELS[k]}
                </Chip>
              );
            })}
          </FilterRow>

          {/* 쿼터 — time 차원 (쿼터/전후반은 한 번에 하나) */}
          <FilterRow label="쿼터">
            <Chip
              active={
                scope === "regular" && (!timeKey || timeKey.startsWith("h"))
              }
              available={scope === "regular"}
              activeTone="flame"
              onClick={() => {
                if (scope !== "regular") return;
                if (timeKey?.startsWith("q")) setTimeKey(null);
              }}
            >
              전체
            </Chip>
            {(["q1", "q2", "q3", "q4"] as TimeKey[]).map((k) => {
              const active = scope === "regular" && timeKey === k;
              const available = scope === "regular" && (filters[k]?.length ?? 0) > 0;
              return (
                <Chip
                  key={k}
                  active={active}
                  available={available}
                  activeTone="neon"
                  onClick={() => available && toggleTime(k)}
                >
                  {TIME_LABELS[k]}
                </Chip>
              );
            })}
          </FilterRow>

          {/* 전후반 — time 차원 (쿼터와 같은 차원, 둘 중 하나만 활성) */}
          <FilterRow label="전후반">
            <Chip
              active={
                scope === "regular" && (!timeKey || timeKey.startsWith("q"))
              }
              available={scope === "regular"}
              activeTone="flame"
              onClick={() => {
                if (scope !== "regular") return;
                if (timeKey?.startsWith("h")) setTimeKey(null);
              }}
            >
              전체
            </Chip>
            {(["h1", "h2"] as TimeKey[]).map((k) => {
              const active = scope === "regular" && timeKey === k;
              const available = scope === "regular" && (filters[k]?.length ?? 0) > 0;
              return (
                <Chip
                  key={k}
                  active={active}
                  available={available}
                  activeTone="neon"
                  onClick={() => available && toggleTime(k)}
                >
                  {TIME_LABELS[k]}
                </Chip>
              );
            })}
          </FilterRow>

          {/* 라운드 (다중 선택) */}
          <FilterRow label="라운드">
            {ROUND_NUMS.map((n) => {
              const key = `r${n}` as FilterKey;
              const available =
                scope === "regular" && (filters[key]?.length ?? 0) > 0;
              const active = scope === "regular" && roundSet.has(n);
              return (
                <Chip
                  key={n}
                  active={active}
                  available={available}
                  activeTone="neon"
                  onClick={() => {
                    if (!available) return;
                    const next = new Set(roundSet);
                    if (next.has(n)) next.delete(n);
                    else next.add(n);
                    setRoundSet(next);
                  }}
                >
                  {n}라운드
                </Chip>
              );
            })}
            {isRoundMode && (
              <>
                <button
                  onClick={() => setRoundSet(new Set([1, 2, 3, 4, 5, 6]))}
                  className="rounded-md border border-court-700 bg-court-800/30 px-2.5 py-1.5 text-[12px] text-ink-400 hover:border-court-500 hover:text-ink-100"
                >
                  전체 선택
                </button>
                <button
                  onClick={() => setRoundSet(new Set())}
                  className="rounded-md border border-court-700 bg-court-800/30 px-2.5 py-1.5 text-[12px] text-ink-400 hover:border-buzzer-500/50 hover:text-buzzer-400"
                >
                  해제
                </button>
              </>
            )}
          </FilterRow>

          {isRoundMode && (
            <p className="ml-14 text-[12px] text-ink-500">
              선택된 라운드들의 가중평균(경기수 기준). 비율은 made/att를 다시 합산해 계산합니다.
            </p>
          )}

          {/* 1차/2차 모드 */}
          <FilterRow label="스탯">
            {(["traditional", "advanced"] as StatMode[]).map((m) => (
              <Chip
                key={m}
                active={statMode === m}
                available
                activeTone="flame"
                onClick={() => setStatMode(m)}
              >
                {m === "traditional" ? "1차 (전통)" : "2차 (고급)"}
              </Chip>
            ))}
          </FilterRow>
        </div>
      </div>

      {isEmpty ? (
        <div className="card p-8 text-center">
          <p className="text-[14px] text-ink-300">
            {loading
              ? "데이터 로딩 중…"
              : "이 필터 조합 데이터가 없어요. 필터를 조정하거나 잠시 후 다시 시도해주세요."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 상단 요약 */}
          <div className="card p-5">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-ink-50">
                  {activeLabel} 기준 팀 랭킹
                </h3>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  {scope === "playoff"
                    ? "플레이오프 출장팀 · 경기당 평균"
                    : scope === "all"
                    ? "정규+PO 합산 (게임수 가중평균)"
                    : needsDynamic
                    ? "KBL API 동적 조합 — 해당 조건에 맞는 경기만 집계"
                    : isRoundMode
                    ? `${venueKey ? VENUE_LABELS[venueKey] + " · " : ""}${roundSet.size}개 라운드 가중평균 · 승률순`
                    : isTimeMode && timeKey
                    ? timeKey.startsWith("q")
                      ? `${TIME_LABELS[timeKey]} 시간대 경기당 평균`
                      : timeKey === "h1"
                        ? "전반(1·2쿼터) 시간대 경기당 평균"
                        : "후반(3·4쿼터) 시간대 경기당 평균"
                    : venueKey === null
                    ? "정규리그 54경기 기준 · 승률순"
                    : venueKey === "home"
                    ? "홈 경기만 · 팀당 27경기 · 승률순"
                    : "원정 경기만 · 팀당 27경기 · 승률순"}
                </p>
              </div>
              <div className="text-[12px] text-ink-500">
                <span className="stat-num text-ink-300">{teams.length}</span>팀
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-court-700/70">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-court-900/70 text-[12px] uppercase tracking-[0.1em] text-ink-500">
                    <th className="py-2.5 pl-3 text-left font-medium">#</th>
                    <th className="py-2.5 text-left font-medium">팀</th>
                    <th className="py-2.5 text-right font-medium">경기</th>
                    <th className="py-2.5 text-right font-medium">승</th>
                    <th className="py-2.5 text-right font-medium">패</th>
                    <th className="py-2.5 text-right font-medium">승률</th>
                    {statMode === "traditional" ? (
                      <>
                        <th className="py-2.5 text-right font-medium">GB</th>
                        <th className="py-2.5 text-right font-medium">PPG</th>
                        <th className="py-2.5 text-right font-medium">RPG</th>
                        <th className="py-2.5 text-right font-medium">APG</th>
                        <th className="py-2.5 text-right font-medium">FG%</th>
                        <th className="py-2.5 pr-3 text-right font-medium">3P%</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 text-right font-medium" title="Offensive Rating">ORtg</th>
                        <th className="py-2.5 text-right font-medium" title="Defensive Rating">DRtg</th>
                        <th className="py-2.5 text-right font-medium" title="Net Rating">Net</th>
                        <th className="py-2.5 text-right font-medium" title="Effective FG%">eFG%</th>
                        <th className="py-2.5 text-right font-medium" title="True Shooting%">TS%</th>
                        <th className="py-2.5 text-right font-medium" title="Pace (per 48m)">Pace</th>
                        <th className="py-2.5 text-right font-medium" title="Turnover%">TOV%</th>
                        <th className="py-2.5 pr-3 text-right font-medium" title="Assist/Turnover">AST/TO</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divider-y">
                  {teams.map((t) => {
                    const color = TEAM_COLORS[t.shortName] ?? "#94a3b8";
                    const a = t.advanced;
                    return (
                      <tr
                        key={t.code}
                        className="group transition hover:bg-court-700/30"
                      >
                        <td className="py-2.5 pl-3">
                          <span
                            className="stat-num text-[14px] font-semibold"
                            style={{ color }}
                          >
                            {t.rank}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-[14px] font-medium text-ink-50">
                              {t.name}
                            </span>
                          </div>
                        </td>
                        <td className="stat-num py-2.5 text-right text-ink-300">{t.games}</td>
                        <td className="stat-num py-2.5 text-right text-ink-100">{t.wins}</td>
                        <td className="stat-num py-2.5 text-right text-ink-300">{t.losses}</td>
                        <td className="stat-num py-2.5 text-right font-medium text-ink-50">
                          {t.winPct.toFixed(3).replace(/^0/, "")}
                        </td>
                        {statMode === "traditional" ? (
                          <>
                            <td className="stat-num py-2.5 text-right text-ink-300">{gb(t)}</td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{t.stats.points.toFixed(1)}</td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{t.stats.rebounds.toFixed(1)}</td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{t.stats.assists.toFixed(1)}</td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{t.stats.fgPct.toFixed(1)}</td>
                            <td className="stat-num py-2.5 pr-3 text-right text-ink-300">{t.stats.threePct.toFixed(1)}</td>
                          </>
                        ) : a ? (
                          <>
                            <td className="stat-num py-2.5 text-right text-ink-300">{a.offRtg.toFixed(1)}</td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{a.defRtg.toFixed(1)}</td>
                            <td
                              className={[
                                "stat-num py-2.5 text-right font-medium",
                                a.netRtg > 0 ? "text-hoop-400" : a.netRtg < 0 ? "text-buzzer-400" : "text-ink-300",
                              ].join(" ")}
                            >
                              {a.netRtg > 0 ? "+" : ""}{a.netRtg.toFixed(1)}
                            </td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{a.efgPct.toFixed(1)}</td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{a.tsPct.toFixed(1)}</td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{a.pace.toFixed(1)}</td>
                            <td className="stat-num py-2.5 text-right text-ink-300">{a.tovPct.toFixed(1)}</td>
                            <td className="stat-num py-2.5 pr-3 text-right text-ink-300">{a.astTo.toFixed(2)}</td>
                          </>
                        ) : (
                          <td colSpan={8} className="stat-num py-2.5 text-center text-[12px] text-ink-500">
                            2차 스탯 데이터 없음 — npm run fetch:kbl-advanced 실행 필요
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 필터 변화 인사이트 — 정규시즌 전체 baseline 과 비교 */}
          {scope === "regular" && (
            <TeamFilterInsights
              teams={teams}
              baseline={filters.all ?? []}
              label={activeLabel}
            />
          )}

          {/* 공수 효율 산점도 (advanced) */}
          <TeamEfficiencyScatter
            teams={teams}
            title={`${activeLabel} 공수 효율 산점도`}
          />

          {/* 4팩터 분석 (Dean Oliver) */}
          <TeamFourFactors
            teams={teams}
            title={`${activeLabel} 4팩터 분석`}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* 리바운드 분해 */}
            <TeamReboundBars
              teams={teams}
              title={`${activeLabel} 리바운드 분해`}
            />

            {/* 슛 프로필 */}
            <TeamShotProfile
              teams={teams}
              title={`${activeLabel} 슛 프로필`}
            />
          </div>

          {/* 라운드별 팀 추이 — 정규시즌일 때만 (라운드 데이터 사용) */}
          {scope === "regular" && (
            <TeamRoundTrend filters={filters} />
          )}

          {/* 클러치 vs 시즌 비교 — 정규시즌 전체 baseline 사용 (필터에 영향 안 받음) */}
          {scope === "regular" && (filters.all?.length ?? 0) > 0 && (
            <TeamClutchCompare baseline={filters.all} />
          )}
        </div>
      )}
    </>
  );
}

// ─── 헬퍼 컴포넌트 ─────────────────────────────────

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-[12px] uppercase tracking-wider text-ink-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  available,
  activeTone,
  onClick,
  children,
}: {
  active: boolean;
  available: boolean;
  activeTone: "flame" | "neon";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeClass =
    activeTone === "flame"
      ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
      : "bg-neon-500/20 text-neon-400 ring-1 ring-neon-500/40";
  return (
    <button
      onClick={onClick}
      disabled={!available}
      className={[
        "rounded-md px-3 py-1.5 text-[13px] font-medium transition",
        active
          ? activeClass
          : available
            ? "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100"
            : "border border-court-800 bg-court-900/40 text-ink-500/50 cursor-not-allowed",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
