"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  PlayoffBracket,
  PlayoffGame,
  PlayoffSeries,
} from "@/lib/types";
import { gameToId } from "@/lib/gamesUtil";

interface Props {
  bracket: PlayoffBracket;
}

/**
 * KBL 플레이오프 브래킷 — 가로 트리(요약) + 클릭 시 시리즈 디테일 패널
 *
 * 레이아웃 (lg+):
 *   [6강 PO]   [4강 PO]      [챔피언결정전]
 *   [3vs6] ─┐
 *           ├──[2 vs (3vs6)] ─┐
 *           │                 ├── [Champion]
 *           │                 │
 *           ├──[1 vs (4vs5)] ─┘
 *   [4vs5] ─┘
 */
export function PlayoffBracketView({ bracket }: Props) {
  // 기본 선택: 진행 중 시리즈 → 마지막으로 종결된 시리즈 → 첫 번째 6강
  const allSeries = useMemo(
    () =>
      [
        ...bracket.firstRound,
        ...bracket.semiRound,
        bracket.final,
      ].filter(Boolean) as PlayoffSeries[],
    [bracket],
  );

  const defaultId = useMemo(() => {
    const inProgress = allSeries.find((s) => s.status === "in-progress");
    if (inProgress) return seriesId(inProgress);
    const last = [...allSeries].reverse().find((s) => s.status === "final");
    if (last) return seriesId(last);
    return seriesId(allSeries[0]);
  }, [allSeries]);

  const [selected, setSelected] = useState<string>(defaultId);
  const selectedSeries = allSeries.find((s) => seriesId(s) === selected) ??
    allSeries[0];

  return (
    <div className="space-y-6">
      {/* 트리 — 데스크탑 (lg) */}
      <div className="hidden lg:block">
        <DesktopTree
          bracket={bracket}
          selected={selected}
          onSelect={setSelected}
        />
      </div>

      {/* 트리 — 모바일/태블릿 (lg 미만): 라운드별 세로 스택 */}
      <div className="space-y-6 lg:hidden">
        <MobileColumn
          title="6강 플레이오프"
          chip="1라운드 · 5전 3선승"
          chipClass="border-hoop-500/30 bg-hoop-500/10 text-hoop-400"
          series={bracket.firstRound}
          selected={selected}
          onSelect={setSelected}
        />
        <MobileColumn
          title="4강 플레이오프"
          chip="2라운드 · 5전 3선승"
          chipClass="border-neon-500/30 bg-neon-500/10 text-neon-400"
          series={bracket.semiRound}
          selected={selected}
          onSelect={setSelected}
        />
        {bracket.final && (
          <MobileColumn
            title="챔피언결정전"
            chip="결승 · 7전 4선승"
            chipClass="border-flame-500/30 bg-flame-500/10 text-flame-400"
            series={[bracket.final]}
            selected={selected}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* 시리즈 디테일 */}
      {selectedSeries && <SeriesDetail series={selectedSeries} />}
    </div>
  );
}

// ─── 데스크탑 트리 ──────────────────────────────────

function DesktopTree({
  bracket,
  selected,
  onSelect,
}: {
  bracket: PlayoffBracket;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_60px_minmax(0,1fr)_60px_minmax(0,1fr)] gap-x-2 gap-y-4 items-stretch">
      {/* 컬럼 헤더 */}
      <ColumnHeader
        label="6강 플레이오프"
        sub="5전 3선승"
        chipClass="border-hoop-500/30 bg-hoop-500/10 text-hoop-400"
      />
      <div />
      <ColumnHeader
        label="4강 플레이오프"
        sub="5전 3선승"
        chipClass="border-neon-500/30 bg-neon-500/10 text-neon-400"
      />
      <div />
      <ColumnHeader
        label="챔피언결정전"
        sub="7전 4선승"
        chipClass="border-flame-500/30 bg-flame-500/10 text-flame-400"
      />

      {/* 1행: 6강 위쪽 → 4강 위쪽 (상위 슬롯, 정관장 라인) */}
      <BoxOrEmpty
        series={bracket.firstRound[0]}
        selected={selected}
        onSelect={onSelect}
      />
      <Connector position="top-to-mid" />
      <BoxOrEmpty
        series={bracket.semiRound[0]}
        selected={selected}
        onSelect={onSelect}
      />
      <Connector position="merge-to-cf" rowSpan />
      {bracket.final && (
        <div className="row-span-2 flex items-center">
          <SeriesBox
            series={bracket.final}
            selected={selected === seriesId(bracket.final)}
            onSelect={() => onSelect(seriesId(bracket.final!))}
            isFinal
            champion={bracket.champion}
          />
        </div>
      )}

      {/* 2행: 6강 아래쪽 → 4강 아래쪽 (LG 라인) */}
      <BoxOrEmpty
        series={bracket.firstRound[1]}
        selected={selected}
        onSelect={onSelect}
      />
      <Connector position="bottom-to-mid" />
      <BoxOrEmpty
        series={bracket.semiRound[1]}
        selected={selected}
        onSelect={onSelect}
      />
      {/* 4강→CF 연결선은 위쪽 row-span으로 통합됨 */}
    </div>
  );
}

// 시리즈가 없을 수도 있는 위치를 안전하게 렌더
function BoxOrEmpty({
  series,
  selected,
  onSelect,
}: {
  series?: PlayoffSeries;
  selected: string;
  onSelect: (id: string) => void;
}) {
  if (!series) return <SeriesBox selected={false} onSelect={() => {}} />;
  const id = seriesId(series);
  return (
    <SeriesBox
      series={series}
      selected={selected === id}
      onSelect={() => onSelect(id)}
    />
  );
}

// ─── 모바일 컬럼 ──────────────────────────────────

function MobileColumn({
  title,
  chip,
  chipClass,
  series,
  selected,
  onSelect,
}: {
  title: string;
  chip: string;
  chipClass: string;
  series: (PlayoffSeries | null | undefined)[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-ink-50">
          {title}
        </h2>
        <span className={`chip ${chipClass}`}>{chip}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {series.filter(Boolean).map((s) => (
          <SeriesBox
            key={seriesId(s!)}
            series={s!}
            selected={selected === seriesId(s!)}
            onSelect={() => onSelect(seriesId(s!))}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 컬럼 헤더 ────────────────────────────────────

function ColumnHeader({
  label,
  sub,
  chipClass,
}: {
  label: string;
  sub: string;
  chipClass: string;
}) {
  return (
    <div className="flex items-baseline gap-2 pb-1">
      <h2 className="text-sm font-semibold tracking-tight text-ink-50">
        {label}
      </h2>
      <span className={`chip ${chipClass}`}>{sub}</span>
    </div>
  );
}

// ─── 연결선 ──────────────────────────────────────

function Connector({
  position,
  rowSpan,
}: {
  position: "top-to-mid" | "bottom-to-mid" | "merge-to-cf";
  rowSpan?: boolean;
}) {
  // top-to-mid: 6강 위 → 4강 위로 가는 곡선
  // bottom-to-mid: 6강 아래 → 4강 아래로 가는 곡선
  // merge-to-cf: 4강 두 박스 → CF 박스로 모이는 두 곡선 (row-span=2)
  return (
    <div
      className={[
        "relative w-full",
        rowSpan ? "row-span-2" : "",
      ].join(" ")}
      aria-hidden
    >
      <svg
        viewBox="0 0 60 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full text-court-600"
      >
        {position === "merge-to-cf" && (
          <>
            {/* 4강 위 박스(y=25) → 중앙(30, 50) 곡선 */}
            <path
              d="M 0 25 C 30 25 30 25 30 50"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            {/* 4강 아래 박스(y=75) → 중앙(30, 50) 곡선 */}
            <path
              d="M 0 75 C 30 75 30 75 30 50"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            {/* 중앙(30, 50) → CF 박스(60, 50) 직선 */}
            <path
              d="M 30 50 L 60 50"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
          </>
        )}
        {position === "top-to-mid" && (
          <path
            d="M 0 30 Q 30 30 30 60 Q 30 90 60 90"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        )}
        {position === "bottom-to-mid" && (
          <path
            d="M 0 70 Q 30 70 30 40 Q 30 10 60 10"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        )}
      </svg>
    </div>
  );
}

// ─── 시리즈 박스 ────────────────────────────────────

function SeriesBox({
  series,
  selected,
  onSelect,
  isFinal,
  champion,
}: {
  series?: PlayoffSeries;
  selected: boolean;
  onSelect: () => void;
  isFinal?: boolean;
  champion?: string;
}) {
  if (!series) {
    return (
      <div className="card flex h-full flex-col justify-center p-3 text-center text-[14px] text-ink-500">
        매치업 미정
      </div>
    );
  }

  const topWon = series.winnerShort === series.topShort;
  const bottomWon = series.winnerShort === series.bottomShort;

  const stateChip = (() => {
    if (series.status === "final") {
      return (
        <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
          종료
        </span>
      );
    }
    if (series.status === "in-progress") {
      return (
        <span className="chip border-buzzer-500/30 bg-buzzer-500/10 text-buzzer-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buzzer-500" />
          진행 중
        </span>
      );
    }
    return (
      <span className="chip border-court-600 bg-court-700/40 text-ink-500">
        예정
      </span>
    );
  })();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "group flex w-full flex-col gap-2 rounded-xl border bg-court-800/60 p-3 text-left transition-all",
        selected
          ? "border-flame-500/50 shadow-court-glow"
          : "border-court-700/80 hover:border-court-500 hover:bg-court-700/40",
        isFinal ? "min-h-[120px]" : "",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        {stateChip}
        <span className="stat-num text-[13px] text-ink-500">
          {series.bestOf}전 {Math.ceil(series.bestOf / 2)}선승
        </span>
      </div>

      {/* 두 팀 */}
      <div className="flex flex-col">
        <TeamRow
          seed={series.topSeed}
          name={series.topName}
          short={series.topShort}
          wins={series.topWins}
          isWinner={topWon}
          isLoser={bottomWon}
        />
        <div className="my-0.5 h-px bg-court-700/60" />
        <TeamRow
          seed={series.bottomSeed}
          name={series.bottomName}
          short={series.bottomShort}
          wins={series.bottomWins}
          isWinner={bottomWon}
          isLoser={topWon}
        />
      </div>

      {/* 챔피언 표시 */}
      {isFinal && champion && (
        <div className="mt-1 flex items-center justify-center rounded-md bg-gradient-to-r from-flame-500/20 via-flame-500/30 to-flame-500/20 py-1.5 text-[14px] font-semibold text-flame-400">
          🏆 {champion} 우승
        </div>
      )}
    </button>
  );
}

function TeamRow({
  seed,
  name,
  short,
  wins,
  isWinner,
  isLoser,
}: {
  seed?: number;
  name: string;
  short: string;
  wins: number;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const isTBD = short === "TBD";
  return (
    <div
      className={[
        "flex items-center justify-between py-1.5",
        isLoser ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-2">
        {seed != null ? (
          <span
            className={[
              "stat-num inline-flex h-5 w-5 flex-none items-center justify-center rounded text-[13px] font-bold",
              isWinner
                ? "bg-flame-500 text-court-950"
                : "bg-court-700 text-ink-300",
            ].join(" ")}
          >
            {seed}
          </span>
        ) : (
          <span className="stat-num inline-flex h-5 w-5 flex-none items-center justify-center rounded bg-court-700/40 text-[13px] text-ink-500">
            ·
          </span>
        )}
        <span
          className={[
            "truncate text-[16px]",
            isTBD
              ? "italic text-ink-500"
              : isWinner
                ? "font-semibold text-ink-50"
                : "text-ink-300",
          ].join(" ")}
        >
          {isTBD ? name : name}
        </span>
      </div>
      <span
        className={[
          "stat-num ml-2 inline-flex h-6 min-w-6 flex-none items-center justify-center rounded px-1.5 text-[15px] font-bold",
          isWinner
            ? "bg-flame-500/20 text-flame-400"
            : isLoser
              ? "bg-court-700/40 text-ink-500"
              : "bg-court-700/40 text-ink-300",
        ].join(" ")}
      >
        {wins}
      </span>
    </div>
  );
}

// ─── 시리즈 디테일 패널 ─────────────────────────────

function SeriesDetail({ series }: { series: PlayoffSeries }) {
  const need = Math.ceil(series.bestOf / 2);

  return (
    <section className="card overflow-hidden">
      {/* 헤더 */}
      <div className="border-b border-court-700/60 bg-court-800/40 px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[14px] font-medium uppercase tracking-[0.12em] text-ink-500">
              {series.roundLabel} · {series.bestOf}전 {need}선승
            </div>
            <h3 className="mt-1 text-lg font-bold tracking-tight text-ink-50">
              {series.topShort === "TBD"
                ? series.topName
                : series.topShort}{" "}
              <span className="text-ink-500">vs</span>{" "}
              {series.bottomShort === "TBD"
                ? series.bottomName
                : series.bottomShort}
            </h3>
          </div>
          <SeriesScoreBadge series={series} />
        </div>
      </div>

      {/* 게임 리스트 */}
      {series.games.length === 0 ? (
        <div className="p-8 text-center text-[16px] text-ink-500">
          이 시리즈는 이전 라운드 결과를 기다리고 있어요.
        </div>
      ) : (
        <div className="divide-y divide-court-700/50">
          {series.games.map((g) => (
            <GameRow key={g.no} game={g} series={series} />
          ))}
        </div>
      )}
    </section>
  );
}

function SeriesScoreBadge({ series }: { series: PlayoffSeries }) {
  const a = series.topWins;
  const b = series.bottomWins;

  if (series.status === "upcoming" || (a === 0 && b === 0)) {
    return (
      <span className="chip border-court-600 bg-court-700/40 text-ink-300">
        예정
      </span>
    );
  }

  const winnerSide =
    series.winnerShort === series.topShort
      ? "top"
      : series.winnerShort === series.bottomShort
        ? "bottom"
        : null;

  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "stat-num text-2xl font-bold",
          winnerSide === "top" ? "text-flame-400" : "text-ink-300",
        ].join(" ")}
      >
        {a}
      </span>
      <span className="text-ink-500">–</span>
      <span
        className={[
          "stat-num text-2xl font-bold",
          winnerSide === "bottom" ? "text-flame-400" : "text-ink-300",
        ].join(" ")}
      >
        {b}
      </span>
    </div>
  );
}

function GameRow({
  game,
  series,
}: {
  game: PlayoffGame;
  series: PlayoffSeries;
}) {
  const dateLabel = formatDate(game.date);
  const isFinal = game.status === "final" && game.homeScore != null;

  // 누가 시리즈의 top/bottom인지 따라 정렬해서 보여주면 시각적 일관성↑
  const topIsHome = series.topShort === game.homeShort;
  const topShort = series.topShort;
  const bottomShort = series.bottomShort;
  const topScore = topIsHome ? game.homeScore : game.awayScore;
  const bottomScore = topIsHome ? game.awayScore : game.homeScore;
  const topIsHomeMark = topIsHome;

  const topWon = isFinal && game.winnerShort === topShort;
  const bottomWon = isFinal && game.winnerShort === bottomShort;

  // 게임 상세 페이지로 이동할 ID 생성 — gameToId 는 RawGame 의 일부만 사용
  const gameLinkId = gameToId({
    date: game.date,
    time: game.time,
    homeShort: game.homeShort,
    awayShort: game.awayShort,
  } as Parameters<typeof gameToId>[0]);

  return (
    <Link
      href={`/games/${gameLinkId}`}
      className="grid grid-cols-[60px_1fr_auto_24px] items-center gap-3 px-5 py-3 transition hover:bg-court-700/20"
    >
      <div className="flex flex-col">
        <span className="text-[14px] font-medium uppercase tracking-[0.1em] text-ink-500">
          G{game.no}
        </span>
        <span className="stat-num text-[14px] text-ink-300">{dateLabel}</span>
      </div>

      <div className="flex flex-col gap-1">
        <ScoreLine
          short={topShort}
          score={topScore}
          isHome={topIsHomeMark}
          won={topWon}
          isFinal={isFinal}
        />
        <ScoreLine
          short={bottomShort}
          score={bottomScore}
          isHome={!topIsHomeMark}
          won={bottomWon}
          isFinal={isFinal}
        />
      </div>

      <div className="text-right">
        {isFinal ? (
          <span className="chip border-court-600 bg-court-700/40 text-ink-300">
            종료
          </span>
        ) : game.status === "live" ? (
          <span className="chip border-buzzer-500/30 bg-buzzer-500/10 text-buzzer-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buzzer-500" />
            LIVE
          </span>
        ) : (
          <span className="chip border-court-600 bg-court-700/40 text-ink-500">
            {game.time || "예정"}
          </span>
        )}
      </div>

      <span className="text-ink-500 transition group-hover:text-ink-300">›</span>
    </Link>
  );
}

function ScoreLine({
  short,
  score,
  isHome,
  won,
  isFinal,
}: {
  short: string;
  score: number | null;
  isHome: boolean;
  won: boolean;
  isFinal: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span
          className={[
            "stat-num inline-flex h-4 items-center justify-center rounded px-1 text-[9px] font-medium",
            isHome
              ? "bg-court-600 text-ink-100"
              : "bg-transparent text-ink-500",
          ].join(" ")}
          title={isHome ? "홈" : "원정"}
        >
          {isHome ? "홈" : "원정"}
        </span>
        <span
          className={[
            "text-[16px]",
            won ? "font-semibold text-ink-50" : "text-ink-300",
          ].join(" ")}
        >
          {short}
        </span>
      </div>
      <span
        className={[
          "stat-num text-[16px] font-semibold tabular-nums",
          isFinal && won
            ? "text-flame-400"
            : isFinal
              ? "text-ink-300"
              : "text-ink-500",
        ].join(" ")}
      >
        {score ?? "—"}
      </span>
    </div>
  );
}

// ─── 유틸 ──────────────────────────────────────

function seriesId(s: PlayoffSeries): string {
  return `${s.round}-${s.slot}-${s.topShort}-${s.bottomShort}`;
}

function formatDate(date: string): string {
  // "2026-04-12" → "4월 12일"
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  return `${parseInt(m[1], 10)}월 ${parseInt(m[2], 10)}일`;
}
