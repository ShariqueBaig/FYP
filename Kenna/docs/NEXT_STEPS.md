# NEXT_STEPS - pick the project up from here (updated 2026-10-29, evening)

Read [`../README.md`](../README.md) for what exists, [`../../AGENTS.md`](../../AGENTS.md) for the rules, [`DEFENSE.md`](DEFENSE.md) for claims and evidence,
[`FYP_MVP_PLAN.md`](FYP_MVP_PLAN.md) section 15 (last entries) for the dated log. This file is only: **what is unfinished, and the exact commands to continue.**

## State in one paragraph
Web: rules ladder + `learned` + `semantic` (model) rungs, route memory that distils model answers, 11 breaks (B1-B11), five arms (`baseline`, `healed`,
`llm-only`, `model-verified`, `hybrid`), wrong/silent-wrong/planted-tap metrics, vision (screenshot with numbered badges), reports with 95% intervals.
**Measured:** the rules-only claim (C1) at N=10. **Real model:** `qwen/qwen3.7-flash` via OpenRouter on a paid balance; qualified on 3 hard web configs (n=1) and on
Android Settings including real drift (French: rules 2/10 -> hybrid 10/10). **Real-model protocol (`agent/run_protocol.sh`):** step 1 `semantic_n10` is DONE, valid and published (`results/published/semantic_n10_qwen37flash/`); `inject_n10`, the two vision steps and `learn` were still running at the last check and are NOT yet read or published. Android: `adb_capture.py`, `android_layer.py` and the live tests run on the `kenna` emulator against stock Settings only.

## Regression check (run after ANY harness change)
```bash
node --check Kenna/fyp-mvp/harness.js
node Kenna/agent/semantic.test.mjs && node Kenna/agent/report.test.mjs && node Kenna/agent/nl.test.mjs
python Kenna/path-b/android_layer.py selftest && python Kenna/path-b/adb_capture.py selftest && python Kenna/path-b/hierdump.py --selftest && python Kenna/path-b/report_android.py --selftest
node Kenna/agent/fyp.mjs run                      # 9/9
node Kenna/agent/fyp.mjs run --breaks B1,B4       # 9/9
node Kenna/agent/fyp.mjs run --breaks B8          # honest stop at step 1
python Kenna/tools/check_links.py                 # all markdown links and repo paths resolve
```

## 1. The real-model protocol (this is what settles claims C2-C5)
```bash
bash Kenna/agent/run_protocol.sh openrouter qwen/qwen3.7-flash
```
Resumable: every answer is cached (`agent/results/protocol/cache_*.json`), a step that hits a provider error stops with `valid: false` and a reason, and rerunning the
same command only repeats the gaps. Steps: `semantic_n10` (drift sets, 5 arms, N=10), `inject_n10` (B11 planted instructions, N=10), `vision_text_n5` and `vision_shot_n5`
(no words left; text vs screenshot with badges, N=5), then `learn` (does remembering cut model calls). Defaults: thinking tokens off (`FYP_SEMANTIC_REASONING=off`, about 5x faster and half
the cost in the qualification), no pacing (paid balance). Expected cost: a few cents (about $0.00007 per call with thinking off).

When a step finishes: read `agent/results/protocol/<step>_*/report.md`, check `valid: yes`, then publish what you cite:
`node Kenna/agent/report.mjs agent/results/protocol/<step>_qwen_qwen3_7-flash --publish <name>` (copy its `calls.jsonl` log in too, as the qualification folders do).
Then fill the rows in [`DEFENSE.md`](DEFENSE.md) (C2-C5) with the numbers and **delete the "go/no-go, n=1" wording only for rows that now have N >= 10**.

**Still to do here**
- A second model, so the result is not model-specific: `bash agent/run_protocol.sh openrouter <another-model-id>` (check price and image support at openrouter.ai/models first), or `anthropic` with a key.
- Read the llm-only arm fairly: with the real model it fails the hard web configs, but check it at N=10 before saying so. It has no confidence gate and no stop-on-failure by design (it is the "bare agent" comparison).
- Quote N and say that repetitions use temperature 0 and a cache (they measure app/harness variation, not model sampling variation).

**Keys and cost hygiene.** `agent/openrouter.key` is git-ignored but this folder is inside OneDrive (it syncs). Two OpenRouter keys were pasted in chat during development:
**revoke both at openrouter.ai when the project ends.** A key found in the environment wins over the file. An AI agent with its own key (for example Synthie) sets the variable itself and
never asks the user for one (README section 7).

## 2. Android (path-b)
### Setup on THIS laptop (done 2026-10-29; all on D:, outside OneDrive so 5.4 GB is not synced)
SDK at `D:\AndroidSdk` (cmdline-tools, platform-tools, emulator, `system-images;android-34;google_apis;x86_64`), virtual device `kenna` (Pixel 6, Android 34) in `D:\AndroidSdk\avd`.
The old C: SDK was left alone. Start (own terminal; first boot is slow, later boots about a minute):
```bash
ANDROID_SDK_ROOT=D:/AndroidSdk ANDROID_AVD_HOME=D:/AndroidSdk/avd D:/AndroidSdk/emulator/emulator.exe -avd kenna -no-snapshot-save -no-audio -gpu swiftshader_indirect
```
```bash
python Kenna/path-b/adb_capture.py devices        # expect emulator-5554  device
```
Stop: `D:/AndroidSdk/platform-tools/adb.exe emu kill`. Add `-no-window` to run headless.

**Lessons (each cost time):**
- `-window-scale` does not exist in this emulator version: the launch fails silently. Put a window on screen yourself; with Windows scaling at 125% the usable area is 1536 x 864, so about 340 x 760 at (1150, 10) fits.
- **Two `adb` versions kill each other's background server** (every call restarts it and can hang). The tools prefer `D:\AndroidSdk\platform-tools\adb.exe`; do not mix with the old C: copy.
- **A frozen guest** (every `adb shell` hangs, though `adb devices` still lists it) happens after repeated reboots or a language switch. Fix: kill `emulator`, `qemu-system-x86_64` and `adb`, delete `D:\AndroidSdk\avd\kenna.avd\*.lock`, relaunch with `-no-snapshot-load`.
- **Language persists in two places.** After a French run the UI stays French unless you clear `settings delete system system_locales` AND `setprop persist.sys.locale en-US`, then reboot. `live_drift.py` does this and verifies English **on screen** before and after every condition.
- `am start` alone re-fronts the last Settings page; force-stop Settings first (the tests do).
- Licences were copied from the existing C: SDK (already accepted); the first `sdkmanager` run hung at the emulator package, rerunning with `--verbose` to a log worked.

### What was run on the emulator (stock Settings only; NOT Instagram)
- `adb_capture.py` dumps work first time on Android 34 (`exec-out uiautomator dump /dev/tty`). **Coverage finding:** judged by the control's own attributes 78% look "anonymous"; once the labels of what is
  inside a clickable row count, **2% are nameless** (the way TalkBack names a row). `hierdump.py` reports both; quote the name-aware figure and say which you mean.
- Real row names are "title subtitle" ("Network & internet Mobile, Wi-Fi, hotspot"), so the text route also accepts a leading-title match (still unique-only). On Android 34 an empty field's placeholder is its `text`, not a `hint`.
- `live_suite.py` (stale hints = simulated drift) and `live_drift.py` (real drift: French, font 1.6) with the real model are published in `../results/published/android_qual_qwen37flash/`.

### Still to do on Android
1. **Scrolling.** With a large font two rows fall below the fold and no arm scrolls (8/10 for every arm). Add a scroll step to the layer (the accessibility tree says which container scrolls).
2. **More apps and intents,** more sessions (N >= 10 per cell), and a second Android image or an app update for drift that is not language or font.
3. **The project's own app on the emulator.** `insta clone/` is a React Native *web* app (reads `window.location`, `localStorage`, behind Firebase login): it cannot run natively without changes in that separate repo. The practical route is the web demo (`?demo=1`) in the emulator's Chrome; the tree Chrome exposes for web content is untested.
4. **A screenshot rung** for the 2% nameless controls on Android (the web version exists: `--semantic-shot`).
5. Do NOT point this at Instagram (login and bot protection: plan 2.4).

## 3. Known weaknesses (fix or report)
- **A later route can re-tap a control an earlier route already tapped** in the same step (no element-level de-duplication; verified in `runIntentCore`). A toggle could flip back. Fix AFTER the real-model protocol finishes (a mid-run harness change would mix versions in one evidence set): keep a set of controls already acted on in the step and skip them.
- The poster promises more than the repo (fingerprint stealth, touch telemetry, Daraz/OLX, "9/9 under UI chaos"): see `DEFENSE_PREP.md` section 0 and fix the poster before the defense.
- `gallery.select` picks a different photo each run, so a distilled locator is wrong the next time and the model is asked again (a floor of 1 model call per run).
- The recorded-script **baseline** makes about 1 silent wrong action per run even on the clean app: it re-clicks fixed controls and the app keeps state between runs (an already-selected photo, a toggle left on). That is a real failure of the baseline, not a bug; the healed arm avoids it through its checks.
- Predicates are hand-written. `fyp.mjs suggest <routine>` lets a model propose narrower checks (opt-in, stored beside the original); it has only been exercised with the stub.
- One mock web app plus stock Settings, one real model so far, no user study with screen-reader users, nothing on Instagram.
- B1+...+B7 together and anything with B8 stop honestly at step 1 by design (the control is unreachable); the plan log recorded this before the model work started.

## 4. Before the defense
Read [`DEFENSE_PREP.md`](DEFENSE_PREP.md); fix the three poster mismatches in its section 0; verify the `[M]` (not re-checked) product claims in its section 11.
Revoke the pasted keys; commit (nothing from the model work is committed yet; `git status` shows the moves as renames); run the regression check; rehearse the demo in [`DEFENSE.md`](DEFENSE.md)
and record a backup video of steps 1-3; open the emulator window on screen before presenting.

## 5. Files that matter
| file | what |
|---|---|
| `fyp-mvp/harness.js` | routes `learned`, `semantic`; `runLlmOnly`; `ARM_RUNNERS` incl. `model-verified`; breaks B9-B11; vision badges; `teachSuggest`; metrics |
| `agent/semantic.mjs` | model bridge: `offline` stub, `anthropic`, `openrouter`; cache, pacing, retry, fail-fast, per-decision log |
| `agent/report.mjs`, `agent/call_log_summary.mjs` | manifest + CI tables; audit of every model decision |
| `agent/run_protocol.sh`, `agent/qualify.sh`, `path-b/qualify_android.sh` | the protocol and the small fully logged go/no-go runs |
| `path-b/adb_capture.py`, `android_layer.py`, `live_*.py`, `report_android.py` | Android parser, layer, live tests, report |
| `results/published/` | committed evidence (see `../results/README.md`) |
| `tools/check_links.py` | link and path checker for the markdown |

## Rules that bind every change (AGENTS.md)
No secrets anywhere. Never quote stub numbers as a model's. A model may only answer with on-screen indices and is judged by the success check; irreversible intents need confidence >= 0.8.
No Android claim beyond what the emulator runs show. A report marked `valid: NO` is never quoted.
