# NEXT_STEPS - pick the project up from here (written 2026-10-29)

Read `README.md` for what exists, `AGENTS.md` for the rules, `FYP_MVP_PLAN.md` section 15 (last entry) for results.
This file is only: **what is unfinished, and the exact commands to continue.**

## State in one paragraph
Web side: rules ladder + `learned` + `semantic` (model) rungs, route memory that distils model answers, breaks B1-B10,
arms baseline / healed / llm-only / hybrid, wrong-action and silent-wrong metrics. **No real model has ever been run**
(no API key was set); every semantic number so far is from `--semantic offline`, a word-overlap stub. Android side:
`path-b/android_layer.py` works on synthetic dumps; `AdbDriver` has never touched a device.

## Regression check (run after ANY harness change)
```bash
node --check Kenna/fyp-mvp/harness.js
node Kenna/agent/semantic.test.mjs && node Kenna/agent/nl.test.mjs
python Kenna/path-b/android_layer.py selftest && python Kenna/path-b/adb_capture.py selftest && python Kenna/path-b/hierdump.py --selftest
node Kenna/agent/fyp.mjs run                      # 9/9
node Kenna/agent/fyp.mjs run --breaks B1,B4       # 9/9
node Kenna/agent/fyp.mjs run --breaks B8          # honest stop at step 1
```

## 1. Redo the web results with a REAL model (highest priority - nothing is claimable until this)
Set the key in YOUR terminal (never in chat, a file or the repo):
```powershell
$env:ANTHROPIC_API_KEY = "<your key>"      # PowerShell; session only
```
Then (the cache means each distinct prompt is paid for once; re-runs are free):
```bash
node Kenna/agent/fyp.mjs experiment --n 5 --set semantic --arms baseline,healed,llm-only,hybrid \
  --semantic anthropic --semantic-cache Kenna/agent/results/semantic/cache.json --out Kenna/agent/results/semantic/real
node Kenna/agent/fyp.mjs learn --semantic anthropic --semantic-cache Kenna/agent/results/semantic/cache.json \
  --runs 8 --drift-at 2 --breaks B1,B9,B10 --out Kenna/agent/results/semantic/real-learn
```
Model id: `--semantic-model <id>` or `FYP_SEMANTIC_MODEL` (default `claude-haiku-5-5`). State the id in the report.
Try `--semantic-shot` (sends a screenshot of the mock app; privacy: only ever on the demo app) and compare.
Quote N >= 5 and say so; the stub run was n=2.

## 2. Known weaknesses to fix or report
- B10's moved control is partly covered by the gallery grid, so `compose.next` goes through the keyboard route and `runsToSettle` stays null. Decide: fix B10 (raise z-index / pointer-events) or report it.
- `gallery.select` picks a different photo each run, so the distilled locator is wrong and the model is asked again (1 call/run floor).
- `llm-only` fails even on the clean app with the stub; with a real model re-check - this arm is the main comparison and must be fair (see `runLlmOnly`, no confidence gate by design).
- Silent-wrong for `baseline` is measured post hoc (`effectSeen`); check why it is 1.0 on the clean app (probably `gallery.select` on the already-selected cell).
- No screenshot/vision rung yet: when no control has any readable word (B1+B2+B9+B10) everything stops honestly.
- Predicates are hand-written (item 3 of the plan: infer them from a demonstration) - not started.

## 3. Android (path-b) - see 3b for the live setup and results
Order: capture real dumps -> parse -> measure coverage (hierdump) -> run the layer with `AdbDriver` -> compare arms.
`android_layer.py`: `python path-b/android_layer.py resolve DUMP.xml '{"id":"x","desc":"Open settings","text":"Settings"}' --semantic offline`.

## 3b. Android on THIS laptop - DONE and first live results (2026-10-29)
**Setup (all on D:, outside OneDrive so 5.4 GB is not synced):** SDK at `D:\AndroidSdk` (cmdline-tools, platform-tools, emulator,
`system-images;android-34;google_apis;x86_64`), AVD `kenna` (Pixel 6, Android 34) in `D:\AndroidSdk\avd`. The C: SDK was left alone.
Licences were copied from the existing C: SDK (already accepted by the user). The first `sdkmanager` run hung ~26 min at the
emulator package; killing it and rerunning with `--verbose` to a log worked (`D:\AndroidSdk\sdk-install.log`).

Start / stop the emulator (own terminal; first boot is slow):
```bash
ANDROID_SDK_ROOT=D:/AndroidSdk ANDROID_AVD_HOME=D:/AndroidSdk/avd D:/AndroidSdk/emulator/emulator.exe -avd kenna -no-snapshot-save -no-audio -gpu swiftshader_indirect
```
```bash
python Kenna/path-b/adb_capture.py devices        # expect emulator-5554  device
```
Stop it with `D:/AndroidSdk/platform-tools/adb.exe emu kill`. Add `-no-window` to run headless.

**What was run on the real emulator (stock apps only: launcher + Settings; NOT Instagram):**
- `adb_capture.py dump` works first time on Android 34 (`exec-out uiautomator dump /dev/tty` is fine): launcher 34 nodes / 14 controls, Settings 66 / 9. Five real dumps are in `path-b/dumps/` (home, settings, wifi, sound, apps).
- **Finding 1 (parser artifact, fixed).** `coverage` first said 59% of controls were "anonymous". All 28 of those got their name from a child label (the way TalkBack names a clickable row). Added `Node.name` (own text/desc, else non-clickable descendants' words) and split the report: own-attribute anonymous 59%, of which named by a child 55%, **NAMELESS 4%** (2 of 49). Quote the name-aware figure, and say which you mean.
- **Finding 2.** Real row names are "title subtitle" ("Network & internet Mobile, Wi-Fi, hotspot"): the text route also accepts a leading-title match (still unique-only).
- **Finding 3.** Text contains non-ASCII (non-breaking hyphen in "Wi-Fi") and crashed printing on a Windows console; the CLIs now print UTF-8.
- **Finding 4 (test hygiene).** `am start` re-fronts the last Settings page; a reused state made one case look broken. `live_smoke.py` force-stops Settings first. Any real-device test needs an explicit reset.
- `python path-b/live_smoke.py --semantic offline`, one intent ("open network & internet"): rules with the exact title -> success on the `text` route, 0 wasted taps; rules with a reworded hint ("Connectivity") -> honest stop, 0 wasted taps; rules + model (offline STAND-IN) -> success on `semantic[0]`, 1 model call. n = 1 each, one app, one emulator, and the model is a stub: plumbing evidence, not a result.

**Still to do on Android:**
1. A real model on the device: `python path-b/live_smoke.py --semantic anthropic` (key in your terminal env). Compare to the stub.
2. More intents and screens (back, search, toggle a setting), several sessions each; re-run `coverage` per app build for half-life.
3. The project's own Expo app on the emulator (an Android build of `insta clone`) instead of only stock apps; then the same 4 arms as the web experiment (rules / hybrid / llm-only / baseline) with real drift. Real drift on stock Settings is not available; a second Android version/image or an app update is the way.
4. Screenshots as a rung for the 4% nameless controls (not built).
5. Do NOT point this at Instagram yet (login + bot protection: plan 2.4).

## 4. Files that matter (this round)
| file | what |
|---|---|
| `fyp-mvp/harness.js` | routes `learned`, `semantic`; `runLlmOnly`; B9, B10; arms in `ARM_RUNNERS`; `wrongOf` metrics |
| `agent/semantic.mjs` + `semantic.test.mjs` | model bridge: offline stub, anthropic provider, disk cache, flags |
| `agent/fyp.mjs` | `--semantic`, `--semantic-model`, `--semantic-cache`, `--semantic-shot`, `--arms`, `learn --semantic` |
| `agent/results/semantic/` | stub results (experiment, learn): plumbing evidence only |
| `path-b/android_layer.py` | Android ladder + model rung + `AdbDriver` (untested) + synthetic selftest |
| `path-b/adb_capture.py` | adb capture + parser: devices, dump (retry, fallback, suppressed-window flag, settle), tap/type/key helpers; selftest on canned output **and run live on the emulator (dumps work)** |
| `path-b/live_smoke.py` | first real intents on stock Settings through `android_layer`; `--semantic offline|anthropic` |
| `path-b/dumps/` | five real UiAutomator dumps (launcher + Settings) from the `kenna` emulator |

## Rules that bind every change (AGENTS.md)
No secrets anywhere. Never quote stub numbers as a model's. A model may only answer with on-screen indices and is judged by
the success check; irreversible intents need confidence >= 0.8. No Android claim without a device/emulator run.
