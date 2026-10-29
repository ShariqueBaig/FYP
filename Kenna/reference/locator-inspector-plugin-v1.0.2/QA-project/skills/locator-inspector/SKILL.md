---
name: locator-inspector
description: Drive the Locator Inspector tool (locator-inspector/dev/overlay.js) live in a real browser to get a verified Playwright locator for an element, or to record a click-through flow into a runnable Playwright test. Use whenever someone asks for a Playwright locator/selector for something in Securiti's app, asks to "record a test", "generate a script for this page", "inspect this element", "check if this locator still works", or "diagnose this broken locator". Never hand-write a Playwright locator for this app when this tool is reachable — call it and use its verified output.
---

# Locator Inspector — driving it live

This tool computes a Playwright locator for a live DOM element and verifies it
resolves to exactly one node before ever handing it back — grade A–F,
`unique: true/false`, stability classification. It also records a real
click-through flow into a runnable Playwright test.

## Where the files are

Everything ships inside this plugin. Use these paths — **do not assume the
tool is in the user's current working directory**, because usually it isn't:

| What | Path |
| --- | --- |
| The engine (inject this) | `${CLAUDE_PLUGIN_ROOT}/locator-inspector/dev/overlay.js` |
| Feature/architecture reference | `${CLAUDE_PLUGIN_ROOT}/locator-inspector/README.md` |
| The bookmarklet install page (manual mode) | `${CLAUDE_PLUGIN_ROOT}/locator-inspector/dist/install.html` |
| Shared authenticated test runner | `${CLAUDE_PLUGIN_ROOT}/securiti-playwright-auth/` |
| Where exports land | `${CLAUDE_PLUGIN_ROOT}/exports/generic/`, `.../company-style/` |

`${CLAUDE_PLUGIN_ROOT}` is substituted for you anywhere in this file. If for
some reason it isn't resolved, locate `overlay.js` with Glob/Bash before
guessing at a path — and if you genuinely can't find it, say so instead of
proceeding without the tool.

Read the reference README above for anything not covered here rather than
guessing.

**Saving output**: the plugin's install directory is not a good place to write
the user's test files. Save exports into the user's own project (ask where if
it isn't obvious); use the `exports/` folders above only when the user is
working inside the QA-project folder itself.

**The one rule everything else serves: never invent a locator yourself for a
page this tool can reach.** Call the tool's real functions and report exactly
what they return — including when they say a locator is brittle or not
unique. A plausible-looking `getByRole(...)` you typed from eyeballing a
screenshot is exactly the "garbage locator" this tool exists to prevent.

## Step 0 — which mode is this session in?

Check what's actually available before doing anything:

- **Full-automation mode**: a browser-automation tool is available this
  session — Playwright MCP (`mcp__playwright__browser_*`) or the
  `claude-in-chrome` skill/tools. Use `ToolSearch` if unsure what's loaded.
  In this mode you drive everything below yourself.
- **Manual mode**: no browser automation available. Tell the user to open
  `${CLAUDE_PLUGIN_ROOT}/locator-inspector/dist/install.html`, drag the
  bookmarklet, and use the
  panel themselves. You then only help interpret or adopt whatever they paste
  back — you still never write a locator by hand; you read what the tool
  already emitted.

Don't silently downgrade to manual mode's behavior (guessing locators)
while claiming full-automation confidence. If automation isn't available,
say so.

## Step 1 — inject the tool (full-automation mode)

Navigate to the target URL and log in first, then inject. **Never read
`overlay.js` into your own context and pass it through a tool argument** — it's
~6,400 lines and would burn the session's context for nothing. Let Playwright
read the file itself:

```js
await page.addScriptTag({
  path: '${CLAUDE_PLUGIN_ROOT}/locator-inspector/dev/overlay.js'
});
```

Verified working against the live logged-in app (`qa.securiti.xyz`) — the
page's CSP did **not** block it, and the panel rendered with all 55 API
functions exposed.

Mechanics that will otherwise cost you several failed attempts:

- Run this through `browser_run_code_unsafe` using its **`filename`**
  parameter (write your script to a file, pass the path) — again so the code
  doesn't travel as a giant argument.
- That `filename` is restricted to allowed roots (the project directory and
  its `.playwright-mcp/`). A path under `/tmp` is rejected with
  "outside allowed roots" — put the script in the working directory.
- The Playwright server process is **ESM with no `fs`**: `require('fs')` fails
  with "require is not defined", and `await import('node:fs')` fails with
  `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`. This is exactly why
  `addScriptTag({ path })` is the right call — Playwright does the file read
  internally, so you never need `fs` at all.
- Re-injecting on a page where it's already active boots a second instance
  rather than toggling off (unlike clicking the bookmarklet twice). Call
  `destroy()` first when re-running:
  `await page.evaluate(() => { try { window.__locatorInspector.destroy(); } catch {} })`.

Verify the boot succeeded before doing anything else:

```js
!!window.__locatorInspector && window.__locatorInspector.active === true
```

If that's false, the injection failed — stop and report it rather than
proceeding and improvising a locator by hand.

When you're finished, call `destroy()` to leave the page clean; verified to
fully restore state (`active: false`, panel removed, `fetch` restored).

## Step 2 — the real API surface (`window.__locatorInspector`)

Everything below is read directly from the object the engine exposes
(`overlay.js`, the `win[NS] = {...}` assignment) — this is the actual
contract, not a paraphrase:

| Call | What it's for |
| --- | --- |
| `resolveUniqueLocator(el)` | The core: pass a real DOM element, get back `{ primary, primaryStrategy, css, grade, unique, stability, boundary, note, ... }`. `primary` is the ready-to-paste Playwright locator code. **This is the only legitimate source of a locator string in this tool's whole workflow.** |
| `exportPlaywright()` | Returns the full recorded flow as a Generic (flat, runnable) Playwright test — a string, straight from the function, no clipboard needed. |
| `exportPlaywrightCompanyStyle()` | Same recording, emitted as a Page-Object-shaped reference scaffold instead — not runnable standalone, meant for `adopt-recorded-test`. |
| `diagnoseLocator(locatorString)` | Locator Doctor: paste a locator that's failing now, get back which segment stopped matching. |
| `revalidateAll()` | Health-tab sweep: re-checks every tracked/approved locator against the live DOM. |
| `checkDrift()` | Diffs this route's current fingerprint against its last-visit baseline (Feed tab). |
| `learnFrom(document)` / `recomputeAppModel()` | Learn tab: (re)infers this app's test-hook attribute and ID/class conventions from what's on the page. |
| `_registry` | Cross-frame state, including `_registry.recording` (bool) and `_registry.actions` (the recorded step list). **Read-only in practice** — inspect it to confirm what was captured; start/stop recording through the panel button (Step 4), never by assigning to `recording`. |
| `Catalog` | The IndexedDB-backed approved-locator store (`Catalog.recall`, etc.) — `resolveUniqueLocator` already consults this itself; you don't need to call it directly. |
| `destroy()` | Full teardown — restores `fetch`/XHR/history, removes every listener. Call this when done if you don't want the tool left injected on the page. |

Full section-by-section breakdown of how the engine reaches these results
(accessibility layer, CSS escalation ladder, contextual/relative locators,
virtualized-list handling, URN anchoring for this app's DataHub `urn:li:…`
keys) is in `locator-inspector/README.md` under "How the engine is
organized" — read it if you need to explain *why* a result came out a
certain way, rather than re-deriving that logic yourself.

## Step 3 — inspecting a single element

1. Get a real handle to the target element (e.g. a snapshot `ref`, or a
   `querySelector` that you've confirmed matches exactly the element the user
   means — don't guess a selector here either; use the page's accessibility
   tree/snapshot to find it).
2. Call `window.__locatorInspector.resolveUniqueLocator(el)` with that actual
   element passed in, not a re-typed description of it.
   Beware of exactly the trap that catches hand-written selectors: this app
   renders **hidden twins** (a sidebar copy of a link with the same `href` as
   the visible in-body one). A `querySelector`/`.first()` silently picks
   whichever comes first in the DOM, which may be the hidden one — and your
   click then times out. Confirm the element is the visible one before
   resolving it.

3. Report `primary` as the locator. Always surface `grade` and `unique`
   alongside it:
   - `unique: false` → say so plainly. Don't present it as a working locator.
   - grade `D`/`F` → flag it as brittle before handing it over, quoting the
     tool's own `note`/`label` explanation of why.
   - grade `A`/`B` → fine to hand over as-is.

   **Trust its refusals.** When it says an element is *"HIDDEN RIGHT NOW
   (collapsed menu / closed panel / aria-hidden) — Playwright's getByRole
   cannot see it, so a role locator is not offered"*, that is a correct
   finding, not a shortcoming: verified live that Playwright's own
   `.click()` also refuses those same elements. Relay the note and the
   instruction to open the container first; do not "upgrade" the answer to a
   confident-looking `getByRole` the tool deliberately withheld.

## Step 4 — recording a flow into a Playwright test

1. **Start recording by clicking the tool's own Start button**, in the top
   window:

   ```js
   const p = document.getElementById('__locatorInspector-panel');
   p.querySelector('.tab[data-tab="record"]').click();   // builds the Record pane
   p.querySelector('#__locatorInspector-recbtn').click(); // real Start handler
   ```

   The panel lives in the light DOM (no shadow root), and `#…-recbtn` does not
   exist until the Record tab has been clicked once — the panes render lazily.

   **Do not just set `_registry.recording = true`.** That flag is only half of
   what Start does: the real handler also seeds the opening `navigate` action
   (and resets checkup state). Verified by direct comparison — with the flag
   flipped by hand, `exportPlaywright()` emits a test containing **no
   `page.goto` at all**, i.e. a script that opens nothing. `recNavigation` is
   not on the exposed API, so clicking the real button is the only correct way
   in. Read `_registry.recording` to *check* state; click the button to
   *change* it.
2. Perform the actual requested steps using **real browser-automation
   actions** (actual clicks/fills through the automation tool, not
   `el.click()` inside `evaluate`). The recorder listens on real DOM events
   in the capture phase — synthetic in-page calls may not fire the same way
   a genuine user-driven event does.
3. **Cross-origin hop mid-recording** (e.g. into an EDC module inside the
   qa.securiti.xyz shell): the tool detects this itself and surfaces a hop
   button that embeds the jump as a real step and carries recorded state
   into a new tab via a URL marker. If you're driving this, open the new tab
   yourself, re-run Step 1 (inject) there — the tool auto-resumes recording
   and prepends the carried steps once it sees the marker. Don't try to
   manually merge two separate recordings; let the tool's own carry-forward
   do it.
4. Stop by clicking the same button again (it toggles):
   `document.querySelector('#__locatorInspector-recbtn').click()`. Then sanity
   check `_registry.actions.length` and its step types — a correct recording
   starts with a `navigate` action:

   ```js
   window.__locatorInspector._registry.actions.map(a => a.type)
   // e.g. ["navigate","click","fill",...]
   ```

   No `navigate` first, or a length of 0, means the recording is not sound —
   fix that before exporting rather than shipping a script that won't open a
   page.
5. Export by calling the function directly and reading its return value —
   this is a real string, not a clipboard side-effect:
   - `window.__locatorInspector.exportPlaywright()` → Generic, runnable
     as-is.
   - `window.__locatorInspector.exportPlaywrightCompanyStyle()` → Company
     style, a reference for folding into a real repo.
6. **Read the generated header comment before handing anything over.** It
   states the flow name, brittle-step count, and what noise (duplicate
   navigations, coalesced fills, etc.) was already pruned. Surface any
   brittle (`grade D`/`F`) steps to the user explicitly — don't present a
   recording as clean when the tool itself flagged part of it as fragile.
7. Save the result:
   - Generic → the user's own project, or
     `${CLAUDE_PLUGIN_ROOT}/exports/generic/<name>.spec.ts`, or straight into
     `${CLAUDE_PLUGIN_ROOT}/securiti-playwright-auth/tests/generated/<name>.spec.ts`
     if they've set up the shared runner (see that folder's `README.md`).
   - Company style → `${CLAUDE_PLUGIN_ROOT}/exports/company-style/<name>/...`,
     then invoke this
     plugin's other bundled skill, **`adopt-recorded-test`**, to fold it into
     the user's real target repo. Do not skip its Phase 1 (discover that
     repo's own conventions) — a recorded test is a reference, not a
     finished one, and that skill's whole job is the translation step.

## Step 5 — Doctor and Health, on request

- **"This locator broke"** → `diagnoseLocator(locatorString)`, report which
  segment of the chain stopped matching, don't re-derive a fix by hand.
  Its report is `{ verdict, count, kind, steps[], reasons[], alternatives[],
  element }` — **`element` holds a live DOM node, so `JSON.stringify` on the
  whole report throws "Converting circular structure to JSON"**. Pull the
  scalars you need (`verdict`, `steps`, `reasons`) instead.

  It is genuinely good at this; trust it over your own reading. Live example:
  given `page.getByRole('button', { name: 'Glossary Terms' })` it returned
  `verdict: "broken"`, named the dying segment, warned that 5 frames on the
  page were cross-origin and unsearchable, and then identified the actual
  mistake — *"An element named "Glossary Terms" DOES exist, with role div /
  link / menu / list / listitem / menubar / menuitem — not "button""*.
- **"Is this still valid / did the page drift"** → `revalidateAll()` and/or
  `checkDrift()`; report what the tool found, not a visual guess.

## What "garbage" looks like — don't produce it

- A locator you typed without calling `resolveUniqueLocator` on the real
  element.
- Presenting `unique: false` or a `D`/`F` grade as if it were solid.
- An exported test with the brittle/noise warnings from its own header
  comment silently dropped from your report to the user.
- Treating a Company-style export as runnable on its own — it isn't; it's
  adoption-kit input.
- Writing a login step into an adopted test — the recording has none and
  needs none; the target repo already authenticates its own tests
  (`adopt-recorded-test` Phase 1 finds out how).
- Recording real secrets: sensitive fields (password/card/OTP-shaped) are
  already masked by the tool's own `isSensitiveField` check — trust that
  masking, don't type real production credentials into a recorded flow
  expecting them to show up in the export.

## Honest limitations (state these, don't paper over them)

- Closed shadow roots and cross-origin iframes cannot be pierced by anyone —
  a browser security rule, not a gap in this tool. It detects and reports
  these rather than guessing; so should you.
- "Learning" (`learnFrom`/`recomputeAppModel`) is local heuristic/statistical
  inference, not ML. Confidence grows with how much of the app has been
  visited, not with cleverness.
- A recorded export is a solid first draft, not a hand-tuned suite — say so
  when handing one over.
- Flakiness verdicts are signal from this session's interaction, not proof.
- Satellite injection into nested frames uses `eval`; under an *enforced*
  `script-src` without `'unsafe-eval'` those satellites silently won't run
  (the top-window panel still works) — if cross-frame behavior seems to be
  missing, check for this before assuming a bug.

## Manual mode (no browser automation available)

Tell the user: open `${CLAUDE_PLUGIN_ROOT}/locator-inspector/dist/install.html`
(give them the resolved absolute path, not a relative one — they are usually
not standing in the plugin directory), drag the button to
the bookmarks bar, click it on the target page, use the **Inspect** tab
(hover for a locator) or **Record** tab (Start → do the flow → Stop → Copy
Playwright test, Generic or Company style). Then paste the result back to
you. Once pasted, treat it exactly as Step 4's output: read its header
comment, surface brittle steps honestly, and route Company-style output
through `adopt-recorded-test`. You are still never hand-writing a locator —
you're relaying what the tool already verified.
