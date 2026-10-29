# path-b/ - Android (accessibility tree)

The same idea as the web harness, over the XML that `adb shell uiautomator dump` returns. Everything here has run against canned or synthetic trees,
and the live pieces have run on the `kenna` emulator (Android 34, SDK at `D:\AndroidSdk`) against **stock Settings only**. Not Instagram.

| file | what it is |
|---|---|
| `adb_capture.py` | **the adb parser**: find adb, list devices, dump (retries a transient "null root node", falls back from `/dev/tty`, flags a secure window as *suppressed*), settle, tap/type/key; `selftest` |
| `android_layer.py` | the intent/route ladder (`resource-id`, `content-desc`, `text`, `scoped`, `learned`, `semantic`, `geometry`), the model rung, the model-only arm, `AdbDriver`; `selftest` on a synthetic app |
| `hierdump.py` | offline analyser: coverage (how many controls have a usable hook, **name-aware**: own text or a child label), ladder per control, drift; `--selftest` |
| `live_smoke.py` | one real intent on Settings, exact vs reworded hint |
| `dashboard.py`, `dashboard.html` | **live demo dashboard** (zero dependencies, port 8765): see the section below |
| `live_demo.py` | the five selectable demo scenes the dashboard runs (also runnable alone, `--scenes 1,2,3`) |
| `start_emulator.ps1` | clean emulator start for a demo: kills stale processes, removes locks, boots fresh, **software rendering by default**, centres the window |
| `live_suite.py` | 6 intents x N sessions x 4 arms (`exact`, `stale` = simulated drift, `hybrid`, `llm-only`); `--coverage N` dumps 5 screens x N sessions |
| `live_drift.py` | **real drift**: system language French / font scale 1.6 on the same build; success judged by page identity (fragment name), not words; restores and verifies English afterwards |
| `qualify_android.sh` | the Android half of a model qualification, fully logged |
| `report_android.py` | markdown tables with 95% Wilson intervals from the suite/drift JSON |
| `dumps/` | real UiAutomator dumps (launcher, Settings pages; `dumps/sessions/` = 5 screens x 3 sessions) used for the coverage numbers |
| `results/` | earlier **stub-model** Android runs and the coverage log (tracked, labelled STUB: plumbing evidence only). Real-model runs live under `../agent/results/qualification/` and are published to `../results/published/` |
| `live_dumper.py`, `intent_route_layer.py`, `GUIDE.md` | the **old scaffold** and an earlier draft (kept for history; `live_dumper.py` parses but needs Appium; do not build on them) |

Start the emulator, then `python path-b/adb_capture.py devices` must show one `device`; see [`../docs/NEXT_STEPS.md`](../docs/NEXT_STEPS.md) section 3b for the commands and the recovery steps
(a frozen guest is fixed by a cold boot with `-no-snapshot-load`; use the D: copy of adb, two adb versions kill each other's server).

## Live dashboard (for demos)
```bash
powershell -ExecutionPolicy Bypass -File Kenna\path-b\start_emulator.ps1    # emulator up, window centred
python Kenna/path-b/dashboard.py                                            # then open http://127.0.0.1:8765
```
What it shows while the agent works on the emulator: the phone screen (live, a small JPEG of `adb screencap`) with a box on the control being looked at or tapped; the
seven-way **ladder** numbered 1-7 and lighting up in the order tried; a plain-words **"Now"** card (what is being searched for, how many controls are on screen,
what each way found, what the model was asked and answered, the check after each tap, with a step list); a result banner; a per-run score; the published evidence
figures (labelled as not from this run); a log. Every section collapses (remembered in the browser).

* **Choose tests:** five scenes (`live_demo.py`): 1 as taught, 2 words changed (model rescues), 3 control absent (honest stop), 4 another screen (Battery), 5 words changed with
  no model (stops). Tick any subset, **Run selected**. Each shows its *expected* result, and **the expectation follows the model menu**: with *No model*, scene 2 is expected to stop.
  "as expected" is scored per scene.
* **Model menu:** No model / offline stand-in / OpenRouter / Anthropic. The offline stand-in is **word matching, not an AI** and is labelled that way everywhere
  (header badge, ladder box, result banner). A scene that only passes because of the stand-in says so. Quote real-model behaviour only from an OpenRouter/Anthropic run.
* **Pause / Resume / Stop** (the run holds at its next step; the pause is a flag file read by `android_layer.emit`). One run at a time.
* **How it works:** any run with `FYP_EVENTS=<file>` set appends JSON lines (`android_layer.emit`: `scene`, `intent-start`, `route`, `model-ask`/`answer`, `act`, `check`,
  `intent-end`, `paused`/`resumed`); `dashboard.py` serves the page, `/events?since=N` (byte offset; resets when a new run truncates the file), `/screen.png`, `/scenes`,
  `/start`, `/pause`, `/resume`, `/stop`. `FYP_PACE=<seconds>` slows the run for an audience (Speed menu). No change to routing or scoring: emitting is a no-op without the variable.
* Not covered: the web harness (it has its own panel), and a real-model run was not exercised through the dashboard on 2026-10-29 (offline stand-in only).

**Emulator rendering.** `start_emulator.ps1` defaults to `-gpu swiftshader_indirect`. With `-gpu host` the AMD driver reset (emulator log: *A device attached to the system is not
functioning*, Vulkan ColorBuffer allocation failures) and took down the emulator **and Edge** (`msedge.exe` exception 0xe0000008). Use `-Gpu host` only if it proves stable.
