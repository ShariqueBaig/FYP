#!/usr/bin/env python3
"""live_drift.py - REAL drift on the emulator: the same Settings build, with its words or layout changed by the system.

    PYTHONIOENCODING=utf-8 python live_drift.py [--conditions en,fr,font] [--sessions 2] [--semantic offline|anthropic] [--out results/drift]

Unlike live_suite.py (stale hints written into the intent), here the APP changes underneath unchanged intents:
    en     the healthy case (English hints match)
    fr     system language -> French: every Settings label is re-translated (a real copy change)
    font   font scale 1.6: bigger text re-flows the list, some rows move below the fold (a real layout change)

Success is judged LANGUAGE-INDEPENDENTLY: an oracle learned on the English build maps each intent to the activity
that must be in the foreground afterwards, so a wrong-row tap cannot pass because the words changed.

Arms: rules (exact English hints) | hybrid (rules + model) | llm-only (model's first choice, nothing checked).
The condition is ALWAYS restored (language, font scale) in a finally block. With --semantic offline the model is an
English-only word-overlap stub: expect it to fail in French. That is the stub's limit, not a language model's.
"""
import json
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import adb_capture as ac  # noqa: E402
import android_layer as al  # noqa: E402

ADB = ac.find_adb() or "adb"
RUN = ac.default_runner(ADB)
HOME_ACT = "SettingsHomepageActivity"

# (id, English row title, English goal)
ROWS = [
    ("network", "Network & internet", "Open the network and internet settings"),
    ("devices", "Connected devices", "Open the connected devices settings"),
    ("apps", "Apps", "Open the apps settings"),
    ("notifications", "Notifications", "Open the notification settings"),
    ("battery", "Battery", "Open the battery settings"),
    ("storage", "Storage", "Open the storage settings"),
    ("sound", "Sound & vibration", "Open the sound and vibration settings"),
]


def adb(*a):
    return subprocess.run([ADB] + list(a), capture_output=True, text=True, timeout=120)


def start_home():
    adb("shell", "am", "force-stop", "com.android.settings")
    adb("shell", "am", "start", "-a", "android.settings.SETTINGS")
    time.sleep(3)


def fg():
    return ac.foreground(RUN)


def learn_oracle():
    """On the healthy English build: which activity does each row open? (language-independent ground truth)"""
    oracle = {}
    for cid, title, goal in ROWS:
        start_home()
        d = ac.settled(RUN)
        hits = [n for n in d.controls if n.name == title or n.name.startswith(title + " ")]
        if len(hits) != 1:
            print(f"  oracle: '{title}' not uniquely on screen ({len(hits)}), skipped")
            continue
        ac.tap(RUN, *hits[0].center)
        time.sleep(2.5)
        act = fg().split("/")[-1]
        if HOME_ACT not in act and act:
            oracle[cid] = act
    return oracle


def set_condition(c):
    if c == "fr":
        adb("root"); time.sleep(2)
        adb("shell", "setprop", "persist.sys.locale", "fr-FR")
        adb("shell", "setprop", "ctl.restart", "zygote")
        time.sleep(25)
    elif c == "font":
        adb("shell", "settings", "put", "system", "font_scale", "1.6")
        time.sleep(2)


def restore():
    adb("root"); time.sleep(2)
    adb("shell", "setprop", "persist.sys.locale", "en-US")
    adb("shell", "settings", "put", "system", "font_scale", "1.0")
    adb("shell", "setprop", "ctl.restart", "zygote")
    time.sleep(25)


def locale_now():
    return (adb("shell", "getprop", "persist.sys.locale").stdout or "").strip() or (adb("shell", "getprop", "ro.product.locale").stdout or "").strip()


def wait_boot():
    for _ in range(60):
        if (adb("shell", "getprop", "sys.boot_completed").stdout or "").strip() == "1":
            return True
        time.sleep(2)
    return False


def main(argv):
    conds = (argv[argv.index("--conditions") + 1] if "--conditions" in argv else "en,fr,font").split(",")
    n = int(argv[argv.index("--sessions") + 1]) if "--sessions" in argv else 2
    sem, model = None, "none"
    if "--semantic" in argv:
        kind = argv[argv.index("--semantic") + 1]
        sem = al.offline_semantic if kind == "offline" else al.anthropic_semantic()
        model = "offline-lexical STUB (English only)" if kind == "offline" else os.environ.get("FYP_SEMANTIC_MODEL", "claude-haiku-5-5")
    print("learning the oracle on the English build ...", flush=True)
    oracle = learn_oracle()
    print("oracle:", json.dumps(oracle), flush=True)
    arms = ["rules"] + (["hybrid", "llm-only"] if sem else [])
    results = {}
    try:
        for cond in conds:
            if cond != "en":
                set_condition(cond)
                wait_boot()
                print(f"[{cond}] applied; locale={locale_now()}", flush=True)
            res = {a: {"ok": 0, "total": 0, "wasted": 0, "silent": 0, "model_calls": 0} for a in arms}
            for session in range(1, n + 1):
                for cid, title, goal in ROWS:
                    if cid not in oracle:
                        continue
                    want = oracle[cid]
                    success = lambda ns, want=want: want in fg()          # noqa: E731
                    for arm in arms:
                        start_home()
                        it = al.Intent("drift." + cid, goal, text=title, success=success)
                        ly = al.Layer(al.AdbDriver(), sem if arm != "rules" else None)
                        r = ly.run_llm_only(it) if arm == "llm-only" else ly.run_intent(it)
                        e = res[arm]
                        e["total"] += 1
                        e["ok"] += r.outcome == "success"
                        e["wasted"] += r.failed_actions
                        e["silent"] += r.outcome == "failed-silent"
                        e["model_calls"] += r.semantic_calls
                        print(f"[{cond}] s{session} {cid:13s} {arm:8s} {r.outcome:14s} {r.route}", flush=True)
            results[cond] = res
    finally:
        if any(c != "en" for c in conds):
            restore()
            wait_boot()
            print("restored: locale=%s font_scale=1.0" % locale_now(), flush=True)
    print(f"\nmodel: {model}   sessions: {n}   intents/session: {len(oracle)}")
    print(f"{'cond':6s} {'arm':9s} {'ok':>8s} {'wasted':>7s} {'silent':>7s} {'calls':>6s}")
    for cond, res in results.items():
        for a, e in res.items():
            print(f"{cond:6s} {a:9s} {e['ok']:>3d}/{e['total']:<4d} {e['wasted']:>7d} {e['silent']:>7d} {e['model_calls']:>6d}")
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
        os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
        with open(out + ".json", "w", encoding="utf-8") as fh:
            json.dump({"model": model, "sessions": n, "oracle": oracle, "results": results}, fh, indent=2)
        print("saved", out + ".json")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
