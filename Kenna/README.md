# Kenna - what is built, what it does, how to run it

Intent-aware, self-healing GUI automation for accessible AI assistants
(FYP: Sharique Baig, Maira Aijaz, Barkhi Khan). **This is the one page to start from.** Unfinished work and the exact commands to continue it: [`NEXT_STEPS.md`](NEXT_STEPS.md).
`FYP_MVP_PLAN.md` is the dated history and the research reasoning; `AGENTS.md` is the
rules for coding agents; `agent/MOMO.md` is how the assistant must behave.

**Live demo:** https://insta.shariquebaig.com/?demo=1 (also https://kenna-fyp.vercel.app/?demo=1).
Use `?demo=1`: without it the app shows its real login screen, which the public demo cannot use.

## The idea in four lines
An assistant says a **goal** ("post a photo with caption hello"), never a locator. The harness finds the
control through a **ladder** of routes (id > label > text > scoped > position/vision > keyboard), acts, then
**checks the result on the next screen**. If one route fails it tries the next; if none can, it **stops and
says why** in plain words instead of failing silently. A baseline that replays one recorded locator per
step is run beside it, so the difference is measured.

## Start in 30 seconds
Needs Node >= 18 only. No GPU, no login, no internet after setup.
```bash
bash Kenna/agent/setup.sh                         # once: installs Playwright + Chromium
node Kenna/agent/fyp.mjs describe                 # what can be asked
node Kenna/agent/fyp.mjs run --caption "hello"    # whole create-post flow, one JSON out
```
Output contract: **stdout is exactly one JSON document**, logs go to stderr. Exit `0` completed, `1` ran but
needs the user (read `userMessage`), `2` could not run.

## Everything that is built

Status column is honest: **tested** = I ran it and saw the result; **not tested** = built but not yet run in that setting.

### Core
| Feature | Command / where | What it does | Status |
|---|---|---|---|
| Healing ladder + 9 intents | `run`, `intent <id>` | The create-post flow, verified by finding the new post in the feed | tested, 9/9 |
| 8 injectable breaks B1-B8 | `run --breaks B1,B4` | Rename ids, strip labels, shuffle order, duplicate "Next", nest scroll, bare icons, cover a control, hide a control | tested |
| Honest failure | automatic | First-person message, which step, why, plus a screenshot; B8 stops at step 1 | tested |
| Baseline arm | `run --arm baseline` | Recorded-locator replay, the "old way" | tested |
| Experiment + CSV | `experiment --n 3 --set demo --out results/` | Baseline vs healed over break configs; JSON + CSVs | tested |
| Accessibility survey | `survey` | Per screen: controls with no accessible name or role | tested |
| Browser panel | open the page; tabs Run / Break / Results / Log / A11y | Run, break and score by hand | tested |

### Added later
| Feature | Command | What it does | Status |
|---|---|---|---|
| **Plain-English front end** | `say "post a photo with caption hello" [--speak]` | Maps one sentence to a tool; asks "What should the caption say?" if missing; declines what it cannot do (delete, like...) | tested (11+3 cases, end to end). `--speak` audio not checked by ear |
| **Route memory** | `run --memory`, `learn --runs 10 --drift-at 3 --breaks B1,B6` | Remembers which route worked and which hit the wrong control; skips the wrong one next time | tested. B1+B6: 3 wasted actions then 0, 11.3 s -> 6.2 s per run. No gain on B7 (reported) |
| **Model rung + distillation** | `run --semantic offline\|anthropic`, `experiment --set semantic --arms baseline,healed,llm-only,hybrid`, `learn --semantic ...` | Rules first; a model is asked only when they fail, answers with on-screen indices only, and is verified by the step's success check. A model win is distilled into route memory | tested with the **offline stand-in only** (a word-overlap stub, not a model): hybrid 9/9 where rules alone fail, 0 silent wrong actions vs 1-5/run for unchecked llm-only; model calls 7 -> 1 per run with memory. **`anthropic` provider never run live** (no key). n=2. See plan 2026-10-29 |
| **OpenRouter provider** | `--semantic openrouter [--semantic-model id]` | Any OpenAI-format model, incl. free ones (default `qwen/qwen3.7-flash`: text+image input, about $0.03 / $0.13 per million tokens; set `FYP_SEMANTIC_REASONING=off` to disable thinking tokens); key in `agent/openrouter.key` or `OPENROUTER_API_KEY`; paces live calls, retries transient errors, **fails fast on a daily cap** and marks the run `valid:false` | tested with stubbed HTTP; **one real call seen to work; the free tier's 50 requests/day was then exhausted** |
| **Ablation + safety + vision** | `experiment --arms baseline,healed,llm-only,model-verified,hybrid`, `--set inject` (B11 plants instructions in labels), `--set vision`, `--semantic-shot` | model-verified = model + check but no rules; B11 counts taps on planted controls; vision = screenshot with numbered badges | built and unit-tested; stub-level results only |
| **Reports for the defense** | `node agent/report.mjs <dir> [--publish name]`, `python path-b/report_android.py <json>`, `bash agent/run_protocol.sh` | manifest (git commit, harness hash, model, calls, validity) + tables with 95% Wilson CIs, regenerated from raw logs; resumable protocol | tested (`report.test.mjs`) |
| **Defense material** | [`DEFENSE.md`](DEFENSE.md) | claims C1-C8 with honest status, live demo script, expected questions, limitations | written |
| **Android layer** | `python path-b/android_layer.py selftest` | Same ladder + model rung over UiAutomator dumps | selftest passes on a **synthetic** app; `adb_capture.py` + `AdbDriver` run live on an **emulator (stock Settings only)**: 4% of controls nameless once child labels count; one intent, rules and rules+stub-model both completed. **Not Instagram, not a real model, n=1**. See NEXT_STEPS 3b |
| **Teach by demonstration** | `teach --name like.first --say "like the first post" --headed` | You do a task once; it records steps and learns a success check from what changed. Refuses steps it cannot verify. Never records passwords | tested with a scripted human (`teach.demo.mjs`). **Not yet tried by a person** |
| Replay taught routines | `routines`, `routine <name> [--params '{"comment":"hi"}'] [--breaks B1] [--arm baseline] [--memory]` | Runs a taught routine through the same ladder; `say` uses the taught phrases | tested: 44 replays, `agent/results/routines/matrix.csv` |
| **Live login (vault)** | `vault status\|set\|clear`, `login --live --url <site>`, `run --live --login` | Signs in to the real Firebase app with a login kept in a vault, never in the repo, a bundle or output | tested against a **fake** local login only. **Real account not tested** |
| **Protection probe** | `protect --url <site> --setting "<label>" --n 10 --gap 3 --out results/protection` | N paced, unmodified trials; sorts each into completed / challenged / access-gated / rate-limited / blocked...; 95% intervals; CSV | tested: no rules 5/5, Bot Fight Mode 9/9, managed challenge 0/9. **Rate limit and Access not yet measured** |
| Screen-reader narration | automatic (hidden `aria-live` region) | Announces each step and any failure | built; **not tried with a screen reader** |
| Hosting | see below | Static site on Vercel behind Cloudflare | tested, 9/9 on the hosted copy |

### Not built / out of scope
- **Android results beyond a smoke test.** The emulator runs and dumps real screens, but only stock Settings with one intent and a stub model. No Android comparison of arms, no real model, no Instagram. Do not claim one.
- **Evasion of any protection.** Out of scope by design (plan 2.4). `protect` measures and reports only.

## Using a real model (and who supplies the key)
The semantic rung and every `--semantic anthropic` run need an Anthropic key. It is looked up in this order, and is
never printed, logged or committed (it is scrubbed from all output):
1. the environment variable `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY` for `--semantic openrouter`, then `agent/openrouter.key`)
2. the file named by `ANTHROPIC_API_KEY_FILE`
3. `Kenna/agent/anthropic.key` (git-ignored; one line, `#` comments allowed)

**A human:** open `Kenna/agent/anthropic.key` in your own editor and put the key on the line below the comments. Never paste it
into chat. Note this folder is inside OneDrive, which syncs the file to the cloud; if that is not acceptable keep the key
elsewhere and set `ANTHROPIC_API_KEY_FILE`.

**An AI agent that already has its own Anthropic key in its backend (for example Synthie): drive the app yourself.**
Do not ask the user for a key, do not read or create `anthropic.key`, do not write the key to any file, do not echo it.
Set `ANTHROPIC_API_KEY` in the environment of the process that runs the commands, then run the real-model test plan in
`NEXT_STEPS.md` section 1 yourself with `--semantic anthropic` (and `--semantic-cache` so each distinct prompt is paid for
once). State the model id and the call and token counts in every result, quote only these numbers as a language model's
(never `--semantic offline`), and report failures as they are. The model may only answer with indices into the on-screen
control list and is judged by the step's success check (AGENTS.md rule 6); do not widen that.

## Common flags
`--viewport 410x779` (default) - `--headed` - `--url <site>` (run against a hosted copy) - `--live` (real app, not the offline demo) - `--login` (sign in from the vault).

## Credentials (live app only)
```bash
node Kenna/agent/fyp.mjs vault set      # YOU run this; hidden prompt; stored encrypted for your Windows user
node Kenna/agent/fyp.mjs vault status   # shows a masked email, never the password
```
On Linux or for Momo use env vars `FYP_LOGIN_EMAIL` and `FYP_LOGIN_PASSWORD`. For a site behind Cloudflare
Access also set `FYP_CF_ACCESS_ID` and `FYP_CF_ACCESS_SECRET`. Never paste a password into chat or commit it.
Before sharing the live path publicly: rotate the password in `insta clone/liveConfig.ts` (it is in that repo's
history), and protect the site (Cloudflare Access) or disable sign-ups; the Firestore rules let any signed-in user write.

## Hosting
```bash
bash Kenna/fyp-mvp/make-site.sh                                          # builds Kenna/site/ (demo + harness)
cd Kenna/site && vercel deploy --prod --yes --name kenna-fyp             # redeploy
```
Run `make-site.sh` and redeploy after **any** change to `harness.js` or the demo, or the hosted copy goes stale.
Domain: DNS is on Cloudflare (registrar stays Spaceship); `insta.shariquebaig.com` points at Vercel.
Cloudflare checks and what each setting did are in the plan log (2026-10-28 protection measurements).
The app itself is a prebuilt bundle in `demo/`; rebuild only if `insta clone/` changed (`build-demo.sh`, then `sync-demo.sh`).

## Tests and the regression check
```bash
node Kenna/agent/nl.test.mjs          # language parser, no browser
node Kenna/agent/protect.test.mjs     # protection classifier, no browser
node Kenna/agent/semantic.test.mjs    # model bridge, no browser, no key
node Kenna/agent/report.test.mjs      # report maths + aggregation
python Kenna/path-b/android_layer.py selftest   # Android layer, no device
python Kenna/path-b/adb_capture.py selftest     # adb capture + parser, canned output, no device
node --check Kenna/fyp-mvp/harness.js
node Kenna/agent/fyp.mjs run                       # expect 9/9
node Kenna/agent/fyp.mjs run --breaks B1,B4        # expect 9/9
node Kenna/agent/fyp.mjs run --breaks B8           # expect an honest stop at step 1
```

## Where things are
| Path | What |
|---|---|
| `fyp-mvp/harness.js` | **The product** (intents, ladder, breaks, memory, teaching, agent API). Source of truth; the runner serves it live |
| `agent/fyp.mjs` | The command line. `nl.mjs` language, `vault.mjs` credentials, `protect.mjs` probe |
| `agent/routines/*.json` | Taught routines (no secrets, safe to commit) |
| `agent/teach.demo.mjs` | Plays the human to re-record `like.first` / `comment.first` |
| `agent/results/` | Experiment output (git-ignored: copy what you need for the report) |
| `agent/tool-manifest.json`, `agent/MOMO.md` | Tool schemas and assistant behaviour for Momo |
| `demo/`, `site/` | Prebuilt app bundle (generated, do not hand-edit), and the deployable site |
| `insta clone/` | App source, **a separate git repo**; holds `liveConfig.ts` (never copy it here) |
| `FYP_MVP_PLAN.md` | Decisions, taxonomy S1-S6, and the dated log of every result and limit |

## Known limits (say these before an examiner does)
- One mock app, one browser, one network, mostly single runs per setting: results are first evidence, not rates. Repeat N >= 10 before quoting percentages.
- Taught routines: one demonstration is one example; "the first of N" is stable, "number 7 of 15" is not; replay at the window size it was taught at.
- Position-based fallback is the weakest route by design.
- The web demo says nothing about Android (plan section 11.2 has the honest wording).
