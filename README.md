# KBL Hoops Lab — 메인 대시보드

한국프로농구(KBL) 2025-26 시즌 분석 사이트의 **메인 대시보드 페이지** 프로토타입입니다.
다크 스포츠 테마로 구현된 Next.js 14 + TypeScript + Tailwind CSS 프로젝트입니다.

## 실행 방법

```bash
cd kbl-hoops-lab
npm install
npm run dev
```

브라우저에서 <http://localhost:3000> 으로 접속하세요.

## 프로젝트 구조

```
kbl-hoops-lab/
├── app/
│   ├── layout.tsx          # 루트 레이아웃 (다크 모드 강제)
│   ├── page.tsx            # 대시보드 페이지 (조립부)
│   └── globals.css         # Tailwind base + 커스텀 유틸
├── components/
│   ├── TopNav.tsx          # 상단 글로벌 내비게이션 + LIVE 배지
│   ├── StatCard.tsx        # 좌측 포인트 라인 스탯 카드
│   ├── StandingsTable.tsx  # 정규리그 TOP N 순위 테이블
│   ├── TodayGames.tsx      # 오늘의 경기 (홈/어웨이 split)
│   ├── TeamCompareCard.tsx # 팀 vs 팀 비교 + 우위 바
│   ├── ScoringLeaders.tsx  # 득점 리더 TOP 5 + bar
│   └── Headlines.tsx       # 주요 뉴스 리스트
├── lib/
│   ├── types.ts            # 공용 타입
│   └── data.ts             # KBL 2025-26 목업 데이터
├── tailwind.config.ts      # 다크 스포츠 팔레트 (court / flame / hoop / neon / buzzer)
├── postcss.config.mjs
├── tsconfig.json
├── next.config.mjs
└── package.json
```

## 디자인 시스템

### 팔레트
- `court-*` — 배경 레이어 (950 가장 어두움 → 500 가장 밝음)
- `ink-*` — 텍스트 (50 primary → 500 tertiary)
- `flame-*` — 주황 포인트 (우승·리더·CTA)
- `hoop-*` — 에메랄드 (승/플레이오프)
- `buzzer-*` — 로즈 (패/라이브 신호)
- `neon-*` — 스카이 (정보·비교 좌측)

### 타이포그래피
- 수치는 `.stat-num` 클래스로 tabular-nums 적용 (숫자 폭 정렬)
- 헤더는 `font-semibold`·`tracking-tight`, 라벨은 `uppercase tracking-[0.1em]`

### 공용 컴포넌트 유틸
- `.card` — 배경·보더·radius 일괄 적용
- `.chip` — 작은 둥근 배지
- `.divider-y > *` — 테이블/리스트 사이 보더

## 데이터

`lib/data.ts` 에 2025-26 정규리그 최종 순위와 목업 스탯이 들어있습니다.
실제 서비스에서는 이 모듈을 KBL 공식 데이터 수집 파이프라인(추후 구현)이나
REST/GraphQL API 클라이언트로 교체하면 됩니다.

## 다음 단계 제안

1. `/standings` — 순위 상세 (홈/원정, 월별 분리, 폼 그래프)
2. `/players` — 선수 리더보드 필터 & 프로필 페이지
3. `/compare` — 팀/선수 양방향 선택 UI + 레이더 차트
4. `/analytics` — 4팩터, 샷차트 (D3), 온·오프 코트 분석
5. 데이터 레이어 — Supabase 또는 Postgres + 크론 스크래퍼
