#!/usr/bin/env python3
"""check_links.py - every relative markdown link in the project must point at something that exists.

    python Kenna/tools/check_links.py            exit 0 = all good, 1 = broken links listed

Scans every .md under Kenna/ and the repo-root AGENTS.md, skipping vendored and generated folders. Checks [text](target)
links (anchors and http(s)/mailto links are skipped), and ALSO the repo paths written in backticks that start with a known
top-level folder (agent/, path-b/, docs/ ...) so a moved file cannot leave a stale mention behind. Written after a
restructure that moved six documents, the posters and a tool: nothing should still point at the old locations.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
KENNA = os.path.dirname(HERE)
REPO = os.path.dirname(KENNA)
SKIP_DIRS = {"node_modules", ".git", "insta clone", "locator-inspector-plugin-v1.0.2", "_expo", "vendor", "__pycache__", ".vercel", ".freebuff"}
SKIP_PATH_PARTS = (os.sep + "results" + os.sep + "published" + os.sep, os.sep + "agent" + os.sep + "results" + os.sep, os.sep + "path-b" + os.sep + "results" + os.sep)
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
TICK = re.compile(r"`((?:Kenna/)?(?:agent|fyp-mvp|path-b|docs|assets|reference|results|tools|demo|site)/[A-Za-z0-9_./\-]+)`")
# paths that are legitimately described but not committed (generated, ignored, or examples)
OK_MISSING = ("agent/results", "path-b/results", "agent/anthropic.key", "agent/openrouter.key", "dumps/sessions", "agent/routines/<", "agent/.vault", "results/protection")


def md_files():
    out = [os.path.join(REPO, "AGENTS.md")]
    for root, dirs, files in os.walk(KENNA):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        if any(part in (root + os.sep) for part in SKIP_PATH_PARTS):
            continue
        out += [os.path.join(root, f) for f in files if f.endswith(".md")]
    return [f for f in out if os.path.exists(f)]


def main():
    bad = []
    for f in md_files():
        text = open(f, encoding="utf-8", errors="replace").read()
        base = os.path.dirname(f)
        for m in LINK.finditer(text):
            t = m.group(1).split("#")[0]
            if not t or re.match(r"^(https?:|mailto:)", t):
                continue
            if not os.path.exists(os.path.normpath(os.path.join(base, t))):
                bad.append((f, t, "link"))
        for m in TICK.finditer(text):
            t = m.group(1)
            if any(t.startswith(p) or p in t for p in OK_MISSING) or any(c in t for c in "*<>{}"):
                continue
            rel = t[len("Kenna/"):] if t.startswith("Kenna/") else t
            if not (os.path.exists(os.path.join(KENNA, rel)) or os.path.exists(os.path.join(REPO, t))):
                bad.append((f, t, "path in backticks"))
    for f, t, kind in bad:
        print("BROKEN %-18s %s -> %s" % (kind, os.path.relpath(f, REPO), t))
    print(("%d broken" % len(bad)) if bad else "all links and repo paths resolve (%d markdown files)" % len(md_files()))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
