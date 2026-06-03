import { describe, it, expect } from "vitest";
import {
  toDate,
  buildHours,
  buildWeekDays,
  formatRangeTitle,
  zonedParts,
  toWallClock,
  getBrowserTimeZone,
  formatTimeZoneLabel,
} from "./dateUtils.js";

// ── timezone wall-clock conversion (deterministic via Intl + explicit zones) ──
describe("zonedParts / toWallClock", () => {
  // 2026-06-03 17:30:00 UTC (June → US daylight time).
  const instant = new Date(Date.UTC(2026, 5, 3, 17, 30, 0));

  it("reads the wall-clock parts in the requested zone", () => {
    expect(zonedParts(instant, "UTC")).toMatchObject({ year: 2026, month: 6, day: 3, hour: 17, minute: 30 });
    // Central Daylight Time = UTC−5 → 12:30 same day
    expect(zonedParts(instant, "America/Chicago")).toMatchObject({ day: 3, hour: 12, minute: 30 });
    // Eastern Daylight Time = UTC−4 → 13:30 same day
    expect(zonedParts(instant, "America/New_York")).toMatchObject({ day: 3, hour: 13 });
    // Tokyo = UTC+9 → next calendar day, 02:30
    expect(zonedParts(instant, "Asia/Tokyo")).toMatchObject({ day: 4, hour: 2, minute: 30 });
  });

  it("toWallClock returns a Date whose LOCAL fields equal the zone wall-clock", () => {
    const tokyo = toWallClock(instant, "Asia/Tokyo");
    expect(tokyo.getDate()).toBe(4);
    expect(tokyo.getHours()).toBe(2);
    expect(tokyo.getMinutes()).toBe(30);
    const utc = toWallClock(instant, "UTC");
    expect(utc.getHours()).toBe(17);
  });

  it("returns the date unchanged when no zone is given", () => {
    expect(toWallClock(instant, undefined)).toBe(instant);
    expect(toWallClock(instant, "")).toBe(instant);
  });
});

describe("formatTimeZoneLabel / getBrowserTimeZone", () => {
  it("formats a DST-aware label with offset + name", () => {
    const label = formatTimeZoneLabel("America/Chicago", new Date(Date.UTC(2026, 5, 3, 12)));
    expect(label).toMatch(/UTC/);
    expect(label).toMatch(/Central/);
    expect(label).toMatch(/−05:00/); // CDT in June (true minus sign)
  });
  it("returns a non-empty IANA zone for the browser", () => {
    expect(typeof getBrowserTimeZone()).toBe("string");
    expect(getBrowserTimeZone().length).toBeGreaterThan(0);
  });
});

// ── toDate: shape coercion + timezone correctness ───────────────────────────
describe("toDate", () => {
  it("rebuilds a UTC-midnight epoch (HubSpot date property) as the SAME calendar day", () => {
    // 2026-05-01T00:00:00Z. A naive new Date(ms) lands on Apr 30 evening in any
    // behind-UTC zone; fromEpoch re-anchors to local midnight of May 1.
    const d = toDate(1777593600000);
    expect(d).not.toBeNull();
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // May (0-indexed)
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it("treats a 13-digit epoch STRING the same as a number", () => {
    const d = toDate("1777593600000");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(1);
  });

  it("preserves the instant for an epoch WITH a time component", () => {
    const ms = 1777593600000 + 15 * 3600000 + 30 * 60000; // +15:30
    const d = toDate(ms);
    expect(d.getTime()).toBe(ms); // not re-anchored
  });

  it("does NOT coerce small numeric strings into 1970 dates", () => {
    expect(toDate("5")).toBeNull(); // was new Date(5) → 1970
    expect(toDate("42")).toBeNull();
  });

  it("parses a date-only string as LOCAL midnight (not UTC → not a day early)", () => {
    const d = toDate("2026-05-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it("accepts a HubSpot value object (0-indexed month)", () => {
    const d = toDate({ year: 2026, month: 4, date: 1, hour: 9, minute: 30 });
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(30);
  });

  it("returns null for empty / unparseable values", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate("")).toBeNull();
    expect(toDate("not a date")).toBeNull();
  });
});

// ── buildHours: never silently empty ────────────────────────────────────────
describe("buildHours", () => {
  it("builds the inclusive range normally", () => {
    expect(buildHours(8, 11)).toEqual([8, 9, 10, 11]);
  });
  it("swaps a reversed window instead of returning [] (which would swallow events)", () => {
    expect(buildHours(20, 8)).toEqual(buildHours(8, 20));
    expect(buildHours(20, 8).length).toBeGreaterThan(0);
  });
  it("clamps out-of-range hours to 0..23", () => {
    expect(buildHours(-5, 30)).toEqual(Array.from({ length: 24 }, (_, i) => i));
  });
});

// ── range title across a year boundary ──────────────────────────────────────
describe("formatRangeTitle", () => {
  it("includes the year when the span crosses a year boundary", () => {
    const t = formatRangeTitle(new Date(2026, 11, 28), new Date(2027, 0, 3));
    expect(t).toContain("2026");
    expect(t).toContain("2027");
  });
});

// ── weekend hiding affects the week's day list ──────────────────────────────
describe("buildWeekDays", () => {
  it("drops Sat/Sun when hideWeekends is set", () => {
    const days = buildWeekDays(new Date(2026, 5, 3), 0, true); // a Wed
    expect(days).toHaveLength(5);
    expect(days.some((d) => d.getDay() === 0 || d.getDay() === 6)).toBe(false);
  });
});
