import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  EmptyState,
  Flex,
  Heading,
  Image,
  Inline,
  Link,
  LoadingSpinner,
  Modal,
  ModalBody,
  Panel,
  PanelBody,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  StatusTag,
  Tag,
  Text,
  Tile,
} from "@hubspot/ui-extensions";
import { Popover } from "@hubspot/ui-extensions/experimental";
import { CollectionToolbar } from "../common-components/CollectionToolbar.js";
import { Icon } from "../common-components/Icon.js";
import {
  getEmptyFilterValues,
  resetFilterValues,
  buildActiveFilterChips,
  filterRows,
  searchRows,
} from "../utils/query.js";
import {
  toDate,
  startOfDay,
  endOfDay,
  addDays,
  addMonths,
  isSameDay,
  isSameMonth,
  buildMonthMatrix,
  buildWeekDays,
  buildHours,
  weekdayLabels,
  formatMonthTitle,
  formatDayTitle,
  formatRangeTitle,
  formatMonthShort,
  formatWeekdayShort,
  formatTime,
  formatHourLabel,
  toWallClock,
  formatTimeZoneLabel,
} from "./dateUtils.js";
import {
  makeDotDataUri,
  makeSpacerDataUri,
  makeEventChipDataUri,
  makeMoreDataUri,
} from "./svgChips.js";

// ---------------------------------------------------------------------------
// Calendar — presentational calendar surface for HubSpot UI Extensions.
//
// Like Kanban and Feed, this component is data-driven and presentational: the
// caller hands it `events` plus an `eventFields` mapping and owns any data
// fetching. It renders a toolbar (Today / ‹ › navigation / view switcher) and
// one of several views. Per the platform's no-Tabs-rerender constraint the
// view switcher is a Select, never a Tabs bar.
//
// Views: Month (7-column day grid), Week/Day (hour-row time grid, an honest
// non-proportional approximation), and Agenda (week-of events grouped by day).
//
// Event interactivity rides the standard `overlay` prop on a Tag/Link trigger:
//   overlayMode="popover" (default, experimental) | "modal" | "panel" | "none"
// plus a `renderEventDetail` escape hatch for the overlay body and an
// `onEventClick` callback that always fires regardless of overlay mode.
// ---------------------------------------------------------------------------

const DEFAULT_MAX_EVENTS_PER_DAY = 3;

const ALL_VIEWS = ["month", "week", "day", "agenda"];

const DEFAULT_DAY_START_HOUR = 8;
const DEFAULT_DAY_END_HOUR = 20;

// Curated IANA zones for the built-in timezone selector (override via
// `timeZoneOptions`). Labels are computed dynamically (DST-aware) at render.
const DEFAULT_TIME_ZONES = [
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Halifax",
  "America/Sao_Paulo",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Athens",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const atMidnight = (d) => d.getHours() === 0 && d.getMinutes() === 0;

// All-day = date-only: BOTH endpoints land on midnight (a single date, or a
// midnight-to-midnight multi-day span). A midnight start with a real end time
// (e.g. a 00:00–01:30 call) or an event that merely crosses midnight (11 PM–1 AM)
// keeps its time and renders in the hour grid — they are NOT all-day.
const isAllDayEvent = (event) => {
  if (!event.start) return false;
  return atMidnight(event.start) && atMidnight(event.end || event.start);
};

const VIEW_LABELS = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
};

const DEFAULT_LABELS = {
  today: "Today",
  previous: "Previous",
  next: "Next",
  search: "Search events...",
  clearAll: "Clear all",
  more: (n) => `+${n} more`,
  onThisDate: "events on this date",
  noEventsTitle: "No events",
  noEventsMessage: "Nothing scheduled for this range.",
  loading: "Loading calendar...",
  errorTitle: "Something went wrong.",
  errorMessage: "An error occurred while loading events.",
  dayDetailTitle: (label) => label,
  open: "Open",
  allDay: "All day",
};

const DEFAULT_EVENT_FIELDS = {
  id: "id",
  start: "start",
  end: "end",
  title: "title",
  subtitle: "subtitle",
  color: "color",
  href: "href",
};

const VALID_VARIANTS = new Set(["default", "info", "success", "warning", "error", "danger"]);

// Resolve a field spec (string key or accessor fn) against an event object.
const resolveField = (event, spec) => {
  if (spec == null) return undefined;
  if (typeof spec === "function") return spec(event);
  return event[spec];
};

const normalizeHref = (href, event) => {
  const resolved = typeof href === "function" ? href(event) : href;
  if (!resolved) return null;
  if (typeof resolved === "string") return { url: resolved, external: false };
  return { url: resolved.url, external: !!resolved.external };
};

// A tight colored status dot (small SVG circle, not an empty StatusTag pill).
const ColorDot = ({ variant, size = 8 }) => {
  const dot = makeDotDataUri(variant, size);
  return <Image src={dot.src} width={dot.width} height={dot.height} alt="" />;
};

// StatusTag has no "error" variant (it spells red "danger"); map our palette.
const STATUS_VARIANT = {
  default: "default",
  info: "info",
  success: "success",
  warning: "warning",
  error: "danger",
  danger: "danger",
};


// Month-grid line metrics. Spacer heights approximate a chip line and the "more"
// link line so padded (empty) slots match the height of real lines.
// Fixed per-day column width. Forced via an invisible spacer in each cell so
// empty columns keep their width; columns use width="min" so the Table scrolls
// horizontally (DataTable-style) when 7 columns exceed the container.
const MONTH_COL_WIDTH = 160;

// Time-grid (week/day) day-column widths. Day columns need EQUAL fixed NUMERIC
// widths — width="max" makes a single column greedy (it grabs all slack),
// collapsing the rest to one-character width. The TIME gutter, by contrast, uses
// width="min" (DataTable-style) so it shrink-wraps its labels without wrapping.
// The single-day (Day view) column is widened so it doesn't look stranded.
const TIMEGRID_DAY_COL = 150;
const TIMEGRID_DAY_COL_SINGLE = 560;
// Min height of every hour slot (occupied or empty), so the grid reads as evenly
// spaced, scannable time blocks.
const HOUR_SLOT_HEIGHT = 64;

// ---------------------------------------------------------------------------
// Event detail body — the default overlay contents. Kept compact (a title, the
// date/time line, an optional subtitle, an optional Open link) so it works in a
// Popover without scrolling. Callers override via `renderEventDetail`.
// ---------------------------------------------------------------------------
const EventDetail = ({ event, labels }) => {
  const { start, end, title, subtitle, href } = event;
  let when = "";
  if (start) {
    const sameDay = end ? isSameDay(start, end) : true;
    const startHasTime = start.getHours() !== 0 || start.getMinutes() !== 0;
    if (!end && !startHasTime) {
      when = formatDayTitle(start);
    } else if (sameDay) {
      when = `${formatDayTitle(start)}${startHasTime ? `, ${formatTime(start)}` : ""}${
        end && !isSameDay(start, end) === false && end.getTime() !== start.getTime()
          ? ` – ${formatTime(end)}`
          : ""
      }`;
    } else {
      when = `${formatDayTitle(start)} – ${formatDayTitle(end)}`;
    }
  }
  return (
    <Flex direction="column" gap="xs">
      <Text format={{ fontWeight: "demibold" }}>{title || "--"}</Text>
      {when ? <Text variant="microcopy">{when}</Text> : null}
      {subtitle ? <Text>{subtitle}</Text> : null}
      {href ? (
        <Link href={href.url} external={href.external}>
          {labels.open}
        </Link>
      ) : null}
    </Flex>
  );
};

// Build the overlay node for a given mode. Popover children must NOT be wrapped
// in a Tile — the renderer auto-wraps them in <Tile compact>.
const buildOverlay = (event, mode, renderEventDetail, labels, idSuffix = "") => {
  if (mode === "none") return undefined;
  const body = renderEventDetail ? renderEventDetail(event) : <EventDetail event={event} labels={labels} />;
  const id = `cal-evt-${event.key}${idSuffix}`;
  if (mode === "modal") {
    return (
      <Modal id={id} title={event.title || labels.open} width="small">
        <ModalBody>{body}</ModalBody>
      </Modal>
    );
  }
  if (mode === "panel") {
    return (
      <Panel id={id} title={event.title || labels.open} width="small" variant="modal">
        <PanelBody>{body}</PanelBody>
      </Panel>
    );
  }
  // Default: experimental Popover. Despite the SDK doc claiming the renderer
  // auto-wraps children in a Tile, in practice the content renders badly
  // without an explicit <Tile compact> around it — so we add one.
  return (
    <Popover id={id} placement="bottom">
      <Tile compact>{body}</Tile>
    </Popover>
  );
};

// ---------------------------------------------------------------------------
// AgendaEventRow — one clean agenda line: a time gutter, a color dot + a linked
// title (Link nested in Text so it's inline, no block padding), and an optional
// owner/subtitle on the right. No bordered Tag chip — those read as cluttered
// boxes and stretch full-width for all-day events.
// ---------------------------------------------------------------------------
const AgendaEventRow = ({ event, day, overlayMode, renderEventDetail, onEventClick, labels }) => {
  const variant = VALID_VARIANTS.has(event.color) ? event.color : "default";
  // Day-scoped suffix: a multi-day event appears under several day headers, so
  // each instance needs its own overlay id.
  const overlay = buildOverlay(event, overlayMode, renderEventDetail, labels, day ? `-ag${day.getTime()}` : "");
  const handleClick = onEventClick ? () => onEventClick(event.raw, event) : undefined;
  const timeLabel = isAllDayEvent(event) ? labels.allDay : formatTime(event.start);
  return (
    <Flex direction="row" align="center" gap="sm">
      {/* Each column wraps its content in a center-aligned Flex so the time,
          title, and owner all sit on the same vertical line (a bare Text in a Box
          top-aligns when the row is taller). */}
      <Box flex={2}>
        <Flex direction="row" align="center">
          <Text variant="microcopy" format={{ fontWeight: "demibold" }}>{timeLabel}</Text>
        </Flex>
      </Box>
      <Box flex={11}>
        <Flex direction="row" align="center" gap="xs">
          <ColorDot variant={variant} />
          <Text truncate={true}>
            <Link overlay={overlay} onClick={handleClick}>{event.title || "--"}</Link>
          </Text>
        </Flex>
      </Box>
      {event.subtitle ? (
        <Box flex={4}>
          <Flex direction="row" align="center">
            <Text variant="microcopy" truncate={true}>{event.subtitle}</Text>
          </Flex>
        </Box>
      ) : null}
    </Flex>
  );
};

// Width of a month-grid chip (the cell width minus a little side padding).
const MONTH_CHIP_WIDTH = MONTH_COL_WIDTH - 8;
const MONTH_CHIP_HEIGHT = 24;

// ---------------------------------------------------------------------------
// MonthChip — the month-grid event token rendered as a FIXED-WIDTH SVG chip
// (bordered, colored left accent, truncated title). A Tag sizes to its content,
// so Tag chips render at different widths and pull their columns out of
// alignment; a fixed-width SVG guarantees every chip — and therefore every
// column — is exactly equal. A multi-day event renders a chip in every day it
// spans, so each gets a day-scoped overlay id and the start time shows only on
// the start day (other days get a "→" continuation prefix).
// ---------------------------------------------------------------------------
const MonthChip = ({ event, day, overlayMode, renderEventDetail, onEventClick, labels }) => {
  const isStartDay = !day || !event.start || isSameDay(event.start, day);
  const overlay = buildOverlay(event, overlayMode, renderEventDetail, labels, day ? `-m${day.getTime()}` : "");
  const handleClick = onEventClick ? () => onEventClick(event.raw, event) : undefined;
  const variant = VALID_VARIANTS.has(event.color) ? event.color : "default";
  const startHasTime =
    event.start && (event.start.getHours() !== 0 || event.start.getMinutes() !== 0);
  const time = isStartDay && startHasTime ? `${formatTime(event.start)} ` : "";
  const prefix = isStartDay ? "" : "→ ";
  const chip = makeEventChipDataUri({
    label: `${prefix}${time}${event.title || "--"}`,
    width: MONTH_CHIP_WIDTH,
    height: MONTH_CHIP_HEIGHT,
    variant,
  });
  // Image carries `overlay` + `onClick` directly — wrapping it in a Link would
  // add the Link's block padding and open a big gap between stacked chips.
  return (
    <Image
      src={chip.src}
      width={chip.width}
      height={chip.height}
      alt={event.title || ""}
      overlay={overlay}
      onClick={handleClick}
    />
  );
};

// A single row in the "N events on this date" overflow popover. Rendered as a
// transparent Button (not a Link) so it doesn't show the external-link icon a
// Link appends. It opens the same event-detail overlay the in-cell chips use
// (day-scoped suffix so it doesn't collide with the chip's overlay id) and still
// navigates via href / fires onEventClick.
const DayListItem = ({ event, day, overlayMode, renderEventDetail, onEventClick, labels }) => {
  const handleClick = onEventClick ? () => onEventClick(event.raw, event) : undefined;
  const overlay = buildOverlay(event, overlayMode, renderEventDetail, labels, day ? `-more${day.getTime()}` : "-more");
  const href = event.href;
  return (
    <Button variant="transparent" size="sm" href={href ? href.url : undefined} overlay={overlay} onClick={handleClick}>
      {event.title || "--"}
    </Button>
  );
};

// ---------------------------------------------------------------------------
// Toolbar — title + Today/‹/› + view Select, then an optional filter row.
// ---------------------------------------------------------------------------
const Toolbar = ({
  title,
  view,
  views,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  labels,
  // filter bar
  showSearch,
  searchValue,
  onSearchChange,
  filters,
  filterValues,
  onFilterValueChange,
  activeChips,
  onClearChip,
  onClearAll,
  toolbarLeftFlex,
  toolbarRightFlex,
  // timezone selector
  timeZone,
  onTimeZoneChange,
  timeZoneOptions,
}) => {
  const viewOptions = views.map((v) => ({ label: VIEW_LABELS[v] || v, value: v }));

  const tzSelect =
    timeZoneOptions && timeZoneOptions.length ? (
      <Select variant="transparent" value={timeZone} onChange={onTimeZoneChange} options={timeZoneOptions} />
    ) : null;

  const navControls = (
    <Inline gap="sm" align="center">
      {tzSelect}
      <Inline gap="xs" align="center">
        <Button size="xs" variant="secondary" onClick={onToday}>
          {labels.today}
        </Button>
        <Button size="xs" variant="transparent" onClick={onPrev}>
          <Icon name="left" />
        </Button>
        <Button size="xs" variant="transparent" onClick={onNext}>
          <Icon name="right" />
        </Button>
        {viewOptions.length > 1 ? (
          <Select variant="transparent" value={view} onChange={onViewChange} options={viewOptions} />
        ) : null}
      </Inline>
    </Inline>
  );

  return (
    <Flex direction="column" gap="xs">
      <Heading>{title}</Heading>

      <CollectionToolbar
        search={{
          visible: showSearch,
          name: "calendar-search",
          placeholder: labels.search,
          value: searchValue,
          onChange: onSearchChange,
        }}
        filters={{
          items: filters,
          values: filterValues,
          inlineLimit: filters?.length ?? 0,
          namePrefix: "calendar-filter",
          onChange: onFilterValueChange,
          includeAll: false,
          labels,
        }}
        chips={{
          items: activeChips,
          clearAllLabel: labels.clearAll,
          onRemove: (key) => (key === "all" ? onClearAll() : onClearChip(key)),
          gap: "xs",
        }}
        right={navControls}
        leftFlex={toolbarLeftFlex}
        rightFlex={toolbarRightFlex}
        gap="xs"
      />
    </Flex>
  );
};

// ---------------------------------------------------------------------------
// MonthView — Flex column of week rows, each a Flex row of equal-width day
// cells (Box flex={1}). Tile per cell gives the boxed gridline look. Overflow
// beyond maxEventsPerDay collapses into a "N more" Link that opens a day Panel.
// ---------------------------------------------------------------------------
const MonthView = ({
  refDate,
  now,
  weekStartsOn,
  hideWeekends,
  weeks,
  eventsForDay,
  maxEventsPerDay,
  chipProps,
  renderDayCell,
  labels,
}) => {
  const headers = weekdayLabels(weekStartsOn, hideWeekends, true);
  const today = now || new Date();

  // Uniform cell HEIGHT (so the table's vertical-centering doesn't push the day
  // number to different heights between full and sparse cells): every cell
  // renders the SAME number of equal-height (24px) slots — a chip, a transparent
  // spacer, or the SVG "+N more" — and a full-width spacer also pins each column
  // to MONTH_COL_WIDTH so the 7 columns stay equal.
  const spacer24 = makeSpacerDataUri(MONTH_CHIP_HEIGHT, MONTH_COL_WIDTH);
  const renderCell = (day) => {
    const dayEvents = eventsForDay(day);
    const inMonth = isSameMonth(day, refDate);
    const isToday = isSameDay(day, today);

    if (renderDayCell) return renderDayCell(day, dayEvents);

    const shown = dayEvents.slice(0, maxEventsPerDay);
    const hasOverflow = dayEvents.length > maxEventsPerDay;

    const slots = [];
    for (let i = 0; i < maxEventsPerDay; i++) {
      if (i < shown.length) {
        slots.push(<MonthChip key={shown[i].key} event={shown[i]} day={day} {...chipProps} />);
      } else {
        slots.push(
          <Image key={`sp-${i}`} src={spacer24.src} width={spacer24.width} height={spacer24.height} alt="" />
        );
      }
    }
    if (hasOverflow) {
      const more = makeMoreDataUri({
        label: labels.more(dayEvents.length - maxEventsPerDay),
        width: MONTH_COL_WIDTH,
        height: MONTH_CHIP_HEIGHT,
      });
      slots.push(
        <Image
          key="more"
          src={more.src}
          width={more.width}
          height={more.height}
          alt={labels.more(dayEvents.length - maxEventsPerDay)}
          overlay={
            <Popover id={`cal-day-${day.getTime()}`} placement="top" variant="longform">
              <Tile compact>
                <Flex direction="column" gap="sm">
                  <Flex direction="row" align="center" gap="sm">
                    <Heading>{String(dayEvents.length)}</Heading>
                    <Text format={{ fontWeight: "demibold" }}>{labels.onThisDate}</Text>
                  </Flex>
                  <Divider />
                  {dayEvents.map((event, i) => (
                    <React.Fragment key={event.key}>
                      <DayListItem event={event} day={day} {...chipProps} />
                      {i < dayEvents.length - 1 ? <Divider /> : null}
                    </React.Fragment>
                  ))}
                </Flex>
              </Tile>
            </Popover>
          }
        />
      );
    } else {
      slots.push(
        <Image key="more-sp" src={spacer24.src} width={spacer24.width} height={spacer24.height} alt="" />
      );
    }

    return (
      <Flex direction="column" gap="xs">
        <Flex direction="row" align="center" gap="xs">
          {isToday ? <ColorDot variant="info" /> : null}
          <Text variant="microcopy" format={{ fontWeight: inMonth ? "demibold" : "regular" }}>
            {String(day.getDate())}
          </Text>
        </Flex>
        {slots}
      </Flex>
    );
  };

  return (
    <Table bordered={true} flush={true}>
      <TableHead>
        <TableRow>
          {headers.map((h) => (
            <TableHeader key={h} width="min" align="center">
              {h.toUpperCase()}
            </TableHeader>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {weeks.map((week, wi) => {
          const days = hideWeekends
            ? week.filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
            : week;
          return (
            <TableRow key={wi}>
              {days.map((day) => (
                <TableCell key={day.getTime()} width="min">
                  {renderCell(day)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

// ---------------------------------------------------------------------------
// AgendaView — the focused week's events grouped under day headers, each event a
// clean time · dot+title · owner row.
// ---------------------------------------------------------------------------
const AgendaView = ({ rangeStart, rangeEnd, eventsForDay, chipProps, labels, renderEmptyState }) => {
  const days = [];
  let cursor = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  while (cursor <= end) {
    const dayEvents = eventsForDay(cursor);
    if (dayEvents.length > 0) days.push({ day: cursor, events: dayEvents });
    cursor = addDays(cursor, 1);
  }

  if (days.length === 0) {
    if (renderEmptyState) return renderEmptyState({});
    return (
      <EmptyState title={labels.noEventsTitle}>
        <Text>{labels.noEventsMessage}</Text>
      </EmptyState>
    );
  }

  return (
    <Flex direction="column" gap="lg">
      {days.map(({ day, events }) => (
        <Flex key={day.getTime()} direction="column" gap="sm">
          <Flex direction="row" justify="between" align="end">
            <Text format={{ fontWeight: "demibold" }}>{formatDayTitle(day)}</Text>
            <Text variant="microcopy">{`${events.length} ${events.length === 1 ? "event" : "events"}`}</Text>
          </Flex>
          <Divider />
          {events.map((event) => (
            <AgendaEventRow key={event.key} event={event} day={day} {...chipProps} />
          ))}
        </Flex>
      ))}
    </Flex>
  );
};

// Accurate clock duration between start and end: "30 min", "1 hr", "1 hr 30 min".
const formatTimedDuration = (start, end) => {
  const mins = Math.max(0, Math.round(((end || start).getTime() - start.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
};

// The hour-rows a timed event occupies. An event ending exactly on the hour
// (13:00) occupies through the PREVIOUS hour-row (12), so 7:30–13:00 spans the
// 7,8,…,12 rows. A sub-hour event still claims at least its start row.
const hourSpan = (event) => {
  const start = event.start;
  const end = event.end || event.start;
  const sHour = start.getHours();
  let lastHour = end.getHours();
  if (end.getMinutes() === 0 && end.getTime() > start.getTime()) lastHour -= 1;
  if (lastHour < sHour) lastHour = sHour;
  return { sHour, lastHour };
};

// ---------------------------------------------------------------------------
// TimeGridView — hour-row week/day grid as a real <Table>: a TIME gutter column
// plus one column per day. Multi-hour events can't span table rows (no rowspan /
// no height control), so a spanning event REPEATS down every hour-row it covers:
// the start row shows the full range + duration, continuation rows show
// "↑ cont. through …", and a head clipped at the top of the window shows
// "↓ from …". Empty hours render as blank fixed-height blocks. An event that
// falls ENTIRELY before/after [dayStartHour, dayEndHour] is pinned to the nearest edge row with a
// "before/after" note (never dropped). Date-only / midnight-to-midnight events
// go to an all-day band.
// ---------------------------------------------------------------------------
const TimeGridView = ({ days, now, hours, dayStartHour, dayEndHour, eventsForDay, chipProps, labels }) => {
  const today = now || new Date();
  const centerDays = days.length === 1;
  const dayColWidth = days.length === 1 ? TIMEGRID_DAY_COL_SINGLE : TIMEGRID_DAY_COL;
  // "now" marker: the gutter row for the current hour is highlighted when today
  // is one of the visible days (a true now-line can't be positioned between rows).
  const todayInView = days.some((d) => isSameDay(d, today));
  const nowHour = today.getHours();

  const dayData = days.map((day) => {
    const evs = eventsForDay(day);
    const allDay = [];
    const timed = [];
    evs.forEach((e) => {
      if (isAllDayEvent(e)) {
        allDay.push(e);
        return;
      }
      const { sHour, lastHour } = hourSpan(e);
      timed.push({ e, sHour, lastHour });
    });
    return { day, allDay, timed };
  });

  const anyAllDay = dayData.some((d) => d.allDay.length > 0);

  // One clickable event token inside an hour cell. `o` is the occupying record
  // ({ entry, isStart, edge, clippedHead } or { entry, allday }); the subtitle
  // explains the row: a normal start (range + duration), a continuation, a head
  // clipped off the top of the window, or an event pinned to an edge row because
  // it falls entirely before/after the visible window.
  const eventToken = (o, hour, dayMs) => {
    const e = o.entry.e;
    const mode = o.allday ? "allday" : o.edge ? "edge" : o.isStart ? "start" : "cont";
    // Suffix MUST include the day: a multi-day event repeats across day columns,
    // and a shared overlay id would make clicking one open all of them.
    const overlay = buildOverlay(
      e,
      chipProps.overlayMode,
      chipProps.renderEventDetail,
      chipProps.labels,
      `-tg${mode}${hour}-${dayMs}`
    );
    const handleClick = chipProps.onEventClick ? () => chipProps.onEventClick(e.raw, e) : undefined;
    const variant = VALID_VARIANTS.has(e.color) ? e.color : "default";
    const startLabel = formatTime(e.start);
    const endLabel = formatTime(e.end || e.start);
    let sub = null;
    if (o.edge === "earlier") {
      sub = `${startLabel}–${endLabel} · before ${formatHourLabel(dayStartHour)}`;
    } else if (o.edge === "later") {
      sub = `${startLabel}–${endLabel} · after ${formatHourLabel(dayEndHour)}`;
    } else if (mode === "start" && o.clippedHead) {
      // Head clipped at the top of the window — don't pretend it starts here.
      sub = `↓ from ${startLabel}, through ${endLabel}`;
    } else if (mode === "start") {
      // Accurate clock duration (not the hour-row count): a 30-min event reads
      // "30 min", not "1 hr".
      const hasRealEnd = e.end && e.end.getTime() > e.start.getTime();
      sub = hasRealEnd
        ? `${startLabel}–${endLabel} · ${formatTimedDuration(e.start, e.end)}`
        : startLabel;
    } else if (mode === "cont") {
      sub = `↑ cont. through ${endLabel}`;
    }
    // Title rendered as a StatusTag (its own color dot + label) wrapped in a Link
    // for the overlay/click. The time/duration subtitle sits below as microcopy.
    return (
      <Flex key={`${e.key}-${mode}-${hour}`} direction="column" gap="flush">
        <Link overlay={overlay} onClick={handleClick}>
          <StatusTag variant={STATUS_VARIANT[variant] || "default"}>{e.title || "--"}</StatusTag>
        </Link>
        {sub ? <Text variant="microcopy">{sub}</Text> : null}
      </Flex>
    );
  };

  // A transparent fixed-width spacer placed in EVERY day cell so empty / sparse
  // days hold the same column width instead of collapsing to "--" width.
  const daySpacer = makeSpacerDataUri(1, dayColWidth);
  // Week (multi-day): width="min" + the fixed-width spacer = each column
  // shrink-wraps to an equal width and the table scrolls if the week is wider than
  // the container. Single day: one width="max" column that FILLS the table with
  // left-aligned content (a lone width="min"+spacer column instead stretches and
  // centers its content, which looks off).
  const dayCell = (key, content) => (
    <TableCell key={key} width={centerDays ? "max" : "min"} align="left">
      <Flex direction="column" gap="xs">
        {content}
        {centerDays ? null : (
          <Image src={daySpacer.src} width={daySpacer.width} height={daySpacer.height} alt="" />
        )}
      </Flex>
    </TableCell>
  );
  // A tall spacer in each hour-row's TIME gutter pins every hour to HOUR_SLOT_HEIGHT
  // (occupied or empty), so the grid reads as evenly spaced, scannable blocks.
  const slotSpacer = makeSpacerDataUri(HOUR_SLOT_HEIGHT, 1);
  // Empty hour cells are blank — the row height comes from the gutter spacer.
  const emptyCell = null;

  return (
    <Table bordered={true} flush={true} density="compact">
      <TableHead>
        <TableRow>
          <TableHeader width="min">TIME</TableHeader>
          {dayData.map(({ day }) => {
            const isToday = isSameDay(day, today);
            const label = `${formatWeekdayShort(day)} ${formatMonthShort(day)} ${day.getDate()}`;
            // Plain table header text (vertically centered by the platform); today
            // is flagged with a leading "Now"-style StatusTag rather than a dot.
            return (
              <TableHeader key={day.getTime()} width={centerDays ? "max" : "min"} align="left">
                {isToday ? `${label} · Today` : label}
              </TableHeader>
            );
          })}
        </TableRow>
      </TableHead>
      <TableBody>
        {anyAllDay ? (
          <TableRow>
            <TableCell width="min">
              {/* Mirror the hour-row gutter (leading spacer + Flex) so the
                  all-day label aligns with the time labels below it. */}
              <Flex direction="row" align="center" gap="xs">
                <Image src={slotSpacer.src} width={slotSpacer.width} height={slotSpacer.height} alt="" />
                <Text variant="microcopy">{labels.allDay}</Text>
              </Flex>
            </TableCell>
            {dayData.map(({ day, allDay }) =>
              dayCell(
                day.getTime(),
                allDay.length ? (
                  <Flex direction="column" gap="xs">
                    {allDay.map((e) => eventToken({ entry: { e }, allday: true }, "ad", day.getTime()))}
                  </Flex>
                ) : (
                  emptyCell
                )
              )
            )}
          </TableRow>
        ) : null}

        {hours.map((hour) => {
          const isNow = todayInView && hour === nowHour;
          return (
          <TableRow key={hour}>
            <TableCell width="min">
              <Flex direction="row" align="center" gap="xs">
                {/* Leading spacer pins the row to HOUR_SLOT_HEIGHT. */}
                <Image src={slotSpacer.src} width={slotSpacer.width} height={slotSpacer.height} alt="" />
                {/* Current hour → the label wrapped in an info StatusTag (renders
                    reliably; a ColorDot Image collapses as a leading min-cell child). */}
                {isNow ? (
                  // Trailing nbsp pads the chip's right edge so the final letter
                  // ("M" in "11 AM") isn't clipped by the min-width TIME column.
                  <StatusTag variant="info">{`${formatHourLabel(hour)} `}</StatusTag>
                ) : (
                  <Text variant="microcopy">{formatHourLabel(hour)}</Text>
                )}
              </Flex>
            </TableCell>
            {dayData.map(({ day, timed }) => {
              const occupying = timed
                .map((t) => {
                  let visStart = Math.max(t.sHour, dayStartHour);
                  let visEnd = Math.min(t.lastHour, dayEndHour);
                  let edge = null;
                  // Events fully outside the window are pinned to the nearest edge
                  // row (with a "before/after" note) instead of vanishing.
                  if (t.lastHour < dayStartHour) {
                    visStart = visEnd = dayStartHour;
                    edge = "earlier";
                  } else if (t.sHour > dayEndHour) {
                    visStart = visEnd = dayEndHour;
                    edge = "later";
                  }
                  if (hour < visStart || hour > visEnd) return null;
                  return { entry: t, isStart: hour === visStart, edge, clippedHead: !edge && t.sHour < dayStartHour };
                })
                .filter(Boolean);
              return dayCell(
                day.getTime(),
                occupying.length ? (
                  <Flex direction="column" gap="xs">
                    {occupying.map((o) => eventToken(o, hour, day.getTime()))}
                  </Flex>
                ) : (
                  emptyCell
                )
              );
            })}
          </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Calendar
// ═══════════════════════════════════════════════════════════════════════════
export const Calendar = (props) => {
  const {
    events = [],
    eventFields,
    // view control
    view: controlledView,
    defaultView = "month",
    onViewChange,
    views: viewsProp,
    // date control
    focusedDate: controlledFocusedDate,
    defaultFocusedDate,
    onNavigate,
    weekStartsOn = 0,
    hideWeekends = false,
    maxEventsPerDay = DEFAULT_MAX_EVENTS_PER_DAY,
    // time grid (week / day)
    dayStartHour = DEFAULT_DAY_START_HOUR,
    dayEndHour = DEFAULT_DAY_END_HOUR,
    // timezone
    timeZone: controlledTimeZone,
    defaultTimeZone,
    onTimeZoneChange,
    showTimeZoneSelect = false,
    timeZoneOptions: timeZoneOptionsProp,
    // filter / search
    filters,
    searchFields,
    searchValue: controlledSearch,
    onSearchChange,
    filterValues: controlledFilters,
    onFilterChange,
    fuzzySearch = false,
    showSearch = false,
    toolbarLeftFlex = 3,
    toolbarRightFlex = 2,
    // server-side
    serverSide = false,
    loading = false,
    error = false,
    onRangeChange,
    // overlay
    overlayMode = "popover",
    renderEventDetail,
    onEventClick,
    // render overrides
    renderToolbar,
    renderDayCell,
    renderEmptyState,
    renderLoadingState,
    renderErrorState,
    labels: labelsProp,
  } = props;

  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...(labelsProp || {}) }), [labelsProp]);
  const fields = useMemo(() => ({ ...DEFAULT_EVENT_FIELDS, ...(eventFields || {}) }), [eventFields]);

  // ---- View state (controlled or uncontrolled) ----
  const [internalView, setInternalView] = useState(defaultView);
  const view = controlledView != null ? controlledView : internalView;

  const enabledViews = useMemo(() => {
    const base = viewsProp && viewsProp.length > 0 ? viewsProp : ALL_VIEWS;
    return base.filter((v) => ALL_VIEWS.includes(v));
  }, [viewsProp]);

  const setView = useCallback(
    (next) => {
      if (controlledView == null) setInternalView(next);
      if (onViewChange) onViewChange(next);
    },
    [controlledView, onViewChange]
  );

  // ---- Timezone state (controlled via `timeZone`, else `defaultTimeZone` /
  // "UTC"). Engaged only when a tz is provided or the selector is shown; otherwise
  // `timeZone` is undefined → browser-local rendering (no conversion). ----
  const tzEnabled = controlledTimeZone != null || defaultTimeZone != null || showTimeZoneSelect;
  const [internalTimeZone, setInternalTimeZone] = useState(() => defaultTimeZone || "UTC");
  const timeZone = tzEnabled
    ? controlledTimeZone != null
      ? controlledTimeZone
      : internalTimeZone
    : undefined;
  const setTimeZone = useCallback(
    (next) => {
      if (controlledTimeZone == null) setInternalTimeZone(next);
      if (onTimeZoneChange) onTimeZoneChange(next);
    },
    [controlledTimeZone, onTimeZoneChange]
  );
  // "Now" as a wall-clock Date in the active zone — drives Today + the today/now
  // indicators so they reflect the selected zone, not the browser.
  const nowWall = toWallClock(new Date(), timeZone);

  // ---- Focused date state ----
  const [internalDate, setInternalDate] = useState(
    () => toDate(defaultFocusedDate) || startOfDay(nowWall)
  );
  // Fall back to today on the controlled path too — an unparseable/empty
  // controlled `focusedDate` must not crash every downstream date computation.
  const focusedDate =
    (controlledFocusedDate != null ? toDate(controlledFocusedDate) : internalDate) || startOfDay(nowWall);

  // ---- Navigation ----
  const stepFor = useCallback(
    (dir) => {
      if (view === "week" || view === "agenda") return addDays(focusedDate, dir * 7);
      if (view === "day") return addDays(focusedDate, dir);
      return addMonths(focusedDate, dir); // month
    },
    [view, focusedDate]
  );

  const navigateTo = useCallback(
    (nextDate) => {
      if (controlledFocusedDate == null) setInternalDate(nextDate);
      if (onNavigate) onNavigate(nextDate, { view });
    },
    [controlledFocusedDate, onNavigate, view]
  );

  const handlePrev = useCallback(() => navigateTo(stepFor(-1)), [navigateTo, stepFor]);
  const handleNext = useCallback(() => navigateTo(stepFor(1)), [navigateTo, stepFor]);
  // "Today" = today in the active zone, not the browser's.
  const handleToday = useCallback(() => navigateTo(startOfDay(toWallClock(new Date(), timeZone))), [navigateTo, timeZone]);

  // ---- Visible range + view-specific scaffolding (matrix / week days) ----
  const { rangeStart, rangeEnd, weeks, gridDays } = useMemo(() => {
    if (view === "month") {
      const matrix = buildMonthMatrix(focusedDate, weekStartsOn);
      const flat = matrix.flat();
      return {
        weeks: matrix,
        gridDays: null,
        rangeStart: startOfDay(flat[0]),
        rangeEnd: endOfDay(flat[flat.length - 1]),
      };
    }
    if (view === "week") {
      const days = buildWeekDays(focusedDate, weekStartsOn, hideWeekends);
      return {
        weeks: null,
        gridDays: days,
        rangeStart: startOfDay(days[0]),
        rangeEnd: endOfDay(days[days.length - 1]),
      };
    }
    if (view === "day") {
      return {
        weeks: null,
        gridDays: [startOfDay(focusedDate)],
        rangeStart: startOfDay(focusedDate),
        rangeEnd: endOfDay(focusedDate),
      };
    }
    // agenda → show the focused WEEK (next/prev moves by a week)
    const agendaDays = buildWeekDays(focusedDate, weekStartsOn, false);
    return {
      weeks: null,
      gridDays: null,
      rangeStart: startOfDay(agendaDays[0]),
      rangeEnd: endOfDay(agendaDays[agendaDays.length - 1]),
    };
  }, [view, focusedDate, weekStartsOn, hideWeekends]);

  // ---- Filter/search state ----
  const [internalSearch, setInternalSearch] = useState("");
  const searchTerm = controlledSearch != null ? controlledSearch : internalSearch;

  const buildEmptyFilters = useCallback(
    () => getEmptyFilterValues(filters),
    [filters]
  );
  const [internalFilters, setInternalFilters] = useState(buildEmptyFilters);
  const filterVals = controlledFilters != null ? controlledFilters : internalFilters;

  const handleSearchChange = useCallback(
    (v) => {
      if (controlledSearch == null) setInternalSearch(v);
      if (onSearchChange) onSearchChange(v);
    },
    [controlledSearch, onSearchChange]
  );

  const handleFilterValueChange = useCallback(
    (name, v) => {
      const next = { ...filterVals, [name]: v };
      if (controlledFilters == null) setInternalFilters(next);
      if (onFilterChange) onFilterChange(next);
    },
    [filterVals, controlledFilters, onFilterChange]
  );

  const handleClearChip = useCallback(
    (name) => {
      const next = resetFilterValues(filters, filterVals, name);
      if (controlledFilters == null) setInternalFilters(next);
      if (onFilterChange) onFilterChange(next);
    },
    [filters, filterVals, controlledFilters, onFilterChange]
  );

  const handleClearAll = useCallback(() => {
    const empty = buildEmptyFilters();
    if (controlledFilters == null) setInternalFilters(empty);
    if (onFilterChange) onFilterChange(empty);
    if (controlledSearch == null) setInternalSearch("");
    if (onSearchChange) onSearchChange("");
  }, [buildEmptyFilters, controlledFilters, onFilterChange, controlledSearch, onSearchChange]);

  const activeChips = useMemo(
    () => buildActiveFilterChips(filters, filterVals, {
      dateFromPrefix: "",
      dateToPrefix: "",
      dateJoiner: " – ",
    }),
    [filters, filterVals]
  );

  // ---- Normalize events ----
  // Event instants are converted to "wall-clock" Dates in the active zone, so all
  // downstream placement / grouping / formatting (which use local-time methods)
  // resolve in that zone. With no zone, toWallClock is a no-op (browser-local).
  const normalized = useMemo(
    () =>
      (events || []).map((raw, index) => {
        const start = toWallClock(toDate(resolveField(raw, fields.start)), timeZone);
        const endRaw = toWallClock(toDate(resolveField(raw, fields.end)), timeZone);
        const id = resolveField(raw, fields.id);
        return {
          key: id != null ? String(id) : `evt-${index}`,
          id,
          start,
          end: endRaw || start,
          title: resolveField(raw, fields.title),
          subtitle: resolveField(raw, fields.subtitle),
          color: resolveField(raw, fields.color),
          href: normalizeHref(fields.href, raw),
          raw,
        };
      }),
    [events, fields, timeZone]
  );

  // ---- Apply client-side filter/search (skipped in serverSide mode) ----
  const queried = useMemo(() => {
    if (serverSide) return normalized;
    let rows = normalized.map((e) => e.raw);
    rows = filterRows(rows, filters, filterVals);
    rows = searchRows(rows, searchTerm, searchFields, { fuzzy: fuzzySearch });
    const keep = new Set(rows);
    return normalized.filter((e) => keep.has(e.raw));
  }, [serverSide, normalized, filters, filterVals, searchTerm, searchFields, fuzzySearch]);

  // ---- Day → events lookup (interval intersects the day) ----
  const eventsForDay = useCallback(
    (day) => {
      const ds = startOfDay(day).getTime();
      const de = endOfDay(day).getTime();
      return queried
        .filter((e) => {
          if (!e.start) return false;
          const es = e.start.getTime();
          const ee = (e.end || e.start).getTime();
          return es <= de && ee >= ds;
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime());
    },
    [queried]
  );

  // ---- Notify parent of range changes (server-side data fetching) ----
  const rangeKey = `${rangeStart.getTime()}-${rangeEnd.getTime()}`;
  useEffect(() => {
    if (onRangeChange) onRangeChange({ start: rangeStart, end: rangeEnd, view });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  // ---- Title ----
  const title = useMemo(() => {
    if (view === "day") return formatDayTitle(focusedDate);
    if (view === "week" || view === "agenda") {
      // Agenda is a 1-week view too. Honor hideWeekends for the week grid so the
      // title endpoints match the rendered range (agenda always spans the full week).
      const days = buildWeekDays(focusedDate, weekStartsOn, view === "week" && hideWeekends);
      return formatRangeTitle(days[0], days[days.length - 1]);
    }
    return formatMonthTitle(focusedDate);
  }, [view, focusedDate, weekStartsOn, hideWeekends]);

  const chipProps = { overlayMode, renderEventDetail, onEventClick, labels };

  // ---- Timezone selector options (DST-aware labels) ----
  const timeZoneOptions = useMemo(() => {
    if (!showTimeZoneSelect) return null;
    const base = (timeZoneOptionsProp && timeZoneOptionsProp.length ? timeZoneOptionsProp : DEFAULT_TIME_ZONES).map(
      (z) => (typeof z === "string" ? { value: z } : z)
    );
    if (timeZone && !base.some((o) => o.value === timeZone)) base.unshift({ value: timeZone });
    return base.map((o) => ({ value: o.value, label: o.label || formatTimeZoneLabel(o.value) }));
  }, [showTimeZoneSelect, timeZoneOptionsProp, timeZone]);

  // ---- Toolbar (override or default) ----
  const toolbarApi = {
    title,
    view,
    views: enabledViews,
    onViewChange: setView,
    onPrev: handlePrev,
    onNext: handleNext,
    onToday: handleToday,
    focusedDate,
    timeZone,
    onTimeZoneChange: setTimeZone,
    timeZoneOptions,
  };
  const toolbar = renderToolbar ? (
    renderToolbar(toolbarApi)
  ) : (
    <Toolbar
      {...toolbarApi}
      labels={labels}
      showSearch={showSearch}
      searchValue={searchTerm}
      onSearchChange={handleSearchChange}
      filters={filters}
      filterValues={filterVals}
      onFilterValueChange={handleFilterValueChange}
      activeChips={activeChips}
      onClearChip={handleClearChip}
      onClearAll={handleClearAll}
      toolbarLeftFlex={toolbarLeftFlex}
      toolbarRightFlex={toolbarRightFlex}
    />
  );

  // ---- Body: loading / error / view ----
  let body;
  if (loading) {
    body = renderLoadingState ? (
      renderLoadingState({})
    ) : (
      <Flex direction="row" justify="center">
        <LoadingSpinner label={labels.loading} />
      </Flex>
    );
  } else if (error) {
    body = renderErrorState ? (
      renderErrorState({ error })
    ) : (
      <Alert title={labels.errorTitle} variant="error">
        {typeof error === "string" ? error : labels.errorMessage}
      </Alert>
    );
  } else if (view === "month") {
    body = (
      <MonthView
        refDate={focusedDate}
        now={nowWall}
        weekStartsOn={weekStartsOn}
        hideWeekends={hideWeekends}
        weeks={weeks}
        eventsForDay={eventsForDay}
        maxEventsPerDay={maxEventsPerDay}
        chipProps={chipProps}
        renderDayCell={renderDayCell}
        labels={labels}
      />
    );
  } else if (view === "week" || view === "day") {
    // Day view is the same hour grid as week, with a single (wider) day column.
    body = (
      <TimeGridView
        days={gridDays}
        now={nowWall}
        hours={buildHours(dayStartHour, dayEndHour)}
        dayStartHour={dayStartHour}
        dayEndHour={dayEndHour}
        eventsForDay={eventsForDay}
        chipProps={chipProps}
        labels={labels}
      />
    );
  } else {
    // agenda — emptiness is decided by the VISIBLE range inside AgendaView, so
    // renderEmptyState fires correctly when the focused week has no events.
    body = (
      <AgendaView
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        eventsForDay={eventsForDay}
        chipProps={chipProps}
        labels={labels}
        renderEmptyState={renderEmptyState}
      />
    );
  }

  return (
    <Flex direction="column" gap="sm">
      {toolbar}
      {body}
    </Flex>
  );
};

export default Calendar;
