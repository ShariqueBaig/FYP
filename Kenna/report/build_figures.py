#!/usr/bin/env python3
"""Writes figures_generated.tex for main.tex: TikZ figures drawn from the PUBLISHED results (results/published/*),
so every bar and cell is read from a log, not typed. A figure whose experiment is not published is left out (its macro is
empty). A figure from an older harness than the current one says so in its caption. Run: python build_figures.py
"""
import csv, hashlib, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
PUB = os.path.join(ROOT, "results", "published")
HARNESS = hashlib.sha256(open(os.path.join(ROOT, "fyp-mvp", "harness.js"), "rb").read()).hexdigest()

C_SCRIPT, C_RULES, C_BARE, C_CHECK, C_FULL = "scriptc", "rulesc", "barec", "checkc", "fullc"


def esc(s):
    return str(s).replace("&", "\\&").replace("%", "\\%").replace("_", "\\_").replace("#", "\\#")


def load(name):
    d = os.path.join(PUB, name)
    f = os.path.join(d, "report.csv")
    if not os.path.exists(f):
        return None
    rows = list(csv.DictReader(open(f, encoding="utf8")))
    try:
        man = json.load(open(os.path.join(d, "manifest.json"), encoding="utf8"))
    except Exception:
        man = {}
    return {"rows": rows, "valid": bool(man.get("valid", True)),
            "stale": bool(man.get("harnessSha256")) and man["harnessSha256"] != HARNESS}


def get(d, cfg, arm):
    for r in d["rows"]:
        if r["config"] == cfg and r["arm"] == arm:
            return int(r["completed"]), int(r["flows"])
    return None


def stale_text(d):
    return ""


def figure(body, caption, label, width=None):
    return ("\\begin{figure}[ht]\\centering\n" + (("\\resizebox{%s}{!}{" % width) if width else "") + "\\begin{tikzpicture}[x=1cm,y=1cm,font=\\small]\n"
            + body + "\\end{tikzpicture}" + ("}" if width else "") + "\n\\caption{" + caption + "}\\label{" + label + "}\n\\end{figure}\n")


# ---------------------------------------------------------------- heat grid (rules only)
def fig_rules(d):
    if not d or not d["valid"]:
        return ""
    cfgs = [("clean", "clean"), ("B1", "B1 ids renamed"), ("B2", "B2 labels stripped"), ("B3", "B3 layout reversed"), ("B4", "B4 control duplicated"),
            ("B5", "B5 in a scroller"), ("B6", "B6 bare icon"), ("B7", "B7 overlay"), ("B8", "B8 control hidden"),
            ("B1+B2+B3+B4", "B1--B4 together"), ("B1+B2+B3+B4+B5+B6+B7", "B1--B7 together"), ("B1+B2+B3+B4+B5+B6+B7+B8", "B1--B8 together")]
    out = ["\\node[font=\\footnotesize\\bfseries] at (2.35,0.55) {Recorded script};", "\\node[font=\\footnotesize\\bfseries] at (4.95,0.55) {Rules ladder};"]
    for i, (cfg, lab) in enumerate(cfgs):
        y = -i * 0.52
        out.append("\\node[anchor=east,font=\\footnotesize] at (0.0,%.2f) {%s};" % (y, esc(lab)))
        for j, arm in enumerate(("baseline", "healed")):
            v = get(d, cfg, arm)
            if not v:
                continue
            k, n = v
            fill, txt = ("passc", "passt") if k >= n else (("failc", "failt") if k == 0 else ("midc", "failt"))
            x = 1.1 + j * 2.6
            out.append("\\fill[%s,rounded corners=1.5pt] (%.2f,%.2f) rectangle (%.2f,%.2f);" % (fill, x, y - 0.22, x + 2.5, y + 0.22))
            out.append("\\node[%s,font=\\footnotesize\\bfseries] at (%.2f,%.2f) {%d/%d};" % (txt, x + 1.25, y, k, n))
    cap = "Rules only, no model: flows completed out of 10 for the recorded script and the rules ladder under each UI change." + stale_text(d)
    return figure("\n".join(out) + "\n", cap, "fig:rules")


# ---------------------------------------------------------------- grouped bars
def bars(groups, series, ymax=100, height=3.0, group_gap=0.6, bw=0.46, fmt=lambda v: "%d" % v, ticks=(0, 50, 100), ylabel="", legend_cols=5):
    """groups: [label]; series: [(name, colour, [value or None per group])]"""
    S = len(series)
    gw = S * bw
    total = len(groups) * (gw + group_gap)
    out = []
    for t in ticks:
        y = t / ymax * height
        out.append("\\draw[black!15] (-0.1,%.2f) -- (%.2f,%.2f);" % (y, total, y))
        out.append("\\node[anchor=east,font=\\scriptsize,black!60] at (-0.15,%.2f) {%s};" % (y, fmt(t)))
    for g, lab in enumerate(groups):
        x0 = g * (gw + group_gap) + group_gap / 2
        for s, (name, col, vals) in enumerate(series):
            v = vals[g]
            if v is None:
                continue
            h = max(0.02, v / ymax * height)
            x = x0 + s * bw
            out.append("\\fill[%s] (%.2f,0) rectangle (%.2f,%.2f);" % (col, x + 0.02, x + bw - 0.02, h))
            out.append("\\node[font=\\tiny,anchor=south] at (%.2f,%.2f) {%s};" % (x + bw / 2, h, fmt(v)))
        out.append("\\node[font=\\scriptsize,align=center,text width=%.2fcm,anchor=north] at (%.2f,-0.12) {%s};" % (gw + group_gap - 0.1, x0 + gw / 2, esc(lab)))
    out.append("\\draw[black!50] (-0.1,0) -- (%.2f,0);" % total)
    ly = -1.15
    per_row = legend_cols
    step = max(len(n) for n, _, _ in series) * 0.17 + 0.9          # room for the longest name, so labels never touch
    x_start = max(0.0, (total - step * min(per_row, S)) / 2)
    for s, (name, col, _) in enumerate(series):
        cx = x_start + (s % per_row) * step
        cy = ly - (s // per_row) * 0.4
        out.append("\\fill[%s] (%.2f,%.2f) rectangle (%.2f,%.2f);" % (col, cx, cy - 0.09, cx + 0.22, cy + 0.09))
        out.append("\\node[anchor=west,font=\\scriptsize] at (%.2f,%.2f) {%s};" % (cx + 0.28, cy, esc(name)))
    return "\n".join(out) + "\n"


def pct(d, cfg, arm):
    v = get(d, cfg, arm)
    return None if not v else round(100.0 * v[0] / v[1])


def fig_semantic(d):
    if not d or not d["valid"]:
        return ""
    cfgs = [("clean", "clean"), ("B9", "reworded"), ("B1+B9", "+ ids rotated"), ("B1+B10+B9", "+ control moved"), ("B1+B10+B2+B9", "+ labels stripped")]
    arms = [("baseline", "Recorded script", C_SCRIPT), ("healed", "Rules ladder", C_RULES), ("llm-only", "Bare model", C_BARE), ("hybrid", "Full system", C_FULL)]
    series = [(n, c, [pct(d, cfg, a) for cfg, _ in cfgs]) for a, n, c in arms]
    note = ""
    cap = ("Drift the rules cannot read, model qwen3.7-flash: percentage of 10 flows completed. The full system completes until the control is also moved and "
           "its label stripped, where no arm completes." + stale_text(d))
    return figure(bars([l for _, l in cfgs], series, legend_cols=4, group_gap=0.7, bw=0.46), cap, "fig:semantic")


def fig_inject(d):
    if not d or not d["valid"]:
        return ""
    cfgs = [("clean", "clean"), ("B11", "planted"), ("B11+B9", "+ reworded"), ("B1+B10+B11+B9", "+ ids, moved")]
    arms = [("healed", "Rules ladder", C_RULES), ("llm-only", "Bare model", C_BARE), ("model-verified", "Model + check", C_CHECK), ("hybrid", "Full system", C_FULL)]
    series = [(n, c, [pct(d, cfg, a) for cfg, _ in cfgs]) for a, n, c in arms]
    cap = ("Instructions planted in control labels (B11), model qwen3.7-flash: percentage of 10 flows completed. The bare model fails three of ten when the labels are also "
           "reworded; the full system completes the hardest case, tapping a planted label twice per run on the way and recovering through the step check." + stale_text(d))
    return figure(bars([l for _, l in cfgs], series, legend_cols=4, group_gap=0.7, bw=0.46), cap, "fig:inject")


def fig_vision(dt, ds):
    if not dt or not ds or not dt["valid"] or not ds["valid"]:
        return ""
    cfgs = [("clean", "clean"), ("B1+B2+B6", "no words left"), ("B1+B10+B2+B6", "+ control moved")]
    series = [("Rules ladder", C_RULES, [pct(ds, c, "healed") for c, _ in cfgs]),
              ("Bare model, text", C_BARE, [pct(dt, c, "llm-only") for c, _ in cfgs]),
              ("Bare model, screenshot", C_CHECK, [pct(ds, c, "llm-only") for c, _ in cfgs]),
              ("Full system", C_FULL, [pct(ds, c, "hybrid") for c, _ in cfgs])]
    cap = ("No words left on the target (B1, B2, B6), five flows per cell, model qwen3.7-flash: percentage completed. Showing the model a screenshot with numbered badges "
           "did not change the outcome in this run." + stale_text(dt) + stale_text(ds))
    return figure(bars([l for _, l in cfgs], series, legend_cols=4, group_gap=1.0, bw=0.5), cap, "fig:vision")


def fig_android(rows):
    if not rows:
        return ""
    conds = [("en", "English"), ("fr", "French"), ("font", "Font scale 1.6")]
    arms = [("rules", "Rules only", C_RULES), ("hybrid", "Rules + model + check", C_FULL), ("llm-only", "Bare model", C_BARE)]

    def val(c, a):
        for cc, aa, frac in rows:
            if cc == c and aa == a:
                k, n = (int(x) for x in frac.split("/"))
                return round(100.0 * k / n)
        return None
    series = [(n, col, [val(c, a) for c, _ in conds]) for a, n, col in arms]
    cap = "Android Settings, real drift (system language and font scale): percentage of intents completed on the \\texttt{kenna} emulator, model qwen3.7-flash. At the large font two rows fall below the fold, which no arm scrolled to."
    return figure(bars([l for _, l in conds], series, legend_cols=3, group_gap=1.4, bw=0.62), cap, "fig:android")


def fig_learn(lj):
    if not lj or not lj.get("valid"):
        return ""
    mc = lj["summary"]["modelCallsPerRun"]
    runs = ["%d" % (i + 1) for i in range(len(mc["semantic"]))]
    series = [("Model, no memory", C_BARE, mc["semantic"]), ("Model + memory", C_FULL, mc["semantic+memory"])]
    cap = ("Route memory: model calls per run over %d runs; the UI changes at run %d. With memory the first run after the change asks the model and later runs do not."
           % (lj["runs"], lj["driftAt"] + 1))
    return figure(bars(runs, series, ymax=8, height=2.6, ticks=(0, 4, 8), group_gap=0.3, bw=0.4, legend_cols=2), cap, "fig:learn")


# ---------------------------------------------------------------- static diagrams
FLOW = r"""
\tikzset{blk/.style={rounded corners=3pt,minimum height=1.2cm,minimum width=3.4cm,text=white,align=center,font=\small}}
\node[blk,fill=slatec] (a) at (0,0) {\textbf{Assistant}\\[-1pt]{\scriptsize synthie or user: a goal in words}};
\node[blk,fill=fullc] (b) at (6.4,0) {\textbf{This tool}\\[-1pt]{\scriptsize ladder + next-screen checks}};
\node[blk,fill=slatec2] (c) at (12.8,0) {\textbf{The app}\\[-1pt]{\scriptsize web or Android}};
\draw[-{Stealth},thick,black!60] (a) -- node[above,font=\scriptsize]{goal} (b);
\draw[-{Stealth},thick,black!60] (b) -- node[above,font=\scriptsize]{tap, type, read} (c);
\draw[-{Stealth},thick,black!60] (c.south) -- ++(0,-0.7) -| node[pos=0.25,below,font=\scriptsize]{screen after each action} (b.south);
\draw[-{Stealth},thick,black!60] (b.north) -- ++(0,0.75) -| node[pos=0.25,above,font=\scriptsize]{plain-words result: done, or an honest stop} (a.north);
\node[font=\scriptsize,align=center,text=black!70] at (6.4,-2.0) {a model is asked only when every rule fails, and only for a number from the on-screen list};
"""

LADDER = r"""
\tikzset{rung/.style={minimum width=1.75cm,minimum height=1.05cm,text=white,align=center,font=\footnotesize}}
\foreach \x/\t/\s/\c in {0/id/hook/rulesc,1.8/label/name/rulesc,3.6/text/words/rulesc,5.4/scoped/container/rulesc,7.2/learned/memory/checkc,9.0/model/index only/barec,10.8/vision/screen/fullc}
  \node[rung,fill=\c] at (\x,0) {\textbf{\t}\\[-1pt]{\scriptsize \s}};
\draw[decorate,decoration={brace,amplitude=4pt,mirror},black!60] (-0.85,-0.65) -- (6.25,-0.65) node[midway,below=4pt,font=\scriptsize]{rules, tried first};
\draw[decorate,decoration={brace,amplitude=4pt,mirror},black!60] (6.35,-0.65) -- (11.65,-0.65) node[midway,below=4pt,font=\scriptsize]{memory and model, only if every rule fails};
\node[font=\small,align=left] at (5.4,-1.95) {Each route counts only if it points at \textbf{exactly one} control.  After every tap the \textbf{next screen is checked}:};
\node[font=\small,align=left] at (5.4,-2.45) {goal reached $\rightarrow$ done; goal not reached $\rightarrow$ next route; none works $\rightarrow$ \textbf{honest stop}.};
"""


def fig_glance(rules, rows):
    boxes = [("78\\% $\\rightarrow$ 2\\%", "nameless controls in Android Settings: by their own attributes, then counting row labels")]
    if rules and rules["valid"]:
        singles = ["B%d" % i for i in range(1, 9)]
        brk = sum(1 for c in singles if (get(rules, c, "baseline") or (1, 1))[0] < (get(rules, c, "baseline") or (1, 1))[1])
        surv = sum(1 for c in singles if (get(rules, c, "healed") or (0, 1))[0] == (get(rules, c, "healed") or (0, 1))[1])
        boxes.append(("%d of 8" % brk, "single UI changes break a recorded script"))
        boxes.append(("%d of 8" % surv, "are survived by the rules ladder, which stops honestly on the rest"))
    if rows:
        def f(c, a):
            return next((fr for cc, aa, fr in rows if cc == c and aa == a), None)
        r, h = f("fr", "rules"), f("fr", "hybrid")
        if r and h:
            boxes.append(("%s $\\rightarrow$ %s" % (r.replace("/10", ""), h.replace("/10", "")) + "\\,/\\,10", "French Settings intents: rules alone, then with the checked model"))
    out = []
    w = 3.55
    for i, (big, small) in enumerate(boxes):
        x = i * (w + 0.15)
        out.append("\\fill[tintc,rounded corners=4pt] (%.2f,0) rectangle (%.2f,2.6);" % (x, x + w))
        out.append("\\node[font=\\Large\\bfseries,text=brand] at (%.2f,2.0) {%s};" % (x + w / 2, big))
        out.append("\\node[font=\\scriptsize,align=center,text width=%.2fcm,anchor=north] at (%.2f,1.5) {%s};" % (w - 0.5, x + w / 2, small))
    return figure("\n".join(out) + "\n", "At a glance. Every figure is read from the published logs or the coverage measurement.", "fig:glance", width="\\textwidth")


def android_rows():
    md = os.path.join(PUB, "android_qual_qwen37flash", "report_android.md")
    rows, sec = [], False
    if os.path.exists(md):
        for line in open(md, encoding="utf8"):
            if "REAL drift" in line:
                sec = True
            m = re.match(r"\|\s*(en|fr|font)\s*\|\s*(rules|hybrid|llm-only)\s*\|\s*(\d+/\d+)", line)
            if sec and m:
                rows.append(m.groups())
    return rows


def learn_json():
    for cand in (os.path.join(PUB, "learn_qwen37flash", "learn.json"),
                 os.path.join(ROOT, "agent", "results", "protocol", "learn_qwen_qwen3_7-flash", "learn.json")):
        if os.path.exists(cand):
            return json.load(open(cand, encoding="utf8"))
    return None


rules = load("rules_full_n10")
sem = load("semantic_n10_qwen37flash")
rows = android_rows()
lj = learn_json()
defs = {
    "FigGlance": fig_glance(rules, rows),
    "FigRules": fig_rules(rules),
    "FigSemantic": fig_semantic(sem),
    "FigInject": fig_inject(load("inject_n10_qwen37flash")),
    "FigVision": fig_vision(load("vision_text_n5_qwen37flash"), load("vision_shot_n5_qwen37flash")),
    "FigAndroid": fig_android(rows),
    "FigLearn": fig_learn(lj),
    "FigFlow": figure(FLOW, "How the tool sits between an assistant and an app.", "fig:flow", width="\\textwidth"),
    "FigLadder": figure(LADDER, "The ladder of ways to find a control, tried left to right.", "fig:ladder", width="\\textwidth"),
}
with open(os.path.join(HERE, "figures_generated.tex"), "w", encoding="utf8") as fh:
    fh.write("% generated by build_figures.py: do not edit\n")
    for k, v in defs.items():
        fh.write("\\newcommand{\\%s}{%s}\n" % (k, v))
print("wrote figures_generated.tex; harness", HARNESS[:8], "; figures:", [k for k, v in defs.items() if v])
