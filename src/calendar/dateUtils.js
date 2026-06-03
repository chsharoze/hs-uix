// ═══════════════════════════════════════════════════════════════════════════
// Calendar date primitives — pure, dependency-free, unit-testable.
//
// HubSpot UI Extensions feed dates in several shapes depending on where they
// come from: a CRM property (epoch-ms string), a DateInput value object
// ({ year, month, date } with a ZERO-indexed month, matching query.js), a raw
// ISO string, an epoch number, or a real Date. `toDate` collapses all of them
// to a single Date (or null) so the rest of the calendar never branches on
// shape. Everything else here is plain Gregorian grid math.
//
// NOTE: unlike workflow scripts, the extension runtime has a normal `Date`, so
// `new Date()` / `Date.now()` are fine here.
// ═══════════════════════════════════════════════════════════════════════════

const MS_PER_DAY = 86400000;

/** Is this a HubSpot DateInput value object ({ year, month, date })? */
export const isDateValueObject = (v) =>
  v != null &&
  typeof v === "object" &&
  typeof v.year === "number" &&
  typeof v.month === "number" &&
  typeof v.date === "number";

/**
 * Epoch-ms → Date, with a date-only correction. A HubSpot "date" property is
 * stored as epoch ms at UTC midnight (e.g. 2026-05-01 → 1777593600000); a naive
 * `new Date(ms)` in any behind-UTC timezone lands on the previous evening, so
 * `startOfDay` then shows the event a day early. When the epoch falls exactly on
 * a UTC-midnight day boundary we re-anchor it to LOCAL midnight of that calendar
 * date; epochs with a time component are passed through unchanged.
 */
const fromEpoch = (ms) => {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  if (ms % MS_PER_DAY === 0) return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return d;
};

/**
 * Coerce any supported date shape to a Date, or null when unparseable.
 * Accepts: Date | number (epoch ms) | ISO/parseable string |
 * HubSpot value object { year, month, date, hour?, minute? } (month 0-indexed).
 */
export const toDate = (value) => {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (isDateValueObject(value)) {
    return new Date(
      value.year,
      value.month,
      value.date,
      value.hour || 0,
      value.minute || 0
    );
  }
  if (typeof value === "number") return fromEpoch(value);
  // String: only a STRICT epoch-ms integer (11+ digits, i.e. ~1973 onward) takes
  // the numeric path — `Number("5")`/`Number("2026")` would otherwise coerce a
  // plain number or a bare year into a garbage 1970-era date. Everything else
  // falls through to the date-only regex and Date's own parser.
  if (typeof value === "string" && /^-?\d{11,}$/.test(value.trim())) {
    const d = fromEpoch(Number(value.trim()));
    if (d) return d;
  }
  // Date-only strings ("YYYY-MM-DD") MUST be parsed as LOCAL midnight. The spec
  // makes `new Date("2026-05-01")` parse as UTC midnight, which in any timezone
  // behind UTC lands on the previous calendar day — events show up one day
  // early. Datetime strings with a time component ("...T15:30:00", no "Z") are
  // already parsed as local by the engine, so we only intercept the date-only
  // form here.
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    }
    // A bare digit string that wasn't a valid epoch-ms (handled above) or a
    // YYYY-MM-DD date is NOT a date — reject it rather than let `new Date("5")`
    // mis-parse it into a 2001/2005-era date.
    if (/^-?\d+$/.test(trimmed)) return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const endOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const startOfMonth = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const endOfMonth = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
};

export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMonths = (d, n) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};

export const isSameDay = (a, b) =>
  a != null &&
  b != null &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const isSameMonth = (a, b) =>
  a != null && b != null &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth();

/**
 * Start of the week containing `d`. `weekStartsOn`: 0 = Sunday (default),
 * 1 = Monday.
 */
export const startOfWeek = (d, weekStartsOn = 0) => {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  return addDays(x, -diff);
};

/**
 * Build the month grid as an array of week-rows, each an array of 7 Date
 * objects, spanning from the start of the first visible week through enough
 * complete weeks to cover the whole month (5 or 6 rows, like HubSpot).
 */
export const buildMonthMatrix = (refDate, weekStartsOn = 0) => {
  const first = startOfMonth(refDate);
  const gridStart = startOfWeek(first, weekStartsOn);
  const last = endOfMonth(refDate);
  const weeks = [];
  let cursor = gridStart;
  // Emit weeks until we've passed the last day of the month on a week boundary.
  while (cursor <= last || weeks.length < 1 || cursor.getDay() !== weekStartsOn) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
    if (cursor > last && cursor.getDay() === weekStartsOn) break;
    // Hard cap at 6 rows — no month spans more.
    if (weeks.length >= 6) break;
  }
  return weeks;
};

/** Ordered list of day Dates for the week containing `refDate`. */
export const buildWeekDays = (refDate, weekStartsOn = 0, hideWeekends = false) => {
  const start = startOfWeek(refDate, weekStartsOn);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(start, i);
    if (hideWeekends && (day.getDay() === 0 || day.getDay() === 6)) continue;
    days.push(day);
  }
  return days;
};

/** Inclusive list of hour integers [startHour..endHour]. Inputs are clamped to
 * 0–23 and swapped if reversed, so a misconfigured window never yields an empty
 * grid that would silently swallow every timed event. */
export const buildHours = (startHour = 8, endHour = 20) => {
  let s = Math.max(0, Math.min(23, Math.round(startHour)));
  let e = Math.max(0, Math.min(23, Math.round(endHour)));
  if (s > e) [s, e] = [e, s];
  const hours = [];
  for (let h = s; h <= e; h += 1) hours.push(h);
  return hours;
};

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday header labels in display order, respecting weekStartsOn/weekends. */
export const weekdayLabels = (weekStartsOn = 0, hideWeekends = false, short = false) => {
  const src = short ? WEEKDAY_SHORT : WEEKDAY_LONG;
  const out = [];
  for (let i = 0; i < 7; i += 1) {
    const dow = (weekStartsOn + i) % 7;
    if (hideWeekends && (dow === 0 || dow === 6)) continue;
    out.push(src[dow]);
  }
  return out;
};

const intl = (opts) => new Intl.DateTimeFormat("en-US", opts);

export const formatMonthTitle = (d) => intl({ month: "long", year: "numeric" }).format(d);

/** "Nov" short month label (time-grid day headers). */
export const formatMonthShort = (d) => intl({ month: "short" }).format(d);

export const formatDayTitle = (d) =>
  intl({ weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(d);

/** "Mon" short weekday label for a single date (time-grid headers). */
export const formatWeekdayShort = (d) => intl({ weekday: "short" }).format(d);

/**
 * "May 3 – 9, 2026" (same month) / "Apr 26 – May 2, 2026" (same year) /
 * "Dec 28, 2026 – Jan 3, 2027" (year boundary) range title for week view.
 *
 * Built from explicit pieces rather than partial Intl option combos: asking
 * Intl for {day, year} with no month yields locale filler ("2026 (day: 9)"),
 * so we format the month name on its own and append plain day/year numbers.
 */
export const formatRangeTitle = (start, end) => {
  const monthLong = (d) => intl({ month: "long" }).format(d);
  const monthShort = (d) => intl({ month: "short" }).format(d);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${monthLong(start)} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${monthShort(start)} ${start.getDate()}, ${start.getFullYear()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`;
};

/** "4:07 PM" */
export const formatTime = (d) => intl({ hour: "numeric", minute: "2-digit" }).format(d);

/** "11:00 AM" hour-label for the time-grid gutter. */
export const formatHourLabel = (hour) => {
  const d = new Date(2000, 0, 1, hour, 0, 0);
  return intl({ hour: "numeric" }).format(d);
};

// ═══════════════════════════════════════════════════════════════════════════
// Timezone support — "wall-clock" conversion.
//
// A JS Date is a UTC instant rendered in the browser's local zone. To show the
// calendar in a CHOSEN IANA zone we convert each instant to a "wall-clock" Date
// whose LOCAL fields equal the wall-clock time in that zone (via Intl, which is
// DST-correct). Every local-time view primitive above (startOfDay, isSameDay,
// getHours, the grid math) then operates in the chosen zone with no changes, and
// formatting such a Date with NO timeZone renders the chosen-zone time.
// ═══════════════════════════════════════════════════════════════════════════

/** The browser's IANA zone (e.g. "America/Chicago"), or "UTC" if unavailable. */
export const getBrowserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/**
 * The wall-clock parts of `date` as seen in IANA `tz` (or the browser's local
 * zone when `tz` is falsy). DST-correct because Intl resolves the offset for the
 * specific instant.
 */
export const zonedParts = (date, tz) => {
  if (!tz) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // some engines emit "24" for midnight
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
};

/**
 * A "wall-clock" Date: its LOCAL fields equal `date`'s wall-clock time in `tz`.
 * Returns `date` unchanged when `tz` is falsy (browser-local behavior). Feed these
 * to the local-time view logic; format them WITHOUT a timeZone to show `tz` time.
 */
export const toWallClock = (date, tz) => {
  if (!date || !tz) return date;
  const p = zonedParts(date, tz);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
};

/**
 * A human zone label like "UTC −05:00 Central Time" — the offset is DST-aware
 * (computed for `atDate`, defaulting to now). Falls back to the raw IANA id.
 */
export const formatTimeZoneLabel = (tz, atDate = new Date()) => {
  if (!tz) return "";
  try {
    const nameOf = (style) =>
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style })
        .formatToParts(atDate)
        .find((p) => p.type === "timeZoneName")?.value || "";
    // "GMT-05:00" → "UTC −05:00" (true minus sign); "GMT" (UTC) → "UTC +00:00".
    let raw = nameOf("longOffset") || "GMT+00:00";
    if (raw === "GMT" || raw === "UTC") raw = "GMT+00:00";
    const offset = raw.replace(/^GMT/, "UTC ").replace(/-/g, "−");
    const name = nameOf("longGeneric") || nameOf("long") || tz;
    return `${offset} ${name}`.trim();
  } catch {
    return tz;
  }
};

export { MS_PER_DAY };
