// Time-zone math with no dependencies, built on Intl.DateTimeFormat.
// Handles half-hour and 45-minute offsets, daylight saving time and
// overnight working windows (e.g. 22:00–06:00).

const MINUTE = 60_000;
const DAY_MS = 86_400_000;

const partsCache = new Map();
function formatter(timeZone) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short',
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock fields of an instant in a time zone. */
export function wallClock(date, timeZone) {
  const p = Object.fromEntries(formatter(timeZone).formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour % 24, minute: +p.minute, second: +p.second,
    weekday: WEEKDAYS[p.weekday],
  };
}

/** Offset of a time zone from UTC at an instant, in minutes (e.g. +330 for India). */
export function offsetMinutes(date, timeZone) {
  const w = wallClock(date, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MINUTE);
}

/** The instant at which a wall-clock time occurs in a time zone. */
export function zonedTimeToDate({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let guess = naive - offsetMinutes(new Date(naive), timeZone) * MINUTE;
  // Re-check once: the offset can differ on the other side of a DST change.
  const second = naive - offsetMinutes(new Date(guess), timeZone) * MINUTE;
  if (second !== guess) guess = second;
  return new Date(guess);
}

/** Parse "09:30" into minutes after midnight. */
export function parseHm(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value).trim());
  if (!m || +m[1] > 24 || +m[2] > 59) throw new Error(`Invalid time "${value}" — use HH:MM, e.g. "09:30"`);
  return +m[1] * 60 + +m[2];
}

export function viewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Working window [start, end) for the local day containing `date`, in the host zone. */
function windowForDay(date, cfg, dayShift = 0) {
  const w = wallClock(new Date(date.getTime() + dayShift * DAY_MS), cfg.timeZone);
  const start = zonedTimeToDate({ year: w.year, month: w.month, day: w.day, hour: Math.floor(cfg.start / 60), minute: cfg.start % 60 }, cfg.timeZone);
  const endDay = cfg.end <= cfg.start ? 1 : 0; // overnight shift ends the next day
  const endBase = wallClock(new Date(start.getTime() + endDay * DAY_MS), cfg.timeZone);
  const end = zonedTimeToDate({ year: endBase.year, month: endBase.month, day: endBase.day, hour: Math.floor(cfg.end / 60), minute: cfg.end % 60 }, cfg.timeZone);
  return { start, end, weekday: w.weekday };
}

function config(opts) {
  if (!opts?.timeZone) throw new Error('timeZone is required, e.g. "Asia/Kolkata"');
  return {
    timeZone: opts.timeZone,
    start: parseHm(opts.start ?? '09:00'),
    end: parseHm(opts.end ?? '17:00'),
    workDays: opts.workDays ?? [1, 2, 3, 4, 5],
  };
}

function fmt(date, timeZone, locale) {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * Compare a host's working hours with a viewer's time zone.
 *
 * @param {object} options
 * @param {string} options.timeZone      Host IANA time zone, e.g. "Asia/Kolkata"
 * @param {string} [options.start]       Host working day start, "HH:MM" (default "09:00")
 * @param {string} [options.end]         Host working day end, "HH:MM" (default "17:00"); earlier than start = overnight
 * @param {number[]} [options.workDays]  Host working weekdays, 0 = Sunday (default Mon–Fri)
 * @param {string} [options.viewerTimeZone]  Defaults to the device's time zone
 * @param {{start?: string, end?: string}} [options.viewerHours]  Viewer's own working hours for the overlap (default 09:00–17:00)
 * @param {Date} [options.now]           Defaults to the current time
 * @param {string} [options.locale]      Locale for formatted times
 */
export function getOverlap(options) {
  const host = config(options);
  const now = options.now ?? new Date();
  const viewerTz = options.viewerTimeZone ?? viewerTimeZone();
  const locale = options.locale;

  // Today's host window (in host-local days). For overnight shifts, yesterday's
  // window may still be running.
  let today = windowForDay(now, host, 0);
  if (host.end <= host.start && now < today.start) {
    const y = windowForDay(now, host, -1);
    if (now < y.end) today = y;
  }
  const isWorkDay = host.workDays.includes(today.weekday);
  const isWorkingNow = isWorkDay && now >= today.start && now < today.end;

  // Overlap with the viewer's own working day (the viewer's "today").
  const viewer = config({ timeZone: viewerTz, start: options.viewerHours?.start, end: options.viewerHours?.end });
  const vDay = windowForDay(now, viewer, 0);
  let overlapMinutes = 0;
  for (const shift of [-1, 0, 1]) {
    const h = windowForDay(now, host, shift);
    if (!host.workDays.includes(h.weekday)) continue;
    const from = Math.max(h.start.getTime(), vDay.start.getTime());
    const to = Math.min(h.end.getTime(), vDay.end.getTime());
    if (to > from) overlapMinutes += Math.round((to - from) / MINUTE);
  }

  return {
    hostTimeZone: host.timeZone,
    viewerTimeZone: viewerTz,
    sameTimeZone: offsetMinutes(now, host.timeZone) === offsetMinutes(now, viewerTz),
    hostNow: fmt(now, host.timeZone, locale),
    viewerNow: fmt(now, viewerTz, locale),
    isWorkingNow,
    isWorkDay,
    window: {
      start: today.start,
      end: today.end,
      startInViewer: fmt(today.start, viewerTz, locale),
      endInViewer: fmt(today.end, viewerTz, locale),
    },
    overlapMinutes,
    offsetDifferenceMinutes: offsetMinutes(now, viewerTz) - offsetMinutes(now, host.timeZone),
  };
}
