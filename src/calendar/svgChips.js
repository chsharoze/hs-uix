// ═══════════════════════════════════════════════════════════════════════════
// Small inline-SVG data URIs (rendered via <Image>) used by the calendar views:
// a status dot, the month-grid event chip, the "+N more" affordance, and a
// transparent spacer for height/width pinning.
//
// Why SVG: there is no fixed-size Box (Box exposes only `flex`), no absolute
// positioning, and no CSS backgrounds, so a fixed-width chip or a precise spacer
// can't be drawn with layout primitives. SVG-via-<Image> is the escape hatch
// StyledText/AvatarStack already use.
// ═══════════════════════════════════════════════════════════════════════════

import { HS_FONT_FAMILY, HS_TEXT_COLOR } from "../common-components/svgDefaults.js";

const toDataUri = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const escapeXml = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const truncateLabel = (value, max) => {
  const s = String(value == null ? "" : value);
  if (!max || s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)).trimEnd() + "…";
};

// variant → fill, mirroring Tag/StatusTag semantics so a chip's left accent reads
// like its status.
const CHIP_PALETTE = {
  default: { fill: "#7FD1DE", text: HS_TEXT_COLOR },
  info: { fill: "#00A4BD", text: "#FFFFFF" },
  success: { fill: "#00BDA5", text: "#FFFFFF" },
  warning: { fill: "#F5C26B", text: HS_TEXT_COLOR },
  error: { fill: "#F2545B", text: "#FFFFFF" },
  danger: { fill: "#F2545B", text: "#FFFFFF" }, // StatusTag spells red "danger"; accept both
};

// Dot fills are stronger than the chip palette: an 8px light-teal "default" dot
// is nearly invisible on a white table. Default is a readable slate; the rest are
// the saturated status colors.
const DOT_FILL = {
  default: "#7C98B6",
  info: "#00A4BD",
  success: "#00BDA5",
  warning: "#EAA600",
  error: "#F2545B",
  danger: "#F2545B",
};

/**
 * A tight colored status dot as an SVG <Image>. An empty <StatusTag> renders as a
 * full pill (reserving label width + pill height), so for a real dot we draw a
 * small circle instead.
 */
export const makeDotDataUri = (variant = "default", size = 8) => {
  const fill = DOT_FILL[variant] || DOT_FILL.default;
  const r = size / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${r}" cy="${r}" r="${r}" fill="${fill}" />` +
    `</svg>`;
  return { src: toDataUri(svg), width: size, height: size };
};

/**
 * A fixed-width event "chip" for the month grid: white rounded rect with a thin
 * border, a colored left accent (stage variant), and dark truncated text. Drawn
 * as SVG because a Tag sizes to its content, so Tag chips end up different widths
 * and push their columns out of alignment; a fixed-width SVG keeps EVERY chip —
 * and therefore every column — exactly equal.
 */
export const makeEventChipDataUri = (opts) => {
  const { label, width, height = 24, variant = "default" } = opts;
  const palette = CHIP_PALETTE[variant] || CHIP_PALETTE.default;
  const accentX = 5;
  const accentW = 3;
  const textX = accentX + accentW + 6; // gap after the accent bar
  const rightPad = 8;
  // ~6.0px per char at 12px; truncate so the (un-wrapping) SVG text fits.
  const maxChars = Math.max(1, Math.floor((width - textX - rightPad) / 6.0));
  const text = truncateLabel(label, maxChars);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="4" ry="4" fill="#FFFFFF" stroke="#CBD6E2" stroke-width="1" />` +
    `<rect x="${accentX}" y="5" width="${accentW}" height="${height - 10}" rx="1.5" ry="1.5" fill="${palette.fill}" />` +
    `<text x="${textX}" y="${height / 2}" font-family='${HS_FONT_FAMILY}' font-size="12" font-weight="500" ` +
    `fill="${HS_TEXT_COLOR}" text-anchor="start" dominant-baseline="central">${escapeXml(text)}</text>` +
    `</svg>`;
  return { src: toDataUri(svg), width, height };
};

/**
 * The "+N more" affordance as a fixed-HEIGHT SVG (blue link-styled text, no
 * border, transparent background). Rendered as SVG so it occupies the exact same
 * slot height as an event chip — keeping every month cell the same height.
 */
export const makeMoreDataUri = (opts) => {
  const { label, width, height = 24 } = opts;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<text x="3" y="${height / 2}" font-family='${HS_FONT_FAMILY}' font-size="13" font-weight="700" ` +
    `fill="#0091AE" text-anchor="start" dominant-baseline="central">${escapeXml(label)}</text>` +
    `</svg>`;
  return { src: toDataUri(svg), width, height };
};

/**
 * A transparent fixed-size spacer as an SVG <Image>. Used to pin row heights and
 * column widths without any CSS height control.
 */
export const makeSpacerDataUri = (height = 24, width = 4) => {
  // The rect is REQUIRED: an empty <svg> rasterizes to a zero-size image and
  // <Image> then collapses (it won't hold its declared width/height). A
  // fully-transparent rect filling the box gives the SVG real content so the
  // image keeps its dimensions and actually reserves space.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF" fill-opacity="0" />` +
    `</svg>`;
  return { src: toDataUri(svg), width, height };
};
