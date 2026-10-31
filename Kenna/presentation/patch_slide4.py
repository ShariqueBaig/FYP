#!/usr/bin/env python3
"""Fill the three ISECOM bullets (and the speaker note) on slide 4 of an existing deck IN PLACE,
leaving every other edit in the file untouched. Usage: python patch_slide4.py deck.pptx [out.pptx]
Without out.pptx the deck is rewritten in place (close it in PowerPoint first)."""
import re, shutil, sys, zipfile, os, tempfile

SRC = sys.argv[1]
DST = sys.argv[2] if len(sys.argv) > 2 else SRC

REPL = {
    "Who they are: [one line, confirm wording with the team]":
        "Who they are: open security research community behind the OSSTMM (2001) and Hacker Highschool",
    "Our collaboration: [what ISECOM provides or uses]":
        "Our collaboration: a brief from a synthie's real automation, with Pete Herzog (ISECOM board)",
    "What it means for this work: [e.g. a real agent consumer]":
        "What it means: a live testbed with real failures, such as locator rot and a blocked posting pipeline",
}
NOTE_OLD = re.compile(r"2:00\. Fill the ISECOM bullets[^<]*")
NOTE_NEW = ("2:00. ISECOM (Institute for Security and Open Methodologies) is an open security research community: it began in January 2001 with the free OSSTMM, "
            "was co-founded in New York and Barcelona, and also runs certifications and Hacker Highschool (isecom.org, hackerhighschool.org). "
            "Pete Herzog is listed on its board. The problem brief came from Kenna, a synthie, about its Android/Instagram automation: locator rot, a 50% like-button success rate, "
            "and a posting pipeline blocked since June 2026. Scope note: the brief also lists behavioural-fingerprint survival; we measure protection behaviour but do not build evasion. "
            "The synthie description comes from one instance's own account; say so if asked.")

def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pptx", dir=os.path.dirname(os.path.abspath(DST)))
tmp.close()
hits = 0
with zipfile.ZipFile(SRC) as zin, zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename.startswith(("ppt/slides/slide", "ppt/notesSlides/notesSlide")) and item.filename.endswith(".xml"):
            s = data.decode("utf8")
            for old, new in REPL.items():
                if esc(old) in s:
                    s = s.replace(esc(old), esc(new)); hits += 1
            if NOTE_OLD.search(s):
                s = NOTE_OLD.sub(esc(NOTE_NEW).replace("\\", "\\\\"), s); hits += 1
            data = s.encode("utf8")
        zout.writestr(item, data)
if hits == 0:
    os.unlink(tmp.name); sys.exit("nothing to patch: the placeholder text was not found (already filled?)")
shutil.move(tmp.name, DST)
print(f"patched {hits} text runs -> {DST}")
