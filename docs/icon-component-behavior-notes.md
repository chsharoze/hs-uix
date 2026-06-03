# Icon component behavior notes

Context: `src/common-components/Icon.js` is a wrapper around HubSpot's native `Icon` plus a custom SVG-data-URI fallback rendered through HubSpot `Image`. During Feed demo work, custom chevron icons (`Down` / `Right`) exposed several interaction and layout edge cases.

## What we observed

### Native and custom icons use different render paths

`Icon` delegates to HubSpot's native `Icon` when the request is natively expressible. Otherwise it renders a HubSpot `Image` whose `src` is an SVG data URI.

That means these two usages can behave differently even though callers use the same `Icon` API:

```jsx
<Icon name="email" />      // native HubSpot Icon path
<Icon name="Down" />       // custom Image fallback path
```

### Custom `Image` icons can disappear/collapse in tight flex layouts

In the Feed card header, a bare custom `Icon` fallback appeared in the DOM but was visually missing or effectively collapsed:

```html
<span class="Image__ImageWrapper...">
  <img width="16" height="16" src="data:image/svg+xml..." />
</span>
```

The fix was to give the custom icon an explicit non-flexing wrapper:

```jsx
<Box flex="none" alignSelf="center">
  <Link variant="dark" onClick={onToggleExpanded}>
    <Icon name={expanded ? "Down" : "Right"} size="md" />
  </Link>
</Box>
```

Without `Box flex="none"`, HubSpot's layout could render the image node but not give it useful visual space.

### `Image` click handling works, but context matters

A demo test bed confirmed the custom Image path can render and receive clicks in multiple contexts:

- `hs-uix <Icon name="Down" onClick={...} />`
- Direct HubSpot `<Image src={makeIconDataUri("Down").src} onClick={...} />`
- HubSpot `<Link>` wrapping direct `<Image>`
- HubSpot `<Link>` wrapping `hs-uix <Icon>`
- HubSpot `<Button>` with `hs-uix <Icon>` child
- HubSpot `<ButtonRow>` with custom icon action

So the issue was not that HubSpot `Image` cannot be interactive; it was layout/context sensitivity in the Feed header.

### Native `Icon` should not be assumed to support interaction props

Passing `onClick` directly to HubSpot's native `Icon` did not behave reliably. Interactive native icons should be wrapped in an interactive primitive such as `Link` or `Button`.

The wrapper currently uses `Link` for interactive native icons to preserve the native glyph while putting `onClick` / `href` on a primitive that owns interaction.

### Exact icon names matter

Custom scraped icons are keyed with original casing, e.g. `Down`, `Right`, `Email`. Native HubSpot icon names are lower/camel-case, e.g. `downCarat`, `right`, `email`.

The resolver now prefers:

1. exact native name
2. exact custom name
3. alias / case-insensitive native mapping

This allows callers to explicitly request a custom scraped icon with `Down` while still supporting convenient aliases like `down`.

### Wrapping full title content in `Link` can distort layout

Wrapping the whole Feed title cluster (`chevron + type icon + title text`) in a `Link` made the title underlined and affected alignment/layout. The current Feed approach keeps only the chevron link-wrapped.

## Current Feed pattern

The Feed card collapse control currently uses:

```jsx
<Flex direction="row" align="center" gap="xs" wrap="nowrap">
  <Box flex="none" alignSelf="center">
    <Link variant="dark" onClick={onToggleExpanded}>
      <Icon
        name={expanded ? "Down" : "Right"}
        size="md"
        screenReaderText={expanded ? "Collapse" : "Expand"}
      />
    </Link>
  </Box>
  {typeIcon}
  {titleText}
</Flex>
```

## Demo test bed

A temporary/diagnostic demo exists in `../hs-uix-demos/src/app/pages/icon-demos.jsx` named **Icon clickable test bed**. It exercises custom icon rendering and click behavior across multiple HubSpot primitive contexts.

## Follow-up ideas

- Add an exported `ClickableIcon` / `IconButton` helper that bakes in the safe wrapper pattern.
- Add docs to `src/common-components/README.md` explaining native vs custom render paths and layout caveats.
- Consider a wrapper option like `interactiveWrapper="link" | "none"` for advanced callers.
- Consider normalizing intrinsic layout around custom `Image` icons inside the `Icon` component itself if HubSpot primitives allow a safe universal wrapper.
