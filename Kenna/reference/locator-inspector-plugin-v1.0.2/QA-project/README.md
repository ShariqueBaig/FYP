# QA-project

> **New here? Read `START-HERE.md` instead.** It's the 30-second install and
> the handful of things you actually type. This file is the fuller reference.

This whole folder is what gets handed to other employees — see
"Distributing to other employees" below before you send it on.

**Locator Inspector**: a browser bookmarklet that finds a rock-solid Playwright
locator for anything you hover on Securiti's app, and records a click-through flow
into a ready-to-run Playwright test — no extension, no install, no config.

## Quick start (once per person)

**If you use Claude Code**, install this whole folder as a plugin instead —
Claude then drives the tool itself (injects it, inspects elements, records
flows, exports scripts) instead of you clicking through the panel by hand.
See "Claude Code plugin" below. Steps 1–2 here are still needed either way
(the bookmarklet/runner are what the plugin drives).

1. **Install the bookmarklet.** Open `locator-inspector/dist/install.html` in
   your browser and drag the button to your bookmarks bar. That's the entire
   install.
2. **Set up the shared test runner** (only needed if you'll *run* a recorded
   script, not just inspect locators):
   ```bash
   cd securiti-playwright-auth
   npm ci && npm run browsers
   cp .env.example .env        # fill in YOUR OWN email + password (+ MFA code on qa/dev)
   npm run login               # opens a browser, logs in once, saves the session
   ```
   Your `.env` and saved session are yours alone — gitignored, never shared, never
   committed. Everyone on the team does this step once with their own credentials.

That's it. Nothing else to configure.

## Using it

1. Go to the app, click the bookmarklet, open its **Record** tab, **Start
   recording**, do your flow, **Stop**.
2. Click **Copy Playwright test** (the **Generic** tab — it's the one that just
   runs as-is).
3. Paste it into `exports/generic/<name>.spec.ts`, or straight into
   `securiti-playwright-auth/tests/generated/<name>.spec.ts` if you're using
   the shared runner.
4. Run it:
   ```bash
   cd securiti-playwright-auth
   npx playwright test tests/generated/<name>.spec.ts --headed
   ```

No login code to write — the runner in `securiti-playwright-auth/` logs in for
every spec in `tests/generated/`, so the pasted file is nothing but your recorded
steps.

**Hit a cross-origin module (e.g. EDC inside the qa.securiti.xyz shell) mid-recording?**
The Record tab tells you up front and gives you a button that opens it in its own
tab and embeds that hop as a real, executable step in your script. Click the
bookmarklet again in the new tab and recording resumes there automatically — just
paste that tab's steps in right after the hop, as-is.

## What's in here

| Folder | What it's for |
|---|---|
| `locator-inspector/` | The tool itself. `dist/install.html` is the only file you open by hand; `dev/` is the source + tests. Has its own `README.md`. |
| `exports/` | Where copied exports land — `generic/` and `company-style/`, each with a one-line README. |
| `securiti-playwright-auth/` | The shared runner — logs in once, runs anything pasted into `tests/generated/`. Has its own `README.md`. |
| `adoption-kit/` | Only needed when folding a Company-style export into a real team repo's own page objects/fixtures — see its `ADOPTING.md`. Most people won't touch this. |
| `skills/` | The `locator-inspector` skill — how Claude drives the tool. Loaded via the plugin; nothing to open by hand. |
| `.claude-plugin/` | Plugin + marketplace manifests. Bump `version` in `plugin.json` to ship a change. |

## Claude Code plugin

This folder is also a Claude Code plugin (`.claude-plugin/plugin.json` +
`marketplace.json` at the root). Once installed, Claude uses the
`locator-inspector` skill to drive the real tool through browser automation —
injecting `overlay.js`, calling its verified `resolveUniqueLocator`/
`exportPlaywright` functions directly, and never hand-writing a locator — plus
the bundled `adopt-recorded-test` skill to fold a recording into a real repo.
Needs a browser-automation tool in the session (Playwright MCP or
`claude-in-chrome`) for the automated path; without one, Claude falls back to
walking you through the bookmarklet by hand and adopting what you paste back.

Verified end-to-end against the live logged-in QA app on 2026-08-13: injection
succeeded (CSP did not block it), the engine graded a real sidebar item
`A` and emitted `page.getByRole('menuitem', { name: 'Domains', exact: true })`,
a recorded flow exported as a valid runnable spec, the cross-origin EDC module
was correctly reported as unreachable rather than guessed into, and teardown
restored the page cleanly.

Each person installs once, using the path where **they** unzipped this folder:

```
/plugin marketplace add /full/path/to/QA-project
/plugin install locator-inspector@qa-tools
```

Then **restart Claude Code** — skills are loaded at session start, so they
won't appear in the session where you installed them.

Verify it took:

```bash
claude plugin details locator-inspector      # expect: Skills (2)
```

### Editing the plugin: bump the version or your change won't ship

Installing **copies** this folder into
`~/.claude/plugins/cache/qa-tools/locator-inspector/<version>/`. That snapshot
is what actually runs — editing this folder afterwards changes nothing in a
live session. Because `plugin.json` pins `version`, `claude plugin update` also
does nothing until that string changes.

So after editing any skill or the tool itself:

1. Bump `version` in `.claude-plugin/plugin.json`.
2. `claude plugin uninstall locator-inspector && claude plugin install locator-inspector@qa-tools`
3. Restart Claude Code (skills load at session start).

Verify the running copy actually has your change rather than assuming:

```bash
claude plugin details locator-inspector       # confirms the version now live
```

Skills reference bundled files through `${CLAUDE_PLUGIN_ROOT}`, which resolves
to that install directory — never a path relative to the user's project.

## Distributing to other employees

The whole `QA-project` folder ships as one package, distributed as a **zip**.

Each recipient unzips it anywhere, then points Claude Code at their own copy:

```
/plugin marketplace add /full/path/to/their/QA-project
/plugin install locator-inspector@qa-tools
```

…and restarts Claude Code. The marketplace path is per-machine, so each person
uses the path where *they* unzipped it.

Two consequences of shipping by zip, worth knowing up front:

- **No automatic updates.** A new version means sending a new zip, and each
  person re-installs (`/plugin uninstall locator-inspector`, unzip the new copy,
  install again). Copies drift; that's the trade for not using git.
- **Nothing is excluded for you.** `.gitignore` only protects a git push. A zip
  includes whatever is in the folder, so run the credential check below by hand
  every time.

**Check before zipping — nothing here should ever leave your machine:**

```bash
find . -name ".env" -o -name "settings.local.json" -o -name ".auth" -o -name "*.log" | grep -v node_modules
```

Expect no output. If anything appears, delete it before zipping.

- `securiti-playwright-auth/.env` and `.auth/` must not be included. Each
  employee creates their own from `.env.example` and runs `npm run login` with
  their own credentials — the per-person setup step documented above.
- `.claude/settings.local.json` must not be included. Claude Code writes your
  local permission grants there, and anything you approved as a shell command
  (including any command you typed a password into) is stored verbatim.

Also delete both `node_modules/` folders before zipping (~88 MB combined;
`npm ci` regenerates them on the recipient's machine).

`securiti-playwright-auth/` has no `CLAUDE.md` — its `README.md` covers
everything (contract, settings, failure playbook), and its credential files
stay template-only (`.env.example`) until each person logs in with their own.
