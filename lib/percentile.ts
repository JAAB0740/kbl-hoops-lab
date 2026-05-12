/**
 * Percentile 계산 헬퍼 — Radar chart 등에서 stat 정규화 (0~100) 에 사용.
 *
 * 단순 max-min normalization 대신 percentile (분포 기반) 을 쓰는 이유:
 *  - max-min 은 outlier 한 명이 max 잡으면 나머지가 다 깔림.
 *  - percentile 은 "리그 상위 X%" 로 직관적 해석 가능.
 */

/**
 * 정렬된 배열에서 value 의 percentile 반환 (0~100).
 *  - value <= sortedValues[0] → 0
 *  - value >= sortedValues[N-1] → 100
 *  - 그 사이는 선형 보간.
 *
 * @param value 비교할 값
 * @param sortedValues 오름차순 정렬된 모집단 값들
 */
export function percentileOf(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  if (value <= sortedValues[0]) return 0;
  if (value >= sortedValues[sortedValues.length - 1]) return 100;

  // 이분탐색으로 첫 ">= value" 위치 찾기
  let lo = 0;
  let hi = sortedValues.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sortedValues[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  // lo 가 첫 >= value 인덱스
  return Math.round((lo / (sortedValues.length - 1)) * 100);
}

/**
 * 여러 stat 키에 대해 한 번에 percentile 계산.
 *
 * @param target 대상 (선수/팀) 의 stat 객체
 * @param population 모집단 (전체 선수/팀) 의 stat 객체 배열
 * @param keys percentile 계산할 stat 키들
 * @returns 같은 순서로 0~100 배열
 */
export function percentilesOf<T extends Record<string, number | null | undefined>>(
  target: T,
  population: T[],
  keys: (keyof T)[],
): number[] {
  return keys.map((key) => {
    const targetVal = Number(target[key] ?? 0);
    const sorted = population
      .map((p) => Number(p[key] ?? 0))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b);
    return percentileOf(targetVal, sorted);
  });
}
