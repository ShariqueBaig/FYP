#!/usr/bin/env python3
"""live_demo.py - scripted demo scenes on the emulator (stock Settings), narrated through $FYP_EVENTS.

    python live_demo.py [--scenes 1,2,3] [--semantic offline|anthropic|openrouter] [--semantic-model id]

Normally started by dashboard.py (Run button, scenes ticked there); also works alone.
"""
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import adb_capture as ac  # noqa: E402
import android_layer as al  # noqa: E402

ADB = ac.find_adb() or "adb"
airplane = lambda ns: any("Airplane mode" in (n.text or n.name) for n in ns)  # noqa: E731
battery = lambda ns: any(("Battery Saver" in (n.text or n.name) or "Battery usage" in (n.text or n.name)) for n in ns)  # noqa: E731
teleporter = lambda ns: any("teleporter" in (n.text or n.name).lower() for n in ns)  # noqa: E731
NET = "Open the network and internet settings"

# id, short name, what it shows, expected outcome, needs a model, intent factory
SCENES = [
    dict(id=1, name="As taught", expect="success", model=False,
         say="The assistant was taught the row is called 'Network & internet'. The plain text way finds it.",
         intent=lambda: al.Intent("settings.network", NET, text="Network & internet", success=airplane)),
    dict(id=2, name="Words changed, model rescues", expect="success", model=True,
         say="The row is now called differently from what was taught. Rules cannot find it, so the model is asked and its pick is checked.",
         intent=lambda: al.Intent("settings.network", NET, text="Connectivity", success=airplane)),
    dict(id=3, name="Control not there, honest stop", expect="stop", model=False,
         say="Nothing on screen matches. The assistant must stop and say so, not tap something random.",
         intent=lambda: al.Intent("settings.teleporter", "Open the quantum teleporter settings", text="Quantum teleporter", success=teleporter)),
    dict(id=4, name="Another screen (Battery)", expect="success", model=False,
         say="A different goal on a different screen, found by its text.",
         intent=lambda: al.Intent("settings.battery", "Open the battery settings", text="Battery", success=battery)),
    dict(id=5, name="Words changed, no model", expect="stop", model=False,
         say="The same changed wording as scene 2, but with the model switched off: rules alone cannot read it, so it stops. This is why the model rung exists.",
         intent=lambda: al.Intent("settings.network", NET, text="Connectivity", success=airplane)),
]


def home():
    subprocess.run([ADB, "shell", "am", "force-stop", "com.android.settings"], capture_output=True)
    subprocess.run([ADB, "shell", "am", "start", "-a", "android.settings.SETTINGS"], capture_output=True)
    time.sleep(3)


def main(argv):
    sem, label = None, "none"
    if "--semantic" in argv:
        kind = argv[argv.index("--semantic") + 1]
        sem, label = al.make_semantic(kind, argv[argv.index("--semantic-model") + 1] if "--semantic-model" in argv else None)
    ids = [int(x) for x in argv[argv.index("--scenes") + 1].split(",") if x] if "--scenes" in argv else [s["id"] for s in SCENES]
    chosen = [s for s in SCENES if s["id"] in ids]
    al.emit("run-start", model=label, stub="STUB" in label, total=len(chosen))
    for k, s in enumerate(chosen, 1):
        al.emit("scene", n=k, total=len(chosen), id=s["id"], title=f"{s['id']} - {s['name']}", say=s["say"], expect=s["expect"])
        home()
        time.sleep(float(os.environ.get("FYP_PACE", "0")))
        al.Layer(al.AdbDriver(), sem if s["model"] else None).run_intent(s["intent"]())
    al.emit("run-end")


if __name__ == "__main__":
    main(sys.argv)
