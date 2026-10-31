#!/usr/bin/env python3
"""Writes tables_generated.tex for main.tex from the PUBLISHED results (results/published/*), so no number in the
report is typed by hand. A table whose experiment is not published yet becomes a visible PENDING box, and a table
produced by an older harness than the current one carries a note saying so. Run: python build_tables.py
"""
import csv, hashlib, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
PUB = os.path.join(ROOT, "results", "published")
HARNESS = hashlib.sha256(open(os.path.join(ROOT, "fyp-mvp", "harness.js"), "rb").read()).hexdigest()


def tex(s):
    return (str(s).replace("\\", "\\textbackslash{}").replace("&", "\\&").replace("%", "\\%").replace("_", "\\_")
            .replace("#", "\\#").replace("+", "{+}"))


def load(name):
    d = os.path.join(PUB, name)
    f = os.path.join(d, "report.csv")
    if not os.path.exists(f):
        return None, None
    rows = list(csv.DictReader(open(f, encoding="utf8")))
    man = {}
    try:
        man = json.load(open(os.path.join(d, "manifest.json"), encoding="utf8"))
    except Exception:
        pass
    ok = bool(man.get("valid", True))
    stale = bool(man.get("harnessSha256")) and man["harnessSha256"] != HARNESS
    return ({"rows": rows, "valid": ok, "stale": stale, "man": man}), name


def cell(rows, cfg, arm, key="completed"):
    for r in rows:
        if r["config"] == cfg and r["arm"] == arm:
            return r
    return None


def pending(what, how):
    return ("\\begin{center}\\fbox{\\parbox{0.9\\textwidth}{\\textbf{PENDING.} %s Not yet published: %s "
            "The text of the report does not quote a number for it.}}\\end{center}\n" % (what, how))


def stale_note(d):
    if d is None or not d["stale"]:
        return ""
    return ("\\par\\smallskip\\noindent\\textit{Note: produced by an earlier version of the harness (hash %s) than the current one; "
            "a re-run on the current harness is in progress.}\n" % d["man"]["harnessSha256"][:8])


def flows_table(d, configs, arms, label, caption, labels=None, extra=None):
    if d is None:
        return pending("Experiment `%s`." % label, "it is produced by the real-model protocol.")
    n = d["rows"][0]["flows"]
    head = " & ".join(["Configuration"] + [tex(a[1]) for a in arms])
    out = ["\\begin{table}[ht]\\centering\\small",
           "\\begin{tabular}{l" + "c" * len(arms) + "}\\toprule", head + " \\\\ \\midrule"]
    for cfg in configs:
        cells = []
        for a in arms:
            r = cell(d["rows"], cfg, a[0])
            cells.append("--" if r is None else "%s/%s" % (r["completed"], r["flows"]))
        out.append(tex((labels or {}).get(cfg, cfg)) + " & " + " & ".join(cells) + " \\\\")
    out += ["\\bottomrule\\end{tabular}", "\\caption{%s Each cell is flows completed out of %s; 95\\%% Wilson intervals are in the published \\texttt{report.csv}.}" % (caption, n),
            "\\label{%s}" % label.replace(" ", ""), "\\end{table}", stale_note(d)]
    if not d["valid"]:
        out.insert(0, "\\textbf{INVALID RUN: not to be quoted.}")
    return "\n".join(out) + "\n"


ARMS5 = [("baseline", "Recorded script"), ("healed", "Rules ladder"), ("llm-only", "Bare model"), ("model-verified", "Model + check"), ("hybrid", "Full system")]
parts = []

# ---- rules only
d, _ = load("rules_full_n10")
cfgs = ["clean", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B1+B2+B3+B4", "B1+B2+B3+B4+B5+B6+B7", "B1+B2+B3+B4+B5+B6+B7+B8"]
lab = {"B1+B2+B3+B4": "B1--B4 together", "B1+B2+B3+B4+B5+B6+B7": "B1--B7 together", "B1+B2+B3+B4+B5+B6+B7+B8": "B1--B8 together"}
t = flows_table(d, cfgs, ARMS5[:2], "tab:rules", "Rules only, no model: recorded script against the rules ladder.", lab)
parts.append("\\newcommand{\\TabRules}{%s}" % t)

# ---- semantic
d, _ = load("semantic_n10_qwen37flash")
cfgs = ["clean", "B9", "B1+B9", "B1+B10+B9", "B1+B10+B2+B9"]
parts.append("\\newcommand{\\TabSemantic}{%s}" % flows_table(d, cfgs, ARMS5, "tab:semantic",
             "Drift the rules cannot read (B9 reword, B10 relocate, B2 labels stripped, B1 ids renamed), model qwen3.7-flash."))

# ---- inject
d, _ = load("inject_n10_qwen37flash")
parts.append("\\newcommand{\\TabInject}{%s}" % flows_table(d, ["B11", "B9+B11", "B1+B10+B9+B11"], [a for a in ARMS5 if a[0] != "baseline"], "tab:inject",
             "Planted instructions in labels (B11), alone and on top of other changes, model qwen3.7-flash.") if d else
             "\\newcommand{\\TabInject}{%s}" % pending("Planted-instruction experiment (set \\texttt{inject}, N=10).", "the re-run on the corrected harness is in progress."))

# ---- vision
for tag, name, what in (("Text", "vision_text_n5_qwen37flash", "text only"), ("Shot", "vision_shot_n5_qwen37flash", "screenshot with numbered badges")):
    d, _ = load(name)
    arms = [a for a in ARMS5 if a[0] in ("healed", "llm-only", "hybrid")]
    parts.append("\\newcommand{\\TabVision%s}{%s}" % (tag, flows_table(d, ["clean", "B1+B2+B6", "B1+B10+B2+B6"], arms, "tab:vision" + tag.lower(),
                 "No words left on the target (B1, B2, B6, with B10), model given %s." % what)
                 if d else pending("Vision experiment, %s (N=5)." % what, "the re-run on the corrected harness is in progress.")))

# ---- android
md = os.path.join(PUB, "android_qual_qwen37flash", "report_android.md")
rows = []
if os.path.exists(md):
    sec = False
    for line in open(md, encoding="utf8"):
        if "REAL drift" in line:
            sec = True
        m = re.match(r"\|\s*(en|fr|font)\s*\|\s*(rules|hybrid|llm-only)\s*\|\s*(\d+/\d+)", line)
        if sec and m:
            rows.append(m.groups())
if rows:
    arms = ["rules", "hybrid", "llm-only"]
    names = {"en": "English", "fr": "French", "font": "Font scale 1.6"}
    out = ["\\begin{table}[ht]\\centering\\small\\begin{tabular}{lccc}\\toprule",
           "Condition & Rules only & Rules + model + check & Bare model \\\\ \\midrule"]
    for c in ("en", "fr", "font"):
        v = {a: next((x[2] for x in rows if x[0] == c and x[1] == a), "--") for a in arms}
        out.append("%s & %s & %s & %s \\\\" % (names[c], v["rules"], v["hybrid"], v["llm-only"]))
    out += ["\\bottomrule\\end{tabular}",
            "\\caption{Android Settings, real drift (system language and font scale), intents completed; stock Settings on the \\texttt{kenna} emulator, model qwen3.7-flash. Units are single intents over sessions.}",
            "\\label{tab:android}\\end{table}"]
    parts.append("\\newcommand{\\TabAndroid}{%s}" % "\n".join(out))
else:
    parts.append("\\newcommand{\\TabAndroid}{%s}" % pending("Android real-drift experiment.", "run live_drift.py and publish with report_android.py."))

# ---- learn (route memory)
lj = None
for cand in (os.path.join(PUB, "learn_qwen37flash", "learn.json"), os.path.join(ROOT, "agent", "results", "protocol", "learn_qwen_qwen3_7-flash", "learn.json")):
    if os.path.exists(cand):
        lj = json.load(open(cand, encoding="utf8")); src = cand; break
if lj and lj.get("valid"):
    s = lj["summary"]; ad = s["afterDrift"]; rs = s["runsToSettle"]
    names = {"plain": "Rules only", "memory": "Rules + memory", "semantic": "Model, no memory", "semantic+memory": "Model + memory"}
    out = ["\\begin{table}[ht]\\centering\\small\\begin{tabular}{lcccc}\\toprule",
           "Arm & Failed actions/run & Model calls/run & Full flows & Runs to settle \\\\ \\midrule"]
    for k in ("plain", "memory", "semantic", "semantic+memory"):
        out.append("%s & %s & %s & %s & %s \\\\" % (names[k], ad[k]["meanFailedActions"], ad[k]["meanModelCalls"], ad[k]["fullFlows"], rs[k] if rs[k] is not None else "did not settle"))
    out += ["\\bottomrule\\end{tabular}",
            "\\caption{Route memory after the UI changes (B1, B9, B10 at run %s of %s): means over the runs after the change. Model calls per run with memory: %s.}" % (lj["driftAt"], lj["runs"], ", ".join(str(x) for x in s["modelCallsPerRun"]["semantic+memory"])),
            "\\label{tab:learn}\\end{table}"]
    parts.append("\\newcommand{\\TabLearn}{%s}" % "\n".join(out))
else:
    parts.append("\\newcommand{\\TabLearn}{%s}" % pending("Route-memory experiment.", "the re-run is in progress."))

open(os.path.join(HERE, "tables_generated.tex"), "w", encoding="utf8").write("% generated by build_tables.py: do not edit\n" + "\n".join(parts) + "\n")
print("wrote tables_generated.tex; harness", HARNESS[:8])
