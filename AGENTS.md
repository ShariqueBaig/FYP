# AGENTS.md - read this first (for Momo and any other coding/ops agent)

> **Full guide to everything built, how to run it and what is tested: [`Kenna/README.md`](Kenna/README.md). What is unfinished and how to continue: [`Kenna/NEXT_STEPS.md`](Kenna/NEXT_STEPS.md).** This file is the rules and the command table.

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
| `say "post a photo with caption hello" [--speak]` | plain English in, one JSON out with `heard`, `understoodAs` and `spoken`; asks (`need-more`) or declines (`not-understood`) instead of guessing |
| `teach --name like.first --say "like the first post" --headed` | the human does a task once; it learns steps + a success check each; refuses unverifiable steps; never records passwords. Saves `agent/routines/<name>.json` |
| `routines` / `routine <name> [--params '{...}'] [--breaks B1] [--arm baseline]` | list / replay taught routines through the healing ladder |
| `learn --runs 8 --drift-at 3 --breaks B1,B6` | route-memory experiment: memory on vs off after the UI changes (failed actions, time, runs to settle) |
| `protect --url <site> --setting "<label>" --n 10 --out results/protection` | how a site's protection layer treats this agent; measures and reports only, never evades |
| `... --semantic offline\|anthropic` | the **semantic rung**: a model is asked only when every rule route fails. `anthropic` needs `ANTHROPIC_API_KEY` in the environment (never a file, never chat). `offline` is a no-cost lexical stand-in for plumbing tests, **not** a measure of a model. Also `--semantic-model`, `--semantic-cache f.json`, `--semantic-shot` |
| `experiment --set semantic --arms baseline,healed,llm-only,hybrid` | drift the rules cannot read (B9 reword, B10 relocate); adds wrong-action and silent-wrong-action columns |
| `login` / `run --login` | live app only: sign in with the vault login, then (for `run`) do the flow. Use `--live --url <site>` |
| `vault status\|set\|clear` | where the live login is kept. `set` is typed by the human, never by an agent. Status never prints the password |

Common flags: `--viewport 410x779` (default), `--headed`, `--url <already-served app>`.

## Repo map

| path | what | edit? |
|---|---|---|
| `Kenna/fyp-mvp/harness.js` | **the product**: intents, ladder, breaks, scoring, agent API (`window.__FYP_AGENT`, section 12) | yes - source of truth; the runner serves it live |
| `Kenna/agent/` | headless CLI, static server, manifest, Momo contract; `semantic.mjs` is the model bridge (`semantic.test.mjs`) | yes |
| `Kenna/demo/` | prebuilt mock-Instagram web bundle (generated) | **no** - regenerate, do not hand-edit |
| `Kenna/insta clone/` | app source - **a separate git repo** (`ShariqueBaig/insta-clone`), git-ignored here | only via its own repo |
| `Kenna/FYP_MVP_PLAN.md` | decisions, taxonomy S1-S6, progress log. Read section 2 before changing scope | append to section 15 |
| `Kenna/path-b/` | Android accessibility-tree layer (Phase 2). `hierdump.py` (offline analyzer) and **`android_layer.py`** (intent/route ladder + model rung, `python android_layer.py selftest`) and **`adb_capture.py`** (adb capture + parser, `selftest`) work against saved/canned/synthetic dumps; `AdbDriver` and `adb_capture.py` have run live on the `kenna` emulator (SDK at `D:\AndroidSdk`) against stock Settings only; no Android arms comparison or real-model result exists. `live_dumper.py` now parses but needs Appium; `intent_route_layer.py` is the old scaffold | Phase 2 |
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
3. **No secrets in the repo, in a bundle, or in output.** The live login goes only through `agent/vault.mjs`; never print, log, paste or commit it. An agent must not ask the user to type a password into chat.
   `Kenna/insta clone/liveConfig.ts` holds a login for the *live* Firebase
   path and must never be committed or copied here. The demo needs none.
4. Do not claim Android results from the web demo (plan section 11.2 has the honest wording).
5. After editing `harness.js`, run `node --check Kenna/fyp-mvp/harness.js`, `node Kenna/agent/semantic.test.mjs` and a clean
   `run` plus `run --breaks B1,B4`; expect 9/9, and `--breaks B8` to stop honestly at step 1.
6. A model is never trusted with an action: it may only answer with indices into the on-screen control list, its answer is acted on as a *candidate* and judged by the step's success check, and an irreversible intent (`irreversible: true`, e.g. publishing) needs confidence >= 0.8 and only the first choice. Never quote `--semantic offline` numbers as a language model's; a model result needs `--semantic anthropic` and the model id stated.
