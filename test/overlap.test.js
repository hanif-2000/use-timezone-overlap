import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { getOverlap, offsetMinutes, zonedTimeToDate, wallClock } from '../src/core.js';
import { useTimezoneOverlap } from '../src/index.js';

// Monday 16 Nov 2026, 11:47 in India.
const MON = new Date('2026-11-16T06:17:42Z');
const india = { timeZone: 'Asia/Kolkata', start: '10:00', end: '22:00', locale: 'en-US' };
// Some ICU versions format "11:30 PM" with a narrow no-break space.
const n = (s) => s.replace(/[\u202f\u00a0]/g, ' ');

test('offsets include half-hour and 45-minute zones', () => {
  assert.equal(offsetMinutes(MON, 'Asia/Kolkata'), 330);
  assert.equal(offsetMinutes(MON, 'Asia/Kathmandu'), 345);
  assert.equal(offsetMinutes(MON, 'America/St_Johns'), -210);
  assert.equal(offsetMinutes(MON, 'UTC'), 0);
});

test("India 10:00–22:00 seen from New York, London and Sydney", () => {
  const ny = getOverlap({ ...india, viewerTimeZone: 'America/New_York', now: MON });
  assert.equal(n(ny.window.startInViewer), '11:30 PM');
  assert.equal(n(ny.window.endInViewer), '11:30 AM');
  assert.equal(ny.isWorkingNow, true);

  const london = getOverlap({ ...india, viewerTimeZone: 'Europe/London', now: MON });
  assert.equal(n(london.window.startInViewer), '4:30 AM');
  assert.equal(n(london.window.endInViewer), '4:30 PM');

  const sydney = getOverlap({ ...india, viewerTimeZone: 'Australia/Sydney', now: MON });
  assert.equal(n(sydney.window.startInViewer), '3:30 PM'); // AEDT, UTC+11 in November
  assert.equal(n(sydney.window.endInViewer), '3:30 AM');
});

test('the same window regardless of the time of day it is computed at', () => {
  const evening = new Date('2026-11-16T15:30:00Z'); // 21:00 IST, still working
  const r = getOverlap({ ...india, viewerTimeZone: 'America/New_York', now: evening });
  assert.equal(n(r.window.startInViewer), '11:30 PM');
  assert.equal(r.isWorkingNow, true);
  const late = getOverlap({ ...india, viewerTimeZone: 'America/New_York', now: new Date('2026-11-16T17:00:00Z') }); // 22:30 IST
  assert.equal(late.isWorkingNow, false);
});

test('overlap with the viewer working day', () => {
  // Host 04:30–16:30 UTC, London viewer 09:00–17:00 GMT → 09:00–16:30 = 7.5 h
  const r = getOverlap({ ...india, viewerTimeZone: 'Europe/London', now: MON });
  assert.equal(r.overlapMinutes, 450);
  // New York 09:00–17:00 EST = 14:00–22:00 UTC, overlapping 04:30–16:30 UTC for 14:00–16:30 = 2.5 h
  assert.equal(getOverlap({ ...india, viewerTimeZone: 'America/New_York', now: MON }).overlapMinutes, 150);
});

test('DST: wall-clock times convert correctly on both sides of a change', () => {
  // US spring forward is 8 Mar 2026 (02:00 → 03:00).
  assert.equal(zonedTimeToDate({ year: 2026, month: 3, day: 8, hour: 3, minute: 30 }, 'America/New_York').toISOString(), '2026-03-08T07:30:00.000Z');
  assert.equal(zonedTimeToDate({ year: 2026, month: 3, day: 7, hour: 9 }, 'America/New_York').toISOString(), '2026-03-07T14:00:00.000Z');
  assert.equal(zonedTimeToDate({ year: 2026, month: 3, day: 9, hour: 9 }, 'America/New_York').toISOString(), '2026-03-09T13:00:00.000Z');
  // Round trip in Sydney summer time.
  const d = zonedTimeToDate({ year: 2026, month: 1, day: 15, hour: 9, minute: 15 }, 'Australia/Sydney');
  const w = wallClock(d, 'Australia/Sydney');
  assert.deepEqual([w.hour, w.minute, w.day], [9, 15, 15]);
});

test('overnight shifts (22:00–06:00) and weekends', () => {
  const night = { timeZone: 'America/New_York', start: '22:00', end: '06:00', locale: 'en-US', viewerTimeZone: 'America/New_York' };
  // Tuesday 03:00 EST belongs to Monday night's shift.
  const r = getOverlap({ ...night, now: new Date('2026-11-17T08:00:00Z') });
  assert.equal(r.isWorkingNow, true);
  assert.equal(n(r.window.startInViewer), '10:00 PM');
  assert.equal(n(r.window.endInViewer), '6:00 AM');
  // Saturday afternoon in India: not a work day.
  const sat = getOverlap({ ...india, viewerTimeZone: 'Asia/Kolkata', now: new Date('2026-11-21T08:00:00Z') });
  assert.equal(sat.isWorkDay, false);
  assert.equal(sat.isWorkingNow, false);
});

test('same time zone and validation', () => {
  assert.equal(getOverlap({ ...india, viewerTimeZone: 'Asia/Calcutta', now: MON }).sameTimeZone, true);
  assert.throws(() => getOverlap({ start: '09:00' }), /timeZone is required/);
  assert.throws(() => getOverlap({ ...india, start: '9am' }), /Invalid time/);
});

test('hook renders with the computed overlap', () => {
  function Banner() {
    const o = useTimezoneOverlap({ ...india, viewerTimeZone: 'America/New_York', now: MON, refreshMs: 0 });
    return createElement('p', null, `${o.isWorkingNow ? 'Online' : 'Offline'} · ${o.window.startInViewer}–${o.window.endInViewer}`);
  }
  assert.equal(n(renderToString(createElement(Banner))), '<p>Online · 11:30 PM–11:30 AM</p>');
});
