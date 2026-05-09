"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CustomScatter } from "@/components/CustomScatter";
import { PlayersTable } from "@/components/PlayersTable";
import {
  aggregatePlayersForRoundSet,
  combinePlayerLists,
  type RawPlayer,
} from "@/lib/data";

const ROUND_NUMS = [1, 2, 3, 4, 5, 6] as const;

type Scope = "regular" | "playoff" | "all";
type StatMode = "traditional" | "advanced" | "registry";

interface Props {
  /** 정규시즌 평균 */
  seasonPlayers: RawPlayer[];
  /** 플레이오프 평균 */
  playoffPlayers: RawPlayer[];
  /** 라운드별 RawPlayer 데이터 (가중평균 계산용) */
  perRound: Record<string, RawPlayer[]>;
  /** 홈/원정/쿼터/전후반별 RawPlayer (단일 차원 토글) */
  byKey?: Record<string, RawPlayer[]>;
}

type VenueKey = "home" | "away";
type TimeKey = "q1" | "q2" | "q3" | "q4" | "h1" | "h2";

const VENUE_LABELS: Record<VenueKey, string> = { home: "홈", away: "원정" };
const TIME_LABELS: Record<TimeKey, string> = {
  q1: "1쿼터", q2: "2쿼터", q3: "3쿼터", q4: "4쿼터",
  h1: "전반", h2: "후반",
};

function roundsLabel(set: Set<number>): string {
  const sorted = [...set].sort((a, b) => a - b);
  if (sorted.length === 6) return "1~6라운드 전체";
  const isContiguous = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
  if (isContiguous && sorted.length >= 2) {
    return `${sorted[0]}~${sorted[sorted.length - 1]}라운드`;
  }
  return sorted.map((n) => `${n}R`).join("+");
}

const PRESETS: { label: string; set: number[] }[] = [
  { label: "전반기 (1~3R)", set: [1, 2, 3] },
  { label: "후반기 (4~6R)", set: [4, 5, 6] },
  { label: "1~4R", set: [1, 2, 3, 4] },
  { label: "5~6R", set: [5, 6] },
  { label: "홀수 R", set: [1, 3, 5] },
  { label: "짝수 R", set: [2, 4, 6] },
];

export function PlayersExplorer({
  seasonPlayers,
  playoffPlayers,
  perRound,
  byKey,
}: Props) {
  const [scope, setScope] = useState<Scope>("regular");
  const [roundSet, setRoundSet] = useState<Set<number>>(new Set());
  // venue (홈/원정)와 time (쿼터/전후반)을 독립적으로 동시 선택 가능
  const [venueKey, setVenueKey] = useState<VenueKey | null>(null);
  const [timeKey, setTimeKey] = useState<TimeKey | null>(null);
  const [statMode, setStatMode] = useState<StatMode>("traditional");
  // 동적 조합 결과 (둘 이상 차원 조합). null = 정적 props 사용
  const [dynamicPlayers, setDynamicPlayers] = useState<RawPlayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // 같은 조합 키에 대한 캐시
  const cacheRef = useRef<Map<string, RawPlayer[]>>(new Map());

  const isRoundMode = scope === "regular" && roundSet.size > 0;

  // 활성 차원 개수 — 2개 이상이면 동적 fetch 필요
  const activeDims =
    (roundSet.size > 0 ? 1 : 0) +
    (venueKey ? 1 : 0) +
    (timeKey ? 1 : 0);
  const needsDynamic = scope === "regular" && activeDims >= 2;

  // 정적으로 즉시 계산 가능한 경우 (단일 차원)
  const staticPlayers = useMemo(() => {
    if (scope === "playoff") return playoffPlayers;
    if (scope === "all") return combinePlayerLists(seasonPlayers, playoffPlayers);
    // regular — 단일 차원만
    if (venueKey && roundSet.size === 0 && !timeKey) return byKey?.[venueKey] ?? [];
    if (timeKey && roundSet.size === 0 && !venueKey) return byKey?.[timeKey] ?? [];
    if (roundSet.size > 0 && !venueKey && !timeKey) {
      return aggregatePlayersForRoundSet(perRound, [...roundSet]);
    }
    if (!venueKey && !timeKey && roundSet.size === 0) return seasonPlayers;
    return [];
  }, [scope, seasonPlayers, playoffPlayers, perRound, byKey, roundSet, venueKey, timeKey]);

  // 동적 조합 fetch
  useEffect(() => {
    if (!needsDynamic) {
      setDynamicPlayers(null);
      setErrMsg(null);
      return;
    }
    const venue = venueKey ?? "";
    const time = timeKey ?? "";
    const roundsCsv = [...roundSet].sort((a, b) => a - b).join(",");
    const cacheKey = `regular|${roundsCsv}|${venue}|${time}`;

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setDynamicPlayers(cached);
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
    fetch(`/api/player-stats?${params}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        return json.players as RawPlayer[];
      })
      .then((players) => {
        if (cancelled) return;
        cacheRef.current.set(cacheKey, players);
        setDynamicPlayers(players);
      })
      .catch((e) => {
        if (cancelled) return;
        setErrMsg(e.message);
        setDynamicPlayers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsDynamic, roundSet, venueKey, timeKey]);

  const players = needsDynamic ? dynamicPlayers ?? [] : staticPlayers;

  const label = useMemo(() => {
    if (scope === "playoff") return "플레이오프 평균";
    if (scope === "all") return "정규 + 플레이오프 합산";
    const parts: string[] = [];
    if (roundSet.size > 0) parts.push(roundsLabel(roundSet));
    if (venueKey) parts.push(VENUE_LABELS[venueKey]);
    if (timeKey) parts.push(TIME_LABELS[timeKey]);
    if (parts.length === 0) return "정규 시즌 평균";
    return parts.join(" · ");
  }, [scope, roundSet, venueKey, timeKey]);

  // venue 토글 (같은 키 다시 클릭 시 해제)
  function toggleVenue(k: VenueKey) {
    setVenueKey((prev) => (prev === k ? null : k));
  }
  // time 토글 (쿼터/전후반은 한 번에 하나만)
  function toggleTime(k: TimeKey) {
    setTimeKey((prev) => (prev === k ? null : k));
  }

  return (
    <div className="space-y-6">
      {/* 산점도 (위) */}
      <CustomScatter players={players} />

      {/* 필터 카드 — 팀 페이지와 동일한 행 기반 토글 */}
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-ink-50">
              필터
            </h3>
            <p className="mt-1 text-[12px] text-ink-500">
              스코프·라운드·스탯 모드를 조합. 정규시즌일 때만 라운드 다중 선택 가능.
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
              현재 기준: {label} · {players.length}명
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
                  ? seasonPlayers.length > 0
                  : opt.key === "playoff"
                    ? playoffPlayers.length > 0
                    : seasonPlayers.length > 0 && playoffPlayers.length > 0;
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
              const available = scope === "regular" && (byKey?.[k]?.length ?? 0) > 0;
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

          {/* 쿼터 — time 차원 */}
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
              const available = scope === "regular" && (byKey?.[k]?.length ?? 0) > 0;
              return (
                <Chip
                  key={k}
                  active={active}
                  available={available}
                  activeTone="flame"
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
              const available = scope === "regular" && (byKey?.[k]?.length ?? 0) > 0;
              return (
                <Chip
                  key={k}
                  active={active}
                  available={available}
                  activeTone="flame"
                  onClick={() => available && toggleTime(k)}
                >
                  {TIME_LABELS[k]}
                </Chip>
              );
            })}
          </FilterRow>

          {/* 라운드 */}
          <FilterRow label="라운드">
            {ROUND_NUMS.map((n) => {
              const active = scope === "regular" && roundSet.has(n);
              const available =
                scope === "regular" && (perRound[`r${n}`]?.length ?? 0) > 0;
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
                    // 라운드와 venue/quarter/half 동시 적용 가능 (동적 fetch)
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

          {/* 스탯 (1차 / 2차 / 등록) */}
          <FilterRow label="스탯">
            {(["traditional", "advanced", "registry"] as StatMode[]).map((m) => (
              <Chip
                key={m}
                active={statMode === m}
                available
                activeTone="flame"
                onClick={() => setStatMode(m)}
              >
                {m === "traditional"
                  ? "1차 (전통)"
                  : m === "advanced"
                    ? "2차 (고급)"
                    : "등록 정보"}
              </Chip>
            ))}
          </FilterRow>
        </div>
      </div>

      {/* 테이블 */}
      <section className="card p-5">
        <PlayersTable players={players} statMode={statMode} />
      </section>
    </div>
  );
}

// ─── 행 + 칩 헬퍼 ─────────────────────────────────

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
