"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState 의 sessionStorage-backed 변형. 같은 페이지로 돌아왔을 때
 * 필터·검색·정렬 같은 client state 를 복원하기 위함.
 *
 * - SSR-safe: 첫 렌더는 `initial`, mount 후 sessionStorage 에서 덮어쓰기.
 *   (hydration mismatch 방지 — server 와 첫 client 렌더가 같음.)
 * - 키 충돌 방지: prefix 명시 권장 (예: "playersExplorer:scope").
 * - 직렬화 불가 타입(Set, Map 등)은 codec 인자로 처리.
 *
 * ⚠️ loaded 는 반드시 useState 로 추적 — useRef 로 하면 첫 mount 시
 *    storage write effect 가 initial 값으로 storage 를 덮어쓰는 버그 발생.
 *    (effect 들이 같은 closure 에서 동작하므로 ref 의 즉시 변경이 reactive
 *     하지 않아 deps 에 못 들어감.)
 */

export interface Codec<T> {
  serialize: (v: T) => string;
  deserialize: (s: string) => T;
}

/** JSON 기반 기본 codec — primitive, plain object, array 에 사용 */
const jsonCodec = <T,>(): Codec<T> => ({
  serialize: (v) => JSON.stringify(v),
  deserialize: (s) => JSON.parse(s) as T,
});

/** Set<T> 직렬화 codec */
export function setCodec<T>(): Codec<Set<T>> {
  return {
    serialize: (s) => JSON.stringify([...s]),
    deserialize: (s) => new Set(JSON.parse(s) as T[]),
  };
}

export function usePersistedState<T>(
  key: string,
  initial: T | (() => T),
  codec?: Codec<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const c = codec ?? jsonCodec<T>();
  const [val, setVal] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  // mount: load from sessionStorage (overrides initial)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) {
        setVal(c.deserialize(raw));
      }
    } catch {
      // ignore parse / quota errors
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // change: save to sessionStorage — 첫 mount commit 에선 loaded=false 라 skip.
  // 다음 commit (loaded=true 적용 후) 부터 write 시작 → initial 덮어쓰기 방지.
  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(key, c.serialize(val));
    } catch {
      // ignore quota errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, val, loaded]);

  return [val, setVal];
}
