import { useEffect, useMemo, useState } from 'react';
import { getOverlap } from './core.js';

export { getOverlap, offsetMinutes, zonedTimeToDate, wallClock, viewerTimeZone } from './core.js';

/**
 * React / React Native hook: a host's working hours seen from the viewer's time zone.
 * Re-computes every `refreshMs` (default 30 s) so "online now" stays current.
 *
 * @param {Parameters<typeof getOverlap>[0] & {refreshMs?: number}} options
 */
export function useTimezoneOverlap(options) {
  const { refreshMs = 30_000, ...rest } = options;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!refreshMs) return undefined;
    const id = setInterval(() => setNow(new Date()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);

  const key = JSON.stringify(rest);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getOverlap({ ...rest, now: rest.now ?? now }), [key, now]);
}
