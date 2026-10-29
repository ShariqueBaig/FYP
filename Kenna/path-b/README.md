# path-b/ - Android (accessibility tree)

The same idea as the web harness, over the XML that `adb shell uiautomator dump` returns. Everything here has run against canned or synthetic trees,
and the live pieces have run on the `kenna` emulator (Android 34, SDK at `D:\AndroidSdk`) against **stock Settings only**. Not Instagram.

| file | what it is |
|---|---|
| `adb_capture.py` | **the adb parser**: find adb, list devices, dump (retries a transient "null root node", falls back from `/dev/tty`, flags a secure window as *suppressed*), settle, tap/type/key; `selftest` |
| `android_layer.py` | the intent/route ladder (`resource-id`, `content-desc`, `text`, `scoped`, `learned`, `semantic`, `geometry`), the model rung, the model-only arm, `AdbDriver`; `selftest` on a synthetic app |
| `hierdump.py` | offline analyser: coverage (how many controls have a usable hook, **name-aware**: own text or a child label), ladder per control, drift; `--selftest` |
| `live_smoke.py` | one real intent on Settings, exact vs reworded hint |
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
`python path-b/dashboard.py` then open <http://127.0.0.1:8765> and press **Run demo**: the emulator screen with the control being looked at / tapped,
the ladder lighting up, what the model was asked and answered, the check after every tap, a score and a log. Three scripted scenes
(`live_demo.py`: as taught, words changed -> model asked and verified, control absent -> honest stop). Any run with `FYP_EVENTS=<file>` set
writes the same events (`android_layer.emit`); `FYP_PACE=<seconds>` slows it for an audience. The offline model is labelled STUB on screen.
`start_emulator.ps1` does a clean emulator start and centres the window.
