import { useEffect, useState } from 'react';

/** 监听 matchMedia 查询，返回是否匹配。 */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window === 'undefined' ? false : window.matchMedia(query).matches);
  const [matches, setMatches] = useState<boolean>(get);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // 兼容老 Safari（< 14），运行时存在但类型已被废弃
    const legacy = mql as unknown as {
      addListener: (cb: (e: MediaQueryListEvent) => void) => void;
      removeListener: (cb: (e: MediaQueryListEvent) => void) => void;
    };
    legacy.addListener(handler);
    return () => legacy.removeListener(handler);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 639px)');
export const useIsTablet = () => useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
export const useIsTouch = () => useMediaQuery('(hover: none) and (pointer: coarse)');
