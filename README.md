# use-timezone-overlap
---

> ### 💼 Built by Hanif Mohammad — React Native & full-stack developer
> **Top Rated Plus on Upwork · 100% Job Success.** Need a React Native / Expo app built, fixed, or shipped reliably?
>
> **[→ Hire me on Upwork](https://www.upwork.com/freelancers/~01b46f78c173c3ba9b)**  ·  **[→ Portfolio](https://hanif-2000.github.io)**
>
> **🛠 Need it built for you?** I can add this (or any React / React Native feature) to your app at a fixed price. **[Message me on Upwork](https://www.upwork.com/freelancers/~01b46f78c173c3ba9b)**.
>
> Found this tool useful? Please **⭐ the repo** or **[sponsor on GitHub ❤](https://github.com/sponsors/hanif-2000)** — it keeps these tools maintained.

---

A React / React Native hook that shows **your working hours in the visitor's time zone** — whether you're online now, today's window in their local time, and how many hours your working days overlap.

Built for freelancers, agencies and remote teams: _"I'm online 11:30 PM – 11:30 AM your time · 2.5 h overlap with your day."_

- Correct across **daylight saving time**, **half-hour and 45-minute offsets** (India, Nepal, Newfoundland…) and **overnight shifts** (22:00–06:00)
- Detects the visitor's time zone automatically
- Works in React and React Native; the pure function works anywhere
- No dependencies — just `Intl.DateTimeFormat`

```bash
npm install use-timezone-overlap
```

## Usage

```jsx
import { useTimezoneOverlap } from 'use-timezone-overlap';

export function Availability() {
  const o = useTimezoneOverlap({
    timeZone: 'Asia/Kolkata', // your time zone
    start: '10:00',           // your working day, in your time zone
    end: '22:00',
  });

  if (o.sameTimeZone) return <p>We're in the same time zone.</p>;
  return (
    <p>
      {o.isWorkingNow ? '🟢 Online now. ' : ''}
      My working hours are {o.window.startInViewer} – {o.window.endInViewer} your time
      {o.overlapMinutes > 0 && ` · ${(o.overlapMinutes / 60).toFixed(1)} h overlap with your day`}.
    </p>
  );
}
```

The hook re-computes every 30 seconds (`refreshMs`), so "online now" stays current.

### Without React

```js
import { getOverlap } from 'use-timezone-overlap/core';

getOverlap({
  timeZone: 'Asia/Kolkata', start: '10:00', end: '22:00',
  viewerTimeZone: 'America/New_York',
  now: new Date('2026-11-16T06:17:42Z'),
  locale: 'en-US',
});
```

Real output:

```json
{
  "hostTimeZone": "Asia/Kolkata",
  "viewerTimeZone": "America/New_York",
  "sameTimeZone": false,
  "hostNow": "11:47 AM",
  "viewerNow": "1:17 AM",
  "isWorkingNow": true,
  "isWorkDay": true,
  "overlapMinutes": 150,
  "offsetDifferenceMinutes": -630,
  "window": {
    "start": "2026-11-16T04:30:00.000Z",
    "end": "2026-11-16T16:30:00.000Z",
    "startInViewer": "11:30 PM",
    "endInViewer": "11:30 AM"
  }
}
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `timeZone` | — (required) | Your IANA time zone, e.g. `"Asia/Kolkata"` |
| `start` / `end` | `"09:00"` / `"17:00"` | Your working day in your time zone. `end` earlier than `start` means an overnight shift |
| `workDays` | `[1,2,3,4,5]` | Your working weekdays (0 = Sunday) |
| `viewerTimeZone` | device time zone | The visitor's time zone |
| `viewerHours` | `{ start: "09:00", end: "17:00" }` | The visitor's working day, used for `overlapMinutes` |
| `locale` | runtime default | Locale for the formatted times |
| `now` | current time | Fix the time (tests, SSR) |
| `refreshMs` (hook only) | `30000` | How often to re-compute; `0` turns it off |

## Returns

| Field | Description |
| --- | --- |
| `isWorkingNow` | Inside today's working window on a working day |
| `isWorkDay` | Today is one of `workDays` (in your time zone) |
| `window.start` / `window.end` | Today's window as `Date`s |
| `window.startInViewer` / `window.endInViewer` | The same, formatted in the visitor's time zone |
| `overlapMinutes` | Minutes your working day overlaps the visitor's working day |
| `hostNow` / `viewerNow` | Current time in each zone, formatted |
| `sameTimeZone` | Both zones have the same offset right now |
| `offsetDifferenceMinutes` | Visitor offset minus host offset |

Also exported from `use-timezone-overlap/core`: `offsetMinutes(date, timeZone)`, `zonedTimeToDate({year, month, day, hour, minute}, timeZone)`, `wallClock(date, timeZone)` and `viewerTimeZone()`.

## Notes

- Needs `Intl.DateTimeFormat` with time zone support — available in modern browsers and Node. On React Native, check that your JavaScript engine's `Intl` supports the `timeZone` option.
- When rendering on the server, pass `now` and `viewerTimeZone` (the server doesn't know the visitor's zone) or render the hook only on the client.

## License

MIT © [Hanif Mohammad](https://hanif-2000.github.io)
