// ---------------------------------------------------------------------------
// HubSpot icon scraper — paste this into the DevTools console on ANY logged-in
// HubSpot web-app page. HubSpot renders its icons as inline <svg> with a
// `data-icon-name` attribute; this walks the DOM and harvests them.
//
// Only icons currently MOUNTED in the DOM are visible to it, so:
//   1. Paste once to define the harvester (it self-runs).
//   2. Navigate around (records, settings, workflows, the icon gallery in the
//      docs, etc.) and re-run `hsScrapeIcons()` on each page.
//   3. Results accumulate on `window.__hsIcons` across runs and are copied to
//      your clipboard each time. When you've covered enough surface area,
//      save the clipboard to `scripts/scraped-icons.json` and run
//      `node scripts/build-icons.mjs`.
//
// Keys are the verbatim `data-icon-name` (e.g. "Settings"). Hardcoded fills are
// dropped so the Icon component's `color` prop can recolor the glyph; explicit
// non-currentColor fills and fill-rules are preserved for multi-color/even-odd
// icons. Run `hsScrapeIcons.dump()` to print the full JSON without copying.
// ---------------------------------------------------------------------------
window.hsScrapeIcons = function hsScrapeIcons() {
  const store = (window.__hsIcons = window.__hsIcons || {});
  let added = 0;

  for (const svg of document.querySelectorAll("svg[data-icon-name]")) {
    const name = svg.getAttribute("data-icon-name");
    if (!name || store[name]) continue;

    const viewBox = svg.getAttribute("viewBox") || "0 0 24 24";
    const paths = [];
    for (const p of svg.querySelectorAll("path")) {
      // Skip definition paths — those inside <mask>/<defs>/<clipPath>/<symbol>
      // are not rendered content (e.g. a full-rect mask that would paint a
      // solid square over the glyph).
      if (p.closest("mask, defs, clipPath, symbol")) continue;
      const d = p.getAttribute("d");
      if (!d) continue;
      const fill = p.getAttribute("fill");
      const fillRule = p.getAttribute("fill-rule");
      const keepFill = fill && fill !== "currentColor" && fill !== "none";
      if (keepFill || fillRule) {
        paths.push({
          d,
          ...(keepFill ? { fill } : {}),
          ...(fillRule ? { fillRule } : {}),
        });
      } else {
        paths.push(d);
      }
    }
    if (paths.length) {
      store[name] = { viewBox, paths };
      added++;
    }
  }

  const total = Object.keys(store).length;
  console.log(
    `%c[hs-icons] +${added} new this run · ${total} total`,
    "color:#00bda5;font-weight:600"
  );

  const json = JSON.stringify(store, null, 2);
  try {
    copy(json); // DevTools console helper
    console.log("[hs-icons] full set copied to clipboard");
  } catch {
    console.log("[hs-icons] clipboard unavailable — use hsScrapeIcons.dump()");
  }
  return store;
};

window.hsScrapeIcons.dump = () =>
  console.log(JSON.stringify(window.__hsIcons || {}, null, 2));

window.hsScrapeIcons.reset = () => {
  window.__hsIcons = {};
  console.log("[hs-icons] store cleared");
};

// self-run on paste
window.hsScrapeIcons();
