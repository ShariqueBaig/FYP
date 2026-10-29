# AGENTS.md - read this first (for Momo and any other coding/ops agent)

> **Full guide to everything built, how to run it and what is tested: [`Kenna/README.md`](Kenna/README.md). What is unfinished and how to continue: [`Kenna/docs/NEXT_STEPS.md`](Kenna/docs/NEXT_STEPS.md).** This file is the rules and the command table.

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
| `describe` | intents, breaks B1-B11, parameters |
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
| `node Kenna/agent/demo_adversarial.mjs [--headed] [--live-model]` | the adversarial demo (poster Phase 2): DOM rotation / tree suppression baseline vs healed, B11 planted-instruction table, protection measurement. Measures and survives, never evades. Wording for the poster: `Kenna/docs/POSTER_PHASE2.md` |
| `... --semantic offline\|anthropic` | the **semantic rung**: a model is asked only when every rule route fails. `anthropic` needs `ANTHROPIC_API_KEY` in the environment or the git-ignored `agent/anthropic.key` (never chat). `offline` is a no-cost lexical stand-in for plumbing tests, **not** a measure of a model. Also `--semantic-model`, `--semantic-cache f.json`, `--semantic-shot` |
| `experiment --set semantic --arms baseline,healed,llm-only,hybrid` | drift the rules cannot read (B9 reword, B10 relocate); adds wrong-action and silent-wrong-action columns |
| `experiment --arms baseline,healed,llm-only,model-verified,hybrid`, `--set semantic\|inject\|vision` | arms and drift sets; `inject` plants instructions in labels (B11); `vision` removes all words (with `--semantic-shot`, screenshot + numbered badges) |
| `--semantic openrouter [--semantic-model id]` | OpenAI-format models via OpenRouter (key: `OPENROUTER_API_KEY` or `agent/openrouter.key`). **A run with `valid:false` had model calls fail: never quote it** |
| `node agent/report.mjs <dir> [--publish name]` / `bash agent/run_protocol.sh` | CI tables + manifest from raw logs; resumable real-model protocol |
| `python Kenna/path-b/dashboard.py` | **Android live dashboard** at <http://127.0.0.1:8765> (needs the emulator: `powershell -ExecutionPolicy Bypass -File Kenna\path-b\start_emulator.ps1`): pick scenes, run, pause/resume; the expected result follows the model menu; the offline stand-in is labelled "not an AI". Not for agents to drive: a human demo view |
| `login` / `run --login` | live app only: sign in with the vault login, then (for `run`) do the flow. Use `--live --url <site>` |
| `vault status\|set\|clear` | where the live login is kept. `set` is typed by the human, never by an agent. Status never prints the password |

Common flags: `--viewport 410x779` (default), `--headed`, `--url <already-served app>`.

## Repo map

Each folder has its own `README.md`. Code folders keep their paths (many scripts depend on them); everything else is filed under `docs/`, `assets/`, `reference/`.

| path | what | edit? |
|---|---|---|
| `Kenna/README.md` | entry page: what it is, folder map, evidence at a glance, commands, keys, tests | yes (keep current) |
| `Kenna/fyp-mvp/harness.js` | **the product**: intents, ladder, breaks B1-B11, scoring, agent API (`window.__FYP_AGENT`, section 12) | yes - source of truth; the runner serves it live |
| `Kenna/agent/` | command line, model bridge (`semantic.mjs`), reports (`report.mjs`), protocol scripts, Momo contract, tests | yes |
| `Kenna/path-b/` | Android: `adb_capture.py` (adb parser), `android_layer.py` (ladder + model rung), live emulator tests, `hierdump.py` (coverage). Run live on the `kenna` emulator (SDK at `D:\AndroidSdk`) against stock Settings only; `dashboard.py` + `live_demo.py` + `start_emulator.ps1` are the demo view. `live_dumper.py` / `intent_route_layer.py` are the old scaffold | yes |
| `Kenna/results/published/` | **committed evidence** (manifest + report + raw log per experiment); `agent/results/` is git-ignored working output; `path-b/results/` holds old stub-model Android runs (tracked, not citable as model results) | add via `report.mjs --publish` |
| `Kenna/docs/` | `DEFENSE.md`, `NEXT_STEPS.md`, `FYP_MVP_PLAN.md` (append to section 15), `SYNTHIE.md`, `PATH_B_GUIDE.md`, the original briefing | yes |
| `Kenna/tools/check_links.py` | every relative link and repo path in the markdown must resolve | run after moving or renaming a file |
| `Kenna/demo/`, `Kenna/site/` | prebuilt mock-Instagram web bundle and the deployable copy (generated) | **no** - regenerate, do not hand-edit |
| `Kenna/assets/` | poster, introduction image, app photos | no |
| `Kenna/reference/` | a related QA tool (`locator-inspector-plugin-v1.0.2/`); **not** this FYP's contribution | no |
| `Kenna/insta clone/` | app source - **a separate git repo** (`ShariqueBaig/insta-clone`), git-ignored here | only via its own repo |

## If you are an AI agent with your own Anthropic key (e.g. Synthie)

(Same for OpenRouter: set `OPENROUTER_API_KEY` and use `--semantic openrouter`; free-model accounts are capped at 50 requests/day.)
You have the key in your backend, so **run the real-model tests yourself; do not ask the user for a key and do not use `agent/anthropic.key`.**
Set `ANTHROPIC_API_KEY` in the environment of the process that runs the commands (never write it to a file, never print it), then follow
`Kenna/docs/NEXT_STEPS.md` section 1 with `--semantic anthropic --semantic-cache <file>`: the web `experiment --set semantic --arms ...`, `learn --semantic`,
`suggest <routine>`, and on Android `path-b/live_suite.py`, `path-b/live_drift.py` and `path-b/live_smoke.py` with `--semantic anthropic`
(needs the emulator, see `Kenna/docs/NEXT_STEPS.md` section 3b). Report the model id, N, call and token counts; separate "model was wrong and the check caught it" from
"model was wrong and nobody noticed" (silent). A human with no agent puts the key in `Kenna/agent/anthropic.key` instead.

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
