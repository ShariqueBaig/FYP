# AGENTS.md - read this first (for Momo and any other coding/ops agent)

**Project:** intent-aware, self-healing GUI automation for accessible AI assistants
(FYP: Sharique Baig, Maira Aijaz, Barkhi Khan). All work lives in `Kenna/`.

## 30-second start (plain shell, no GPU, no login, no internet after setup)

```bash
git pull
bash Kenna/agent/setup.sh            # once: npm install + Playwright Chromium (add --with-deps on bare Linux)
node Kenna/agent/fyp.mjs describe    # what can be asked
node Kenna/agent/fyp.mjs run --caption "hello from momo"   # full create-post flow, JSON out
```

Needs only **Node >= 18**. The app is a prebuilt static bundle in `Kenna/demo/`
(served locally by the runner, offline demo mode), so there is no Expo, no
Firebase and no `node_modules` for the app.

## Output contract (do not parse anything else)

* stdout = exactly one JSON document; progress/logs go to stderr.
* exit `0` completed - `1` ran but needs the user - `2` could not run.
* On failure read `userMessage` and tell the user. Behaviour rules for the
  assistant are in `Kenna/agent/MOMO.md`; tool schemas in `Kenna/agent/tool-manifest.json`.

## Commands

| command | what it does |
|---|---|
| `describe` | intents, breaks B1-B8, parameters |
| `status` | current screen, armed breaks, accessibility numbers |
| `run [--caption T] [--breaks B1,B4] [--arm healed\|baseline] [--shot f.png]` | whole flow, 9 intents, verified in the feed |
| `intent <id>` | one intent (fresh page each call: only `post.open` is valid cold) |
| `survey` | per-screen count of controls with no accessible name / role |
| `experiment --n 3 --set demo --out results/` | baseline vs healed over break configs; writes JSON + CSVs |

Common flags: `--viewport 410x779` (default), `--headed`, `--url <already-served app>`.

## Repo map

| path | what | edit? |
|---|---|---|
| `Kenna/fyp-mvp/harness.js` | **the product**: intents, ladder, breaks, scoring, agent API (`window.__FYP_AGENT`, section 12) | yes - source of truth; the runner serves it live |
| `Kenna/agent/` | headless CLI, static server, manifest, Momo contract | yes |
| `Kenna/demo/` | prebuilt mock-Instagram web bundle (generated) | **no** - regenerate, do not hand-edit |
| `Kenna/insta clone/` | app source - **a separate git repo** (`ShariqueBaig/insta-clone`), git-ignored here | only via its own repo |
| `Kenna/FYP_MVP_PLAN.md` | decisions, taxonomy S1-S6, progress log. Read section 2 before changing scope | append to section 15 |
| `Kenna/path-b/` | Android accessibility-tree analyzer (Phase 2). `hierdump.py` works; `live_dumper.py` and `intent_route_layer.py` have known bugs (plan section 8.3) | Phase 2 |
| `Kenna/PATH_B_GUIDE.md`, `kenna_android_automation_fyp_briefing_v2-1.md` | Android build procedure / original problem statement | reference |
| `Kenna/locator-inspector-plugin-v1.0.2/` | related QA tool; **not** this FYP's contribution | no |

## Rebuilding the demo bundle (only when the app source changed)

Needs the app repo checked out at `Kenna/insta clone/` with `npm install` done.

```bash
bash Kenna/fyp-mvp/build-demo.sh     # exports the app, writes Kenna/insta clone/dist
bash Kenna/fyp-mvp/sync-demo.sh      # copies dist -> Kenna/demo (without the harness copies)
```

## Hard rules

1. **Scope is locked** (plan section 2.3). Out of scope: behavioural-fingerprint / anti-bot *evasion*
   (plan 2.4, 11.4). Report suppression mechanisms and rates; do not build a bypass.
2. **Never hold a handle across an action; never count "no exception" as success**; the
   success signal is the predicate on the next screen.
3. **No secrets in the repo.** `Kenna/insta clone/liveConfig.ts` holds a login for the *live* Firebase
   path and must never be committed or copied here. The demo needs none.
4. Do not claim Android results from the web demo (plan section 11.2 has the honest wording).
5. After editing `harness.js`, run `node --check Kenna/fyp-mvp/harness.js` and a clean
   `run` plus `run --breaks B1,B4`; expect 9/9, and `--breaks B8` to stop honestly at step 1.
