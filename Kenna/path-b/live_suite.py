#!/usr/bin/env python3
"""live_suite.py - several real intents on stock Android Settings, N sessions each, four arms.

    PYTHONIOENCODING=utf-8 python live_suite.py --sessions 3 --semantic offline [--out results/suite]
    python live_suite.py --coverage 3            dump 5 screens x 3 sessions into dumps/sessions/ + coverage

Needs an emulator/phone attached (adb_capture.py devices). Arms, per intent per session (state is reset every
time: Settings is force-stopped and started on the page the intent needs):

    exact    rules only, hints that match this build                    -> the healthy case
    stale    rules only, hints written for a DIFFERENT copy of the app  -> SIMULATED copy drift
    hybrid   stale hints + the model rung                               -> rules, then a model, verified
    llm-only stale hints, model's first choice, nothing checked          -> a bare agent

The drift here is simulated on the INTENT side (the app's words are real, the intent was "taught" with other
words). That is a stand-in for an app update, not an app update. With --semantic offline the model is a
word-overlap stub, not a model: its misses (it cannot link "Navigate up" to "go back") say nothing about a
language model. Quote only --semantic anthropic numbers as a model's, with the model id.
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
import hierdump as hd  # noqa: E402

ADB = ac.find_adb() or "adb"
RUN = ac.default_runner(ADB)


def start(action):
    subprocess.run([ADB, "shell", "am", "force-stop", "com.android.settings"], capture_output=True)
    subprocess.run([ADB, "shell", "am", "start", "-a", action], capture_output=True)
    time.sleep(3)


def any_name(ns, *needles):
    low = [(n.text or n.name or n.desc).lower() for n in ns]
    return any(all(w.lower() in t for w in needles) for t in low)


def switch_state(ns, row_prefix):
    for n in ns:
        if n.name.startswith(row_prefix):
            for d in [n] + list(n.descendants()):
                if d.a("checkable") == "true":
                    return d.a("checked")
    return None


def make_cases():
    """(case id, start action, [(intent factory taking (arm) -> Intent)]) with exact and stale hints."""
    cases = []

    def nav(cid, action, goal, exact, stale, success, kind="text"):
        def mk(arm):
            h = exact if arm == "exact" else stale
            return al.Intent(cid, goal, success=success, **{("text" if kind == "text" else "content_desc"): h})
        cases.append((cid, action, [mk]))

    nav("settings.network", "android.settings.SETTINGS", "Open the network and internet settings", "Network & internet", "Connectivity", lambda ns: any_name(ns, "airplane mode"))
    nav("settings.sound", "android.settings.SETTINGS", "Open the sound and vibration settings", "Sound & vibration", "Audio", lambda ns: any_name(ns, "media volume"))
    nav("settings.apps", "android.settings.SETTINGS", "Open the apps settings", "Apps", "Applications", lambda ns: any_name(ns, "all apps"))
    def net_open(arm):
        h = "Network & internet" if arm == "exact" else "Connectivity"
        return al.Intent("back.open", "Open the network and internet settings", text=h, success=lambda ns: any_name(ns, "airplane mode"))

    def go_back(arm):
        h = "Navigate up" if arm == "exact" else "Return"
        return al.Intent("back.up", "Go back to the main settings list", content_desc=h,
                         success=lambda ns: any_name(ns, "sound & vibration") and not any_name(ns, "airplane mode"))
    cases.append(("back.flow", "android.settings.SETTINGS", [net_open, go_back]))

    state = {}

    def dark(arm):
        # The row ("Dark theme Will never turn on...") AND its switch (desc "Dark theme") both carry the words,
        # so a text hint is ambiguous and the ladder refuses to guess; an author who knows picks the switch's desc.
        kw = {"content_desc": "Dark theme"} if arm == "exact" else {"text": "Night mode"}
        return al.Intent("display.dark", "Turn dark theme on", **kw,
                         capture=lambda ns: state.__setitem__("before", switch_state(ns, "Dark theme")),
                         success=lambda ns: switch_state(ns, "Dark theme") not in (None, state.get("before")))
    cases.append(("display.dark", "android.settings.DISPLAY_SETTINGS", [dark]))

    def search_open(arm):
        h = "Search settings" if arm == "exact" else "Find"
        return al.Intent("search.open", "Open the settings search", text=h,
                         success=lambda ns: any(n.cls.endswith("EditText") for n in ns))

    def search_type(arm):
        # Android 34 exposes an empty field's placeholder as its `text` (no `hint` attribute in the dump).
        h = "Search settings" if arm == "exact" else "Find"
        return al.Intent("search.type", "Type wifi into the search box", action="type", text=h, value="wifi",
                         success=lambda ns: any(n.cls.endswith("EditText") and n.text == "wifi" for n in ns))
    cases.append(("search.flow", "android.settings.SETTINGS", [search_open, search_type]))
    return cases


ARMS = ("exact", "stale", "hybrid", "llm-only")


def run_arm(arm, factory_list, sem):
    drv = al.AdbDriver()
    ly = al.Layer(drv, sem if arm in ("hybrid", "llm-only") else None)
    rows = []
    for mk in factory_list:
        it = mk("exact" if arm == "exact" else "stale")
        r = ly.run_llm_only(it) if arm == "llm-only" else ly.run_intent(it)
        rows.append(r)
        if r.outcome != "success" and arm != "llm-only":
            break
    return rows


def dump_sessions(n):
    os.makedirs("dumps/sessions", exist_ok=True)
    pages = [("home", "android.settings.SETTINGS"), ("wifi", "android.settings.WIFI_SETTINGS"), ("sound", "android.settings.SOUND_SETTINGS"),
             ("display", "android.settings.DISPLAY_SETTINGS"), ("apps", "android.settings.APPLICATION_SETTINGS")]
    for s in range(1, n + 1):
        for name, action in pages:
            start(action)
            d = ac.settled(RUN)
            with open(f"dumps/sessions/{name}_s{s}.xml", "w", encoding="utf-8") as fh:
                fh.write(d.xml)
    rows = [hd.coverage_report(f, hd.load("dumps/sessions/" + f)) for f in sorted(os.listdir("dumps/sessions")) if f.endswith(".xml")]
    hd.print_coverage(rows)
    # hook stability: is the same control found by the same rid/desc/name in every session?
    by_page = {}
    for f in sorted(os.listdir("dumps/sessions")):
        page = f.rsplit("_s", 1)[0]
        nodes = hd.load("dumps/sessions/" + f)
        by_page.setdefault(page, []).append({(n.rid, n.desc, n.name) for n in nodes if n.actionable})
    print("\ncontrol identity across sessions (same rid+desc+name in every session):")
    for page, sets in by_page.items():
        common = set.intersection(*sets)
        union = set.union(*sets)
        print(f"  {page:8s} stable {len(common)}/{len(union)}  ({100 * len(common) // max(1, len(union))}%)")


def main(argv):
    if "--coverage" in argv:
        dump_sessions(int(argv[argv.index("--coverage") + 1]))
        return 0
    n = int(argv[argv.index("--sessions") + 1]) if "--sessions" in argv else 3
    sem, model = None, "none"
    if "--semantic" in argv:
        kind = argv[argv.index("--semantic") + 1]
        sem = al.offline_semantic if kind == "offline" else al.anthropic_semantic()
        model = "offline-lexical STUB" if kind == "offline" else os.environ.get("FYP_SEMANTIC_MODEL", "claude-haiku-5-5")
    arms = [a for a in ARMS if sem or a in ("exact", "stale")]
    res = {a: {"ok": 0, "total": 0, "wasted": 0, "model_calls": 0, "silent": 0, "rows": []} for a in arms}
    for session in range(1, n + 1):
        for cid, action, facts in make_cases():
            for arm in arms:
                start(action)
                rows = run_arm(arm, facts, sem)
                total = len(facts)
                ok = len(rows) == total and all(r.outcome == "success" for r in rows)
                e = res[arm]
                e["ok"] += ok
                e["total"] += 1
                e["wasted"] += sum(r.failed_actions for r in rows)
                e["model_calls"] += sum(r.semantic_calls for r in rows)
                e["silent"] += sum(1 for r in rows if r.outcome == "failed-silent")
                e["rows"].append({"session": session, "case": cid, "ok": ok, "routes": [r.route for r in rows], "outcomes": [r.outcome for r in rows]})
                print(f"session {session} {cid:17s} {arm:9s} {'OK ' if ok else 'FAIL'} {[r.route for r in rows]}", flush=True)
    print(f"\nmodel: {model}   sessions: {n}   cases: {len(make_cases())}   (drift in 'stale' is SIMULATED on the intent side)")
    print(f"{'arm':9s} {'flows ok':>9s} {'wasted taps':>12s} {'silent wrong':>13s} {'model calls':>12s}")
    for a in arms:
        e = res[a]
        print(f"{a:9s} {e['ok']:>4d}/{e['total']:<4d} {e['wasted']:>12d} {e['silent']:>13d} {e['model_calls']:>12d}")
    if "--out" in argv:
        out = argv[argv.index("--out") + 1]
        os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
        with open(out + ".json", "w", encoding="utf-8") as fh:
            json.dump({"model": model, "sessions": n, "arms": res, "note": "stale-hint drift is simulated on the intent side; stub model is not a language model"}, fh, indent=2)
        print("saved", out + ".json")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
