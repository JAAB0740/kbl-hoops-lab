/**
 * 팀별 산점도 마커 모양 — 10팀 각기 다른 SVG path.
 *
 * 모든 shape 는 (0,0) 중심, -10 ~ +10 좌표계(viewBox 20×20)로 그린다.
 * TeamDot 이 `scale(r/10)` 로 스케일 → r=5px 에선 절반 사이즈로 렌더.
 * stroke 는 vector-effect="non-scaling-stroke" 로 두께 유지.
 */

interface ShapeProps {
  fill: string;
  stroke: string;
  fillOpacity?: number;
}

const COMMON = (fill: string, stroke: string, fillOpacity = 0.85) => ({
  fill, stroke, fillOpacity, strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const,
});

// ─── 각 팀 모양 ──────────────────────────────

function StarKT({ fill, stroke, fillOpacity }: ShapeProps) {
  // 5-point star
  return (
    <polygon
      points="0,-10 2.939,-4.045 9.511,-3.09 4.755,1.545 5.878,8.09 0,5 -5.878,8.09 -4.755,1.545 -9.511,-3.09 -2.939,-4.045"
      {...COMMON(fill, stroke, fillOpacity)}
    />
  );
}

function LetterD({ fill, stroke, fillOpacity }: ShapeProps) {
  // 대문자 D — 좌측 직선 + 우측 반원 (반경 9)
  return (
    <path
      d="M -5,-9 L 1,-9 A 9,9 0 0 1 1,9 L -5,9 Z"
      {...COMMON(fill, stroke, fillOpacity)}
    />
  );
}

function Lightning({ fill, stroke, fillOpacity }: ShapeProps) {
  // 번개 — 지그재그 다각형
  return (
    <polygon
      points="3,-10 -5,2 -1,2 -3,10 5,-2 1,-2"
      {...COMMON(fill, stroke, fillOpacity)}
    />
  );
}

function Cloud({ fill, stroke, fillOpacity }: ShapeProps) {
  // 구름 — 겹치는 원 3개 + 아래 사각 베이스
  const c = COMMON(fill, stroke, fillOpacity);
  return (
    <g>
      <circle cx={-5} cy={1} r={5} {...c} />
      <circle cx={5}  cy={1} r={5} {...c} />
      <circle cx={0}  cy={-3} r={6} {...c} />
      <rect   x={-6} y={1} width={12} height={5} {...c} />
    </g>
  );
}

function Sun({ fill, stroke, fillOpacity }: ShapeProps) {
  // 태양 — 중앙 원 + 8방향 짧은 광선
  const c = COMMON(fill, stroke, fillOpacity);
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = Math.cos(a) * 5.5, y1 = Math.sin(a) * 5.5;
    const x2 = Math.cos(a) * 9.5, y2 = Math.sin(a) * 9.5;
    return (
      <line
        key={i}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={stroke} strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
    );
  });
  return (
    <g>
      {rays}
      <circle cx={0} cy={0} r={5} {...c} />
    </g>
  );
}

function Shield({ fill, stroke, fillOpacity }: ShapeProps) {
  // 방패 — 상단 평평, 하단 뾰족
  return (
    <path
      d="M -8,-9 L 8,-9 L 8,2 Q 8,8 0,10 Q -8,8 -8,2 Z"
      {...COMMON(fill, stroke, fillOpacity)}
    />
  );
}

function SharpWing({ fill, stroke, fillOpacity }: ShapeProps) {
  // 날카로운 셰브론 (LG Sakers) — 위쪽 뾰족, 초안에서 반시계 90° 회전한 형태
  return (
    <polygon
      points="-6,10 -8,-2 0,-10 8,-2 6,10 0,3"
      {...COMMON(fill, stroke, fillOpacity)}
    />
  );
}

function RoundWing({ fill, stroke, fillOpacity }: ShapeProps) {
  // 둥근 날개 + 소용돌이 꼬리 (가스공사 Pegasus 느낌)
  const c = COMMON(fill, stroke, fillOpacity);
  return (
    <g>
      {/* 메인 날개 — 좌상단 포물선 → 우하단 두툼 */}
      <path
        d="M -9,-7 Q -2,-10 5,-5 Q 9,-1 8,5 Q 4,9 -1,7 Q -5,5 -7,0 Q -8,-4 -9,-7 Z"
        {...c}
      />
      {/* 꼬리 소용돌이 — 작은 원형 궤적 */}
      <path
        d="M 6,5 Q 9,6 8,8 Q 6,9 5,7"
        fill="none" stroke={stroke} strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

function KnightHelmet({ fill, stroke, fillOpacity }: ShapeProps) {
  // 기사 투구 (SK Knights) — 돔 + 역사다리꼴 턱받침 + 수평 슬릿
  const c = COMMON(fill, stroke, fillOpacity);
  return (
    <g>
      {/* 돔 (반원) */}
      <path d="M -8,2 Q -8,-9 0,-9 Q 8,-9 8,2 Z" {...c} />
      {/* 턱받침 — 역사다리꼴 (위 넓고 아래 좁음) */}
      <path d="M -8,2 L 8,2 L 3,10 L -3,10 Z" {...c} />
      {/* 슬릿 — stroke 색으로 수평 밴드 */}
      <rect x={-7} y={0} width={14} height={2.5} fill={stroke} opacity={0.7} />
    </g>
  );
}

// ─── Dispatch ──────────────────────────────

export function TeamShape({
  team, fill, stroke, fillOpacity = 0.85,
}: { team: string; fill: string; stroke: string; fillOpacity?: number }) {
  const p = { fill, stroke, fillOpacity };
  switch (team) {
    case "KT":       return <StarKT {...p} />;
    case "DB":       return <LetterD {...p} />;
    case "삼성":     return <Lightning {...p} />;
    case "소노":     return <Cloud {...p} />;
    case "현대모비스": return <Sun {...p} />;
    case "KCC":      return <Shield {...p} />;
    case "정관장":   return <Shield {...p} />;
    case "LG":       return <SharpWing {...p} />;
    case "가스공사": return <RoundWing {...p} />;
    case "SK":       return <KnightHelmet {...p} />;
    // Fallback — 알 수 없는 팀은 원
    default:
      return <circle cx={0} cy={0} r={8} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={1.5} />;
  }
}
