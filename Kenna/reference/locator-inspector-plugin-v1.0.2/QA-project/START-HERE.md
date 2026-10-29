# START HERE — Locator Inspector

A tool that gives you a **verified** Playwright locator for anything on
Securiti's app, and records a click-through flow into a runnable Playwright
test. It runs inside Claude Code: you ask in plain English, Claude drives it.

Every locator it hands you has been checked against the live page to match
exactly one element. It grades each one A–F and tells you when one is fragile,
instead of guessing.

---

## Install (once, about 30 seconds)

**Step 1 — run the installer.** In Claude Code, from inside this folder:

```
./install.sh
```

If you'd rather do it by hand, these two commands are all it does (replace the
path with wherever you unzipped this folder):

```
/plugin marketplace add /full/path/to/QA-project
/plugin install locator-inspector@qa-tools
```

**Step 2 — restart Claude Code.** Required. Skills only load when a session
starts, so it won't show up in the session where you installed it.

**Step 3 — check it worked.** Type `/` and you should see:

- `/locator-inspector`
- `/locator-inspector:adopt-recorded-test`

---

## Using it

Just ask. No special syntax needed:

```
get me a locator for the Add button on the Glossary page
```
```
record a test for creating a domain
```
```
why did this locator stop working: page.getByRole('button', { name: 'Add' })
```

Or invoke it explicitly: `/locator-inspector <what you want>`

**To turn a recording into a test in your team's repo**, run this from inside
that repo so it can match your repo's own conventions:

```
/locator-inspector:adopt-recorded-test
```

---

## One thing to know about how it behaves

If your Claude Code session has browser automation (Playwright MCP or the
Chrome extension), Claude drives the whole thing itself.

If it doesn't, Claude will hand you a bookmarklet to click instead, and work
from what you paste back. It tells you which mode it's in — and either way it
will **never invent a locator**. If it can't verify one, it says so.

---

## Optional — only if you want to *run* recorded tests

Recording and inspecting need nothing extra. To actually execute a recorded
script, set up the bundled runner once with **your own** login:

```bash
cd securiti-playwright-auth
npm ci && npm run browsers
cp .env.example .env        # fill in YOUR email + password
npm run login
```

Your `.env` and saved session stay on your machine — never share them.

---

More detail — full feature tour, architecture, updating — is in `README.md`
next to this file.
