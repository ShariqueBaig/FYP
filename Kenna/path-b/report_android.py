#!/usr/bin/env python3
"""report_android.py - turn live_suite / live_drift JSON into markdown tables with 95% Wilson intervals.

    python report_android.py results/suite_stub.json results/drift_stub.json [--out report_android.md]

Every number comes from the JSON the live runs wrote (their rows are the raw log). A run whose JSON says
"valid": false (model calls failed) is marked INVALID in its header, and a stub model is flagged as not a language model.
"""
import json
import math
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def wilson(k, n, z=1.96):
    if not n:
        return 0.0, 0.0, 0.0
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return p, max(0.0, c - h), min(1.0, c + h)


def ci(k, n):
    if not n:
        return "n/a"
    p, lo, hi = wilson(k, n)
    return f"{round(p * 100)}% [{round(lo * 100)}-{round(hi * 100)}]"


def header(d, title):
    L = [f"## {title}", ""]
    model = d.get("model", "none")
    L.append(f"- model: **{model}**   sessions: {d.get('sessions')}   valid: " + ("yes" if d.get("valid", True) else f"**NO** ({(d.get('model_errors') or {}).get('last', '')})"))
    if "STUB" in str(model):
        L.append("- **The model is the offline word-overlap STUB, not a language model. Do not quote these as a model result.**")
    L.append("")
    return L


def suite_md(d):
    L = header(d, "Android Settings suite (6 intents; 'stale' drift is SIMULATED on the intent side)")
    L += ["| arm | flows ok (95% CI) | wasted taps | silent wrong | model calls |", "|---|---|---|---|---|"]
    for arm, e in d["arms"].items():
        L.append(f"| {arm} | {e['ok']}/{e['total']} = {ci(e['ok'], e['total'])} | {e['wasted']} | {e['silent']} | {e['model_calls']} |")
    return L + [""]


def drift_md(d):
    L = header(d, "Android Settings REAL drift (system language / font scale; success judged by page identity, not words)")
    L += ["| condition | arm | intents ok (95% CI) | wasted taps | silent wrong | model calls |", "|---|---|---|---|---|---|"]
    for cond, arms in d["results"].items():
        for arm, e in arms.items():
            L.append(f"| {cond} | {arm} | {e['ok']}/{e['total']} = {ci(e['ok'], e['total'])} | {e['wasted']} | {e['silent']} | {e['model_calls']} |")
    return L + ["", "Units are single intents (one tap-level task) over sessions, not whole flows; sessions are repeated on one emulator image, so they show device/app variation only."]


def selftest():
    p, lo, hi = wilson(5, 10)
    ok = abs(lo - 0.2366) < 0.002 and abs(hi - 0.7634) < 0.002 and wilson(0, 0) == (0.0, 0.0, 0.0)
    print(("PASS" if ok else "FAIL") + "  wilson reference values")
    return 0 if ok else 1


def main(argv):
    if "--selftest" in argv:
        return selftest()
    files = [a for a in argv[1:] if a.endswith(".json")]
    if not files:
        print(__doc__)
        return 2
    out = ["# Android results", ""]
    for f in files:
        d = json.load(open(f, encoding="utf-8"))
        out += (suite_md(d) if "arms" in d else drift_md(d))
    text = "\n".join(out) + "\n"
    if "--out" in argv:
        path = argv[argv.index("--out") + 1]
        open(path, "w", encoding="utf-8").write(text)
        print("wrote", path)
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
