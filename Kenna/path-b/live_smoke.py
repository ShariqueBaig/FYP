#!/usr/bin/env python3
"""live_smoke.py - first real-device intents through android_layer on the stock Settings app.

    PYTHONIOENCODING=utf-8 python live_smoke.py [--semantic offline|anthropic]

Needs one device/emulator attached (adb_capture.py devices). Each case restarts Settings, runs ONE intent
through the ladder and prints which route won, wasted taps and model calls. With --semantic offline the
model is a word-overlap stand-in, NOT a model: a wrong pick there says nothing about a language model.
"""
import subprocess
import sys
import time

sys.path.insert(0, ".")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import adb_capture as ac  # noqa: E402
import android_layer as al  # noqa: E402

ADB = ac.find_adb() or "adb"


def home():
    # am start alone re-fronts whatever page Settings was last on; force-stop gives every case the same start.
    subprocess.run([ADB, "shell", "am", "force-stop", "com.android.settings"], capture_output=True)
    subprocess.run([ADB, "shell", "am", "start", "-a", "android.settings.SETTINGS"], capture_output=True)
    time.sleep(3)


airplane = lambda ns: any("Airplane mode" in (n.text or n.name) for n in ns)  # noqa: E731


def run(label, intent, sem=None):
    home()
    r = al.Layer(al.AdbDriver(), sem).run_intent(intent)
    print(f"{label:38s} outcome={r.outcome:14s} route={r.route:12s} wasted={r.failed_actions} model_calls={r.semantic_calls}")
    print("   ", r.detail[:160])


def main(argv):
    sem = None
    if "--semantic" in argv:
        kind = argv[argv.index("--semantic") + 1]
        sem = al.offline_semantic if kind == "offline" else al.anthropic_semantic()
    goal = "Open the network and internet settings"
    run("rules, exact title", al.Intent("settings.network", goal, text="Network & internet", success=airplane))
    run("rules, reworded hint (drift)", al.Intent("settings.network", goal, text="Connectivity", success=airplane))
    if sem:
        run("rules + model, reworded hint", al.Intent("settings.network", goal, text="Connectivity", success=airplane), sem)


if __name__ == "__main__":
    main(sys.argv)
