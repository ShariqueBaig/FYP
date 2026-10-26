# Locator Inspector

A live, on-page tool that gives you a Playwright locator for whatever element
you're hovering, already verified against the live DOM to match exactly one
node — in any frame, including cross-origin ones it can't reach directly but
detects and reports honestly. It also records real usage into a runnable
Playwright test, watches every locator you rely on for breaks, remembers this
app's own conventions across sessions, diagnoses a failing locator segment by
segment, and catches every toast/error the instant it renders.

No browser extension, no IT approval, no admin install: it's a bookmarklet, so
it works instantly even in locked-down managed browsers. Zero runtime
dependencies. Nothing ever leaves the browser — the knowledge base is local
IndexedDB, and the network watcher stores metadata only, never payloads.

For the full feature tour (what each of the six tabs does, keyboard
shortcuts, how the locator engine escalates, security model), open
`dist/install.html` — that page is the maintained, up-to-date reference, so
it's not duplicated here.

## Layout

Two folders, split by audience:

```
dist/     What a user opens. Nothing else. Fully self-contained, generated.
  install.html        Open this and drag the button to your bookmarks bar.
  bookmarklet.txt      The javascript: URI itself, if you'd rather paste it.

dev/      Everything for building/maintaining the tool. Not shipped.
  overlay.js               The entire tool. Every change starts and ends here.
  install.template.html    Source for dist/install.html. Edit this, not the generated file.
  build-bookmarklet.js     Wraps overlay.js into the javascript: URI.
  package.json             npm test / npm run build.
  tests/*.test.js          The regression suite (see below).
```

If you're distributing this tool to someone else, they only ever need
`dist/install.html` (or the whole `dist/` folder). `dev/` is for whoever
maintains `overlay.js` itself.

## How the engine is organized

**Everything lives in `overlay.js`** (~6,400 lines) — the whole engine, agent,
and UI, wrapped in a single `boot(mode)` function with zero runtime
dependencies. It's injected either as a bookmarklet (`javascript:` URI) or by
`eval`-ing the source directly (which is exactly how the test suites load it:
`window.eval(overlaySrc)` inside a jsdom window, then calling the exposed
`window.__locatorInspector` API). The file is organized into clearly banner-
commented sections, in this order:

1. **Cross-frame registry** — a non-enumerable object on the top window so
   same-origin frame realms can share state without page scripts discovering
   it by walking `window.top`.
2. **Config, stats persistence** — localStorage-backed, nothing leaves the
   browser.
3. **DOM/CSS low-level helpers**, then **heuristics for untrustworthy
   identifiers** — CSS-in-JS/styled-components hashes, framework-generated
   IDs (React `:r3:`, MUI, jQuery-UI, ExtJS), transient state classes
   (`is-active`, `-checked`) — all excluded as locator anchors. Also has the
   Securiti-specific rule: `urn:li:…` values (DataHub's globally-unique
   dataset/glossary-term/user keys) are treated as the deepest, most durable
   anchor available, ahead of everything else.
4. **Accessibility layer** — role + accessible-name computation, deliberately
   matching Playwright's own algorithm (name "from contents", including
   `img[alt]` and nested `aria-label`), including the icon-only-button and
   non-native-aria-label edge cases where a naive `getByRole` would resolve
   to zero elements in real Playwright.
5. **Uniqueness verification** — `matchesUniquely`/`countMatches`, plus
   `textUniquePageWide` which checks `getByText` uniqueness across the whole
   document (not just one tag) to mirror Playwright's real text engine.
6. **CSS candidate generation** — an escalation ladder: stable anchors → URN
   → single stable attribute → stable class combo → multi-attribute
   combinations → `:has()` descendant anchoring → bare tag → ancestor-scoped
   path → absolute positional path (last resort).
7. **Boundary detection** — Shadow DOM and iframe handling, including
   `frameSelector` pinning iframes by `src` fragment (needed when an iframe
   has no id/name and coexists with 3rd-party iframes).
8. **Contextual/relative locators** — when a leaf isn't unique alone
   (identical per-row Delete/Edit buttons), it's scoped under the nearest
   meaningful container (table row / list item / card / named landmark),
   preferring a container carrying a URN or Ant Design `data-row-key`. Both
   container and leaf are independently verified 1-of-1 before the chain is
   emitted.
9. **Playwright locator formatting** (`playwrightLocator`) and **the main
   resolver** (`resolveUniqueLocator`) — ties all of the above together into
   the primary Playwright locator + CSS fallback + grade (A–F) + stability
   classification (unique / scoped / positional), with virtualized-list
   detection (Ant Table body, `react-window`, etc.) forcing content/URN pins
   instead of recycling-prone positional ones.
10. **IndexedDB persistence layer** — `open`/`put`/`get`/`getAll` plus
    `makeCatalogBackend()`, an approved-locator catalog keyed by
    role+name+urn+route, with growth controls (unapprove, clear-stale,
    hard cap + eviction, auto-vacuum).
11. **Learner** — `sampleConventions`/`learnFrom`/`recomputeAppModel` infers
    this app's test-hook attribute, hashed-class/id prefixes, and top roles,
    purely local statistical inference (explicitly not ML).
12. **Drift detection** — `pageFingerprint`/`diffFingerprints`/`checkDrift`
    diffs a route's current fingerprint against its last-visit baseline.
13. **Network patching + error correlation** — wraps `fetch`/XHR to redact
    URLs (host + path with id-like segments masked + GraphQL op name only;
    everything else in the query string is dropped) and links caught
    error banners to the request that caused them.
14. **Action recorder** — `recAction`/`onRecClick`/`onRecInput`/… captures a
    flow across frames into a runnable Playwright test via
    `exportPlaywright()`; sensitive fields (passwords/cards/OTP, detected by
    `isSensitiveField`) are always masked, never recorded verbatim. Undo/Redo
    stacks, cross-origin handoff that carries recorded steps into a new tab.
15. **Transient capture** — catches toasts/banners/validation messages the
    instant they appear, even short-lived ones.
16. **UI** — tooltip, panel, and its six tabs (Inspect / Health / Record /
    Learn / Doctor / Feed), CSV export helpers, draggable/4-side-resizable
    panel, entrance animation.
17. **Frame injection** (`injectAllFrames`/`injectFrame`) and **teardown**
    (`destroy()`, which fully restores `fetch`/XHR/`history` and removes all
    listeners and frame satellites).

Every DOM/network hook is wrapped in `guard()` (a `try/catch` that swallows
silently) so a bug in this tool can never throw into the host page's console,
block navigation, or break the app's own requests — this fail-safe property,
plus the URL-redaction and field-masking behavior above, are covered by
dedicated security assertions in `tests/v4-agent.test.js` and should be
preserved by any change that touches network capture, the recorder, or the
cross-frame registry.

Tests don't use a framework — each suite hand-rolls a `check(name, condition,
debugValue)` counter, builds a jsdom window, `eval`s `overlay.js` into it, and
asserts against the returned `window.__locatorInspector` API surface
directly.

## Rebuild after editing `overlay.js` or `install.template.html`

```bash
cd dev
npm run build     # writes ../dist/bookmarklet.txt and ../dist/install.html
```

## Tests

```bash
cd dev
npm test
```

Eight jsdom-based suites, no login, no real browser, no risk — they build a
fake DOM in Node, inject `overlay.js` (or, for `build-output.test.js`, the
actual built bookmarklet) into it, and assert against the result.

| File | What it proves |
|---|---|
| `tests/unique-locator.test.js` | Core engine: the locator escalation ladder. |
| `tests/v4-agent.test.js` | Recorder, cross-frame registry, panel UI, security assertions (URL redaction, password masking, fail-safe teardown). |
| `tests/contextual.test.js` | Relative locators: per-row Delete buttons scoped under their row. |
| `tests/securiti-datahub.test.js` | Securiti-specific rules: URN anchoring, Ant Design row keys, recording-aware cross-origin duality. |
| `tests/catalog.test.js` | The IndexedDB-backed approved-locator catalog. |
| `tests/spec-compliance.test.js` | That the engine's model of Playwright matches real Playwright's semantics. |
| `tests/doctor.test.js` | Locator Doctor: paste a broken locator, get told which segment died. |
| `tests/build-output.test.js` | Runs the ACTUAL built bookmarklet (not raw `overlay.js`) through the same suite, catching build-pipeline bugs the other files can't see. |

Passing this suite proves the engine and UI logic. It does not prove CSS
rendering, animation timing, or anything jsdom doesn't evaluate (custom
properties, layout, real animations) — that class of bug only shows up by
injecting into a real browser, which is how every visual feature here was
actually verified before shipping. This has caught real, otherwise-invisible
bugs during development: a toast with a fully transparent background, and a
panel that silently reverted to invisible right after its entrance animation
finished. Verify any CSS/animation change by injecting the built bookmarklet
into a real browser tab and reading `getComputedStyle`, not just `npm test`.

One of `v4-agent.test.js`'s checks (`check-generated-specs.js`) shells out to
`../../../securiti-playwright-auth/scripts/check-generated-specs.js` if that
sibling folder exists on this machine, and skips gracefully otherwise — it's
the only cross-repo path in the suite. If `tests/` ever moves relative to the
rest of this workspace, keep that `../../..` depth in sync or the check will
silently stop running (0 failures reported, but one fewer check than before —
always diff the total assertion count against a known-good run, not just
whether anything failed).

## Security & privacy

- **No secrets at rest or in memory.** Captured URLs are redacted to host +
  path (id-like segments masked) + the GraphQL operation name only; no
  request/response bodies are ever read.
- **Recorder masks sensitive fields.** Passwords, card/CVV/OTP and
  secret-named inputs are never recorded — the emitted test gets a safe
  placeholder + TODO instead.
- **Never breaks the host app.** Every hook (`fetch`/XHR/history/
  MutationObserver/listeners) is wrapped so a bug in this tool can't reject
  the app's own requests, block navigation, or throw into its console.
  Teardown fully restores everything and removes every listener.
- **Right to erase.** Learn tab → "Clear all stored data" wipes the local
  IndexedDB.

## Honest limitations

- Closed shadow roots and cross-origin iframes cannot be pierced by anyone —
  that's a browser security rule, not a gap here. The tool detects and
  reports them rather than guessing.
- "Learning" is local heuristic/statistical inference, not AI/ML. Confidence
  grows with how much of the app you visit.
- The recorder emits a solid first draft, not a hand-tuned suite — review
  assertions/waits before committing a recorded test.
- Flakiness prediction is signal from this session's interaction, not proof.
- Satellite injection uses `eval` in each frame. Fine under a report-only
  CSP; an enforced `script-src` without `'unsafe-eval'` would silently
  disable in-frame satellites (the top-window panel still works).
