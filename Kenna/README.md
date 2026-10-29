# Kenna

**Intent-aware, self-healing GUI automation for accessible AI assistants.**
FYP by Sharique Baig, Maira Aijaz and Barkhi Khan (IBA). Live demo: <https://insta.shariquebaig.com/?demo=1>
(also <https://kenna-fyp.vercel.app/?demo=1>; keep `?demo=1`, without it the app shows a real login screen).

> **Start here.** Rules for coding agents: [`../AGENTS.md`](../AGENTS.md) - what is unfinished: [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) -
> claims, evidence and the demo script: [`docs/DEFENSE.md`](docs/DEFENSE.md) - **jury preparation (glossary, novelty, 40 Q&A): [`docs/DEFENSE_PREP.md`](docs/DEFENSE_PREP.md)** - dated history: [`docs/FYP_MVP_PLAN.md`](docs/FYP_MVP_PLAN.md).

## 1. What it is, in plain words
Some people cannot tap a screen themselves, so an AI assistant does it for them. Apps keep changing (buttons renamed, reworded,
moved), and assistants then break or tap the wrong thing **without saying so**. Kenna:

1. takes a **goal** ("post a photo with caption hello"), never a button;
2. finds the control through a **ladder** of ways (id, label, text, container, remembered, **model**, position). A way only counts
   if it points at **exactly one** control;
3. **checks the next screen**; a tap that changed nothing counts as wrong and the next way is tried;
4. if nothing works it **stops and says why in plain words** instead of failing silently.

The newest piece is a **language model as a helper, never a boss**: it may only answer with indices into the list of controls that are
really on screen, its pick is judged by the same check as everything else, and publishing needs high confidence and only its first choice.
A model answer is also **remembered**, so the next run does not need to ask again.

## 2. Folder map
```
Kenna/
  README.md                this page
  agent/                   runnable side: command line, model bridge, reports, protocol scripts      -> agent/README.md
  fyp-mvp/                 the product: harness.js (intents, ladder, breaks, memory, teaching)       -> fyp-mvp/README.md
  path-b/                  Android: adb capture, intent/route layer, live tests on the emulator      -> path-b/README.md
  results/published/       committed evidence: manifest + report + raw log per experiment            -> results/README.md
  docs/                    plan and history, next steps, defense material, Android guides            -> docs/README.md
  demo/  site/             prebuilt mock-Instagram web bundle, and the deployable copy (generated)
  assets/                  poster, introduction image, app screenshots                               -> assets/README.md
  reference/               a related QA tool, NOT this FYP's contribution                            -> reference/README.md
  insta clone/             app source: a SEPARATE git repo (git-ignored here); never copy liveConfig.ts
```
`agent/results/` is git-ignored working output (copy what you cite into `results/published/`). `path-b/results/` holds the earlier **stub-model** Android runs
(tracked, labelled STUB: plumbing evidence, never cite them as model results). Key files `agent/anthropic.key` and `agent/openrouter.key` are git-ignored.

## 3. Start in 30 seconds
Needs Node >= 18. No GPU, no login, no internet after setup, no model key.
```bash
bash Kenna/agent/setup.sh                         # once: installs Playwright + Chromium
node Kenna/agent/fyp.mjs describe                 # what can be asked
node Kenna/agent/fyp.mjs run --caption "hello"    # whole create-post flow, one JSON document out
```
Output contract: stdout is exactly one JSON document, logs go to stderr; exit `0` completed, `1` ran but needs the user (read
`userMessage`), `2` could not run.

## 4. Evidence at a glance (details and wording for the defense: [`docs/DEFENSE.md`](docs/DEFENSE.md))
| claim | result | where |
|---|---|---|
| **C1** a recorded script breaks under UI change; the ladder survives it | N=10 per cell, 12 configurations. Ladder completes 100% [72-100] on clean, B1-B7 singly and B1+B2+B3+B4; the recorded script 0% [0-28] on B1, B2, B6, B7 and every combination. Both stop honestly on B8 | `results/published/rules_full_n10/` |
| **C2/C3** a model rung heals what rules cannot read, and verification stops silent mistakes | Real model `qwen/qwen3.7-flash`, **N=10**, 5 drift configs x 5 arms: rules alone 0% [0-28] on three drifted configs; **hybrid 100% [72-100]** on clean, B9, B1+B9, B1+B10+B9; the bare model 0% on every config with 1.0-4.4 silent wrong actions per run (on the clean app it silently skips one step). Both stop on the most extreme config. Repetitions are partly duplicates (temperature 0 + cache) | `results/published/semantic_n10_qwen37flash/`, `qual_qwen37flash_*/` |
| **C6** real drift on Android (system language / font) | Real model, 5 Settings rows x 2 sessions per cell. French: rules 2/10 = 20% [6-51], hybrid 10/10 = 100% [72-100]. Large font: all arms 8/10 (two rows fall below the fold; nothing scrolls yet) | `results/published/android_qual_qwen37flash/` |
| **C7** how many controls really have no name | 2% nameless across 5 Settings screens x 3 sessions, once the labels of what is inside a clickable row count (looking only at the control's own attributes says 78% "anonymous") | `path-b/dumps/sessions/` |
| **C4/C5** planted instructions; remembered model answers | built and unit-tested; the full N=10 real-model protocol covering these is run with `bash agent/run_protocol.sh` | `docs/NEXT_STEPS.md` |

Not claimed: Instagram (login and bot protection are out of scope, plan 2.4), a user study with screen-reader users, a second app,
more than one model. Every report states its model, its N and whether it is `valid` (a run in which model calls failed is marked invalid).

## 5. What is built
**Harness (`fyp-mvp/harness.js`).** 9 intents for the create-post flow; the ladder; honest-failure messages with a screenshot; route memory
(`learn`); 11 injectable breaks B1-B11 (rename ids, strip labels, reverse layout, duplicate control, nested scroller, bare icon, overlay,
hidden control, reworded copy, relocated control, **planted instructions in labels**); arms `baseline`, `healed`, `llm-only`,
`model-verified`, `hybrid`; metrics for wrong and silent-wrong actions; a screen-reader narration region; a browser panel.

**Model layer (`agent/semantic.mjs`).** Providers `offline` (a word-overlap stand-in for plumbing tests, **never quote it as a model**),
`anthropic`, `openrouter` (default `qwen/qwen3.7-flash`: text + image input, about $0.03 / $0.13 per million tokens). Disk cache,
pacing, retry, fail-fast on a daily cap, a per-decision log, vision (screenshot with numbered badges), `suggest` (a model proposes which
recorded changes show a taught step worked; opt-in).

**Android (`path-b/`).** `adb_capture.py` (dump, parse, retry, suppressed-window flag), `android_layer.py` (the same ladder over
UiAutomator trees), live tests on an emulator (`live_smoke.py`, `live_suite.py`, `live_drift.py`), `hierdump.py` (coverage analyser).

**Evidence tooling.** `agent/report.mjs` (manifest + tables with 95% Wilson intervals from raw logs), `agent/run_protocol.sh`
(resumable real-model protocol), `agent/qualify.sh` and `path-b/qualify_android.sh` (small, fully logged go/no-go runs),
`agent/call_log_summary.mjs` (audit every model decision), `path-b/report_android.py`.

**Also built.** Plain-English front end (`say`), taught routines (`teach`, `routines`, `routine`), live-app login vault, protection probe
(`protect`, measures only, never evades), hosting on Vercel behind Cloudflare.

## 6. Commands cheat-sheet (all via `node Kenna/agent/fyp.mjs ...`)
| goal | command |
|---|---|
| one run | `run [--caption T] [--breaks B1,B9,B10] [--arm healed\|baseline\|llm-only] [--semantic offline\|anthropic\|openrouter]` |
| many runs with a report | `experiment --n 10 --set demo\|full\|semantic\|inject\|vision --arms baseline,healed,llm-only,model-verified,hybrid --out <dir>` |
| does remembering pay off | `learn --runs 8 --drift-at 2 --breaks B1,B9,B10 [--semantic ...]` |
| report / publish | `node agent/report.mjs <dir> [--publish <name>]` |
| model audit | `--semantic-log calls.jsonl` then `node agent/call_log_summary.mjs calls.jsonl --decisions` |
| accessibility | `survey`; Android: `python path-b/adb_capture.py dump`, `python path-b/live_suite.py --coverage 3` |
Common flags: `--viewport 410x779`, `--headed`, `--url <site>`, `--live`, `--login`, `--semantic-model <id>`, `--semantic-cache <file>`,
`--semantic-shot`. Environment: `FYP_SEMANTIC_REASONING=off` (no thinking tokens: about 5x faster and half the cost, same outcomes in the qualification),
`FYP_SEMANTIC_MIN_GAP_MS` (pacing for free tiers).

## 7. Models and keys
| provider | key (looked up in this order) | notes |
|---|---|---|
| `offline` | none | plumbing only; its numbers are labelled STUB in every report |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_API_KEY_FILE`, `agent/anthropic.key` | default model `claude-haiku-5-5` |
| `openrouter` | `OPENROUTER_API_KEY`, `OPENROUTER_API_KEY_FILE`, `agent/openrouter.key` | free models are capped at **50 requests/day per account (shared by all free models)**; a paid balance removes that |

Keys are never printed, logged or committed. **A human** puts the key in the git-ignored file by hand (this folder is inside OneDrive, which syncs it
to the cloud: revoke keys when the project ends). **An AI agent with its own key in its backend (for example Synthie)** drives the app itself: set the
variable in the environment of the process that runs the commands, never write it to a file, never ask the user for one, run the plan in
[`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) section 1, and report the model id, N, call and token counts. The model rules are in `../AGENTS.md` (rule 6).

## 8. Tests and the regression check
```bash
node --check Kenna/fyp-mvp/harness.js
node Kenna/agent/semantic.test.mjs && node Kenna/agent/report.test.mjs && node Kenna/agent/nl.test.mjs && node Kenna/agent/protect.test.mjs
python Kenna/path-b/android_layer.py selftest && python Kenna/path-b/adb_capture.py selftest && python Kenna/path-b/hierdump.py --selftest && python Kenna/path-b/report_android.py --selftest
node Kenna/agent/fyp.mjs run                       # expect 9/9
node Kenna/agent/fyp.mjs run --breaks B1,B4        # expect 9/9
node Kenna/agent/fyp.mjs run --breaks B8           # expect an honest stop at step 1
python Kenna/tools/check_links.py                  # every relative link in every markdown file resolves
```

## 9. Android emulator (this laptop)
SDK at `D:\AndroidSdk` (outside OneDrive), virtual device `kenna` (Android 34, Google APIs). Setup, start/stop commands, the findings from the first
real dumps and the freeze/recovery lessons are in [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md) section 3b. Only stock Settings has been tested.
**Demo it with the live dashboard:** `powershell -ExecutionPolicy Bypass -File Kenna\path-b\start_emulator.ps1` (clean start, software rendering, window centred), then
`python Kenna/path-b/dashboard.py` and open <http://127.0.0.1:8765> (pick tests, Run, Pause/Resume; details in [`path-b/README.md`](path-b/README.md)).

## 10. Credentials (live app only) and hosting
```bash
node Kenna/agent/fyp.mjs vault set      # YOU run this; hidden prompt; stored encrypted for your Windows user
node Kenna/agent/fyp.mjs vault status   # masked email, never the password
```
Env alternatives for Linux or an agent: `FYP_LOGIN_EMAIL`, `FYP_LOGIN_PASSWORD`; behind Cloudflare Access also `FYP_CF_ACCESS_ID`, `FYP_CF_ACCESS_SECRET`.
Never paste a password into chat or commit it. Before sharing the live path publicly rotate the password in `insta clone/liveConfig.ts`, and protect the
site or disable sign-ups (the Firestore rules let any signed-in user write).
```bash
bash Kenna/fyp-mvp/make-site.sh                                  # builds Kenna/site/ (demo + harness)
cd Kenna/site && vercel deploy --prod --yes --name kenna-fyp     # redeploy after ANY change to harness.js or the demo
```
Rebuild `demo/` only if `insta clone/` changed (`build-demo.sh`, then `sync-demo.sh`).

## 11. Known limits (say these before an examiner does)
- One mock web app plus stock Android Settings; one real model so far; the planted-instruction, vision and distillation steps of the protocol are still running.
- The success checks are hand-written (a model can *suggest* narrower ones, opt-in).
- Position-based fallback is the weakest route by design; nothing scrolls yet (large-font rows below the fold are missed).
- Repetitions use temperature 0 and a cache: they measure variation in the app and harness, not sampling variation of the model.
- The web demo says nothing about Android (plan section 11.2).
