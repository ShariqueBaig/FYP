#!/usr/bin/env python3
"""
hierdump.py - offline analyzer for Android accessibility-tree dumps.

Path B ("accessibility tree first, screenshot fallback where suppressed") lives
or dies on one question: how many of the controls you must drive actually carry
a usable hook in the accessibility tree? This tool answers that from saved
dumps, with no device attached, so you can measure before you build.

A "dump" is the XML that Appium's UiAutomator2 driver returns as
`driver.page_source` (or `adb shell uiautomator dump`). Save one file per
screen per session; this reads them all.

    python3 hierdump.py coverage dumps/            # week-1 go/no-go measurement
    python3 hierdump.py rungs dumps/compose.xml    # locator ladder per control
    python3 hierdump.py drift dumps/s1.xml dumps/s9.xml
    python3 hierdump.py --selftest                 # no files needed

No third-party packages. Verification here is against the saved tree; the same
predicates are re-checked live by the driver at run time.
"""

from __future__ import annotations

import os
import re
import sys
import glob
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Tree model
# ---------------------------------------------------------------------------

BOUNDS_RE = re.compile(r"\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]")


@dataclass
class Node:
    attrs: dict
    path: tuple            # child-index path from the hierarchy root, e.g. (0, 2, 1)
    xpath: str             # class-indexed absolute xpath, the last-resort rung
    parent: "Node | None" = None
    children: list = field(default_factory=list)

    # -- attribute access ---------------------------------------------------
    def a(self, name: str) -> str:
        return (self.attrs.get(name) or "").strip()

    @property
    def rid(self) -> str:
        return self.a("resource-id")

    @property
    def desc(self) -> str:
        return self.a("content-desc")

    @property
    def text(self) -> str:
        return self.a("text")

    @property
    def cls(self) -> str:
        return self.a("class")

    @property
    def scrollable(self) -> bool:
        return self.a("scrollable") == "true"

    @property
    def clickable(self) -> bool:
        return self.a("clickable") == "true"

    @property
    def displayed(self) -> bool:
        # Appium emits this only with allowInvisibleElements enabled; absent means
        # "assume visible" rather than "assume hidden".
        return self.a("displayed") in ("", "true")

    @property
    def bounds(self):
        m = BOUNDS_RE.search(self.a("bounds"))
        return tuple(int(g) for g in m.groups()) if m else (0, 0, 0, 0)

    @property
    def center(self):
        x1, y1, x2, y2 = self.bounds
        return ((x1 + x2) // 2, (y1 + y2) // 2)

    @property
    def onscreen(self) -> bool:
        """Zero-area or wholly off-screen boxes cannot be tapped."""
        x1, y1, x2, y2 = self.bounds
        return x2 > x1 and y2 > y1 and x2 > 0 and y2 > 0

    def ancestors(self):
        n = self.parent
        while n is not None:
            yield n
            n = n.parent

    def descendants(self):
        for c in self.children:
            yield c
            yield from c.descendants()

    # -- what counts as a control ------------------------------------------
    @property
    def actionable(self) -> bool:
        """A node a test could plausibly have to act on.

        `clickable` is the honest signal: Android marks a view clickable when it
        handles touch. Nodes that carry text but are not clickable are usually
        labels *inside* a clickable card, so they are not controls - their
        ancestor is - and counting them would flatter the coverage numbers.
        """
        return self.clickable or self.a("long-clickable") == "true" or self.a("checkable") == "true"

    def label(self) -> str:
        return self.desc or self.text or self.rid.split("/")[-1] or self.cls.split(".")[-1]

    @property
    def name(self) -> str:
        """The accessible name a screen reader would speak: the control's own content-desc /
        text, else the words of its non-clickable descendants (how TalkBack names a clickable
        row or card). Measured live on stock Android Settings: every control with no own
        text/desc was named this way, so judging a control by its own attributes alone
        overstates how anonymous it is."""
        own = self.desc or self.text
        if own:
            return own
        return " ".join((d.desc or d.text) for d in self.descendants()
                        if (d.desc or d.text) and not d.clickable).strip()

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<{self.cls.split('.')[-1]} rid={self.rid!r} desc={self.desc!r} text={self.text!r}>"


def parse(xml_text: str) -> list:
    """Parse a hierarchy dump into a flat list of Nodes (document order)."""
    root = ET.fromstring(xml_text.strip())
    flat = []

    def walk(elem, path, parent, cls_counts):
        cls = elem.get("class") or ""
        # class-indexed position among same-class siblings, for an absolute xpath
        pos = cls_counts.get(cls, 0) + 1
        cls_counts[cls] = pos
        seg = f"{cls}[{pos}]" if cls else "*"
        xpath = (parent.xpath.rstrip("/") + "/" + seg) if parent else "/" + seg
        node = Node(attrs=dict(elem.attrib), path=path, xpath=xpath, parent=parent)
        if parent is not None:
            parent.children.append(node)
        flat.append(node)
        counts = {}
        for i, child in enumerate(list(elem)):
            walk(child, path + (i,), node, counts)

    walk(root, (), None, {})
    return flat


def load(path: str) -> list:
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        return parse(fh.read())


# ---------------------------------------------------------------------------
# Selectors: a small, explicit model of what Appium can actually send
#
# Each selector compiles to a predicate over a parsed tree. Keeping the model
# this small is deliberate - it is the set of strategies worth using, and every
# one of them is verified by counting matches, never assumed.
# ---------------------------------------------------------------------------

@dataclass
class Candidate:
    rung: str
    strategy: str      # AppiumBy strategy name
    selector: str      # the literal you pass
    grade: str         # A..F, by anchor kind
    count: int = 0     # matches in the dump it was built from
    note: str = ""

    @property
    def unique(self) -> bool:
        return self.count == 1

    @property
    def verdict(self) -> str:
        if not self.unique:
            return "dont-ship"
        return "ship" if self.grade in ("A", "B") else "watch"


def _esc(v: str) -> str:
    return v.replace("\\", "\\\\").replace('"', '\\"')


def pred(spec):
    """Compile a selector spec into a predicate over Nodes."""
    kind = spec[0]
    if kind == "id":
        return lambda n: n.rid == spec[1]
    if kind == "desc":
        return lambda n: n.desc == spec[1]
    if kind == "text":
        return lambda n: n.text == spec[1]
    if kind == "class_instance":
        cls, inst = spec[1], spec[2]
        return lambda n: n.cls == cls and n.path and n.path[-1] == inst
    if kind == "scoped":
        scope, leaf = pred(spec[1]), pred(spec[2])
        return lambda n: leaf(n) and any(scope(a) for a in n.ancestors())
    if kind == "has_text":
        # "a container that carries this text somewhere inside it" - a feed row
        # identified by its author's handle, not by its own hook. On its own this
        # also matches every ancestor above the row, which is why scopes are
        # allowed to be conjunctions (see _scope_options).
        txt = spec[1]
        return lambda n: any(d.text == txt for d in n.descendants())
    if kind == "and":
        preds = [pred(s) for s in spec[1:]]
        return lambda n: all(p(n) for p in preds)
    if kind == "xpath_abs":
        return lambda n: n.xpath == spec[1]
    raise ValueError(f"unknown selector spec {spec!r}")


def count(nodes, spec) -> int:
    p = pred(spec)
    return sum(1 for n in nodes if p(n))


def _uiselector(kind: str, value: str) -> str:
    return f'new UiSelector().{kind}("{_esc(value)}")'


def ladder(node: Node, nodes: list) -> list:
    """The escalation ladder for one control, each rung verified by counting.

    Mirrors the Locator Inspector's ordering (strongest semantic anchor first,
    positional last), translated to what Android actually publishes:

        resource-id      -> By.ID                    (A)
        content-desc     -> By.ACCESSIBILITY_ID      (A)
        text             -> UiSelector().text()      (B)
        class + instance -> UiSelector().instance()  (D)
        absolute xpath   -> By.XPATH                 (F)
    """
    out = []
    seen = set()

    def add(rung, strategy, selector, spec, grade, note=""):
        if selector in seen:
            return
        seen.add(selector)
        out.append(Candidate(rung, strategy, selector, grade, count(nodes, spec), note))

    if node.rid:
        add("resource-id", "id", node.rid, ("id", node.rid), "A",
            "Version-pinned: stable within an app build, not across one.")
    if node.desc:
        add("content-desc", "accessibility id", node.desc, ("desc", node.desc), "A",
            "Authored accessibility label. Survives re-layout.")
    if node.text:
        add("text", "uiautomator", _uiselector("text", node.text), ("text", node.text), "B",
            "A copy or locale change breaks it.")

    # Scoped variants are only worth computing when every direct rung is
    # ambiguous. Emitting them for an already-unique control just buries the
    # answer under near-duplicate XPaths.
    if not any(c.unique for c in out):
        for cand_spec, desc, sel, grade, strategy in _scope_options(node, nodes):
            add("scoped", strategy, sel, cand_spec, grade, desc)

    if node.cls:
        inst = node.path[-1] if node.path else 0
        add("class+instance", "uiautomator",
            _uiselector("className", node.cls) + f".instance({inst})",
            ("class_instance", node.cls, inst), "D",
            "Position among same-class siblings. Any new sibling breaks it.")
    if node.xpath:
        add("absolute xpath", "xpath", node.xpath, ("xpath_abs", node.xpath), "F",
            "Every ancestor position must hold. Last resort.")

    order = {"A": 0, "B": 1, "D": 2, "F": 3}
    # Unique rungs first, strongest grade first; a non-unique rung is worthless
    # no matter how good its anchor looks.
    out.sort(key=lambda c: (not c.unique, order.get(c.grade, 4), len(c.selector)))
    return out


def _scope_options(node: Node, nodes: list):
    """Containers that make an otherwise-ambiguous leaf 1-of-1.

    The Android analogue of the Inspector's contextual locator: scope the leaf
    under a container that has its own unique hook, or under a container whose
    child text identifies it (a feed row carrying its author's handle). The
    scoped candidate is only emitted when the whole chain verifies 1-of-1.
    """
    leaf_specs = []
    if node.desc:
        leaf_specs.append((("desc", node.desc), f'[@content-desc="{_esc(node.desc)}"]'))
    if node.text:
        leaf_specs.append((("text", node.text), f'[@text="{_esc(node.text)}"]'))
    if not leaf_specs:
        return []

    out, seen = [], set()
    for anc in list(node.ancestors())[:5]:
        hints = []
        if anc.rid:
            hints.append((("id", anc.rid), f'[@resource-id="{_esc(anc.rid)}"]', "A"))
        if anc.desc:
            hints.append((("desc", anc.desc), f'[@content-desc="{_esc(anc.desc)}"]', "A"))
        txt = next((d.text for d in anc.descendants() if d.text and d is not node), None)
        text_hint = (("has_text", txt), f'[.//*[@text="{_esc(txt)}"]]', "B") if txt else None

        # A container hint alone is not enough when the container is repeated
        # (feed_row x N) or when the hint is structural (a bare "contains this
        # text" also matches every ancestor above the row). Conjoining the
        # container's own hook with the row's distinguishing text is what makes
        # the scope specific - and it is still a single, honest XPath.
        combos = list(hints)
        if text_hint:
            if hints:
                combos += [(('and', h[0], text_hint[0]), h[1] + text_hint[1], h[2]) for h in hints]
            else:
                combos.append(text_hint)

        for scope_spec, scope_xp, grade in combos:
            for leaf_spec, leaf_xp in leaf_specs:
                spec = ("scoped", scope_spec, leaf_spec)
                if count(nodes, spec) != 1:
                    continue
                xp = f'//*{scope_xp}//*{leaf_xp}'
                if xp in seen:
                    continue
                seen.add(xp)
                out.append((spec,
                            f'leaf {leaf_xp} inside a container matching {scope_xp} '
                            f'(container and leaf both verified 1-of-1)',
                            xp, grade, "xpath"))
                if len(out) >= 3:
                    return out
    return out


# ---------------------------------------------------------------------------
# Structural helpers that only an accessibility tree can give you
# ---------------------------------------------------------------------------

def scroll_containers(node: Node) -> list:
    """Scrollable ancestors, deepest first.

    This is the single biggest thing Path B buys you over screenshots: the app
    tells you which container scrolls. On a crop/filter screen with a nested
    scrollview, the correct move is to scroll the scrollable ancestor that
    actually holds the target - not to sweep the screen and hope.
    """
    return [n for n in node.ancestors() if n.scrollable]


def find(nodes, **kw) -> list:
    """Filter by raw dump attribute values, e.g. find(nodes, clickable="true")."""
    return [n for n in nodes if all(n.attrs.get(k) == v for k, v in kw.items())]


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

def coverage_report(name: str, nodes: list) -> dict:
    """The week-1 go/no-go measurement for one screen.

    Uniqueness is a property of the WHOLE tree, not of the controls: Appium's
    By.ID / By.ACCESSIBILITY_ID search every node, so a hook that also sits on a
    label or a container is already claimed. Counting only among controls would
    flatter the numbers by hiding exactly the collisions that cause flaky taps.
    """
    controls = [n for n in nodes if n.actionable]
    rid_counts, desc_counts = {}, {}
    for n in nodes:
        if n.rid:
            rid_counts[n.rid] = rid_counts.get(n.rid, 0) + 1
        if n.desc:
            desc_counts[n.desc] = desc_counts.get(n.desc, 0) + 1
    anon = [n for n in controls if not (n.rid or n.desc or n.text)]
    nameless = [n for n in anon if not n.name]          # nothing a screen reader could say
    return {
        "screen": name,
        "nodes": len(nodes),
        "controls": len(controls),
        "has_rid": sum(1 for n in controls if n.rid),
        "has_desc": sum(1 for n in controls if n.desc),
        "has_text": sum(1 for n in controls if n.text),
        "anonymous": len(anon),                      # no own rid/desc/text (a locator has no direct hook)
        "named_by_child": len(anon) - len(nameless),  # ...but a child label names it: locatable by a scoped chain
        "nameless": len(nameless),                    # no name anywhere: screen reader AND text locators have nothing
        # a control whose OWN hook resolves to it alone in the whole tree
        "rid_unique_usable": sum(1 for n in controls if n.rid and rid_counts[n.rid] == 1),
        "desc_unique_usable": sum(1 for n in controls if n.desc and desc_counts[n.desc] == 1),
        # distinct hook values shared by more than one node (need scoping)
        "rid_shared": sum(1 for v in rid_counts.values() if v > 1),
        "desc_shared": sum(1 for v in desc_counts.values() if v > 1),
        "scrollables": sum(1 for n in nodes if n.scrollable),
        "anonymous_examples": [n.cls.split(".")[-1] for n in anon[:6]],
    }


def print_coverage(rows: list):
    if not rows:
        print("no dumps found")
        return
    head = ("screen", "ctrl", "rid", "desc", "text", "anon", "rid1", "ridX", "desc1", "descX")
    print("%-28s %5s %5s %5s %5s %5s %5s %5s %6s %6s" % head)
    print("-" * 92)
    tot = {k: 0 for k in ("controls", "has_rid", "has_desc", "has_text", "anonymous", "named_by_child", "nameless",
                          "rid_unique_usable", "rid_shared",
                          "desc_unique_usable", "desc_shared")}
    for r in rows:
        print("%-28s %5d %5d %5d %5d %5d %5d %5d %6d %6d" % (
            r["screen"][:28], r["controls"], r["has_rid"], r["has_desc"], r["has_text"],
            r["anonymous"], r["rid_unique_usable"], r["rid_shared"],
            r["desc_unique_usable"], r["desc_shared"]))
        for k in tot:
            tot[k] += r[k]
    print("-" * 92)
    c = max(1, tot["controls"])
    print("%-28s %5d %5d %5d %5d %5d %5d %5d %6d %6d" % (
        "TOTAL", tot["controls"], tot["has_rid"], tot["has_desc"], tot["has_text"],
        tot["anonymous"], tot["rid_unique_usable"], tot["rid_shared"],
        tot["desc_unique_usable"], tot["desc_shared"]))
    print()
    print(f"  a tree hook that is unique 1-of-1:  "
          f"rid {100*tot['rid_unique_usable']/c:.0f}%   desc {100*tot['desc_unique_usable']/c:.0f}%")
    print(f"  either rid or desc present:         {100*(tot['has_rid'] or 0)/c:.0f}% / "
          f"{100*(tot['has_desc'] or 0)/c:.0f}%  (overlap not de-duplicated)")
    print(f"  no own rid/desc/text:               {100*tot['anonymous']/c:.0f}%   "
          f"of which named by a child label {100*tot['named_by_child']/c:.0f}%")
    print(f"  NAMELESS (screenshot-fallback zone): {100*tot['nameless']/c:.0f}%   "
          f"<- nothing for a screen reader or a text locator")
    print()
    print("  Read it like this:")
    print("   * NAMELESS% is the size of the screenshot-fallback surface - the number your")
    print("     hybrid design has to live with. Judge it on the accessible NAME (own text/desc,")
    print("     else child labels), not on the control's own attributes: on stock Settings the")
    print("     own-attribute view said 59% anonymous and the name-aware view said 0%.")
    print("   * ridX/descX are collisions: a hook exists but is shared, so it needs a")
    print("     scoped chain. High collisions mean 'ladder + scoping', not 'no hooks'.")
    print("   * rid is version-pinned. Re-run this per app build to get half-life.")


def print_ladder(nodes: list, only_actionable=True, limit=40):
    controls = [n for n in nodes if n.actionable] if only_actionable else nodes
    for n in controls[:limit]:
        print(f"\n{n.cls.split('.')[-1]:24s} {n.label()[:44]!r}  bounds={n.bounds}")
        sc = scroll_containers(n)
        if sc:
            print(f"  scroll container: {sc[0].rid or sc[0].cls.split('.')[-1]}"
                  f"{' (nested)' if len(sc) > 1 else ''}")
        for c in ladder(n, nodes):
            flag = "1-of-1" if c.unique else f"x{c.count}"
            print(f"  [{c.grade}] {flag:7s} {c.strategy:16s} {c.selector}")
            if c.note:
                print(f"          {c.note}")


def drift_report(a_path, b_path) -> dict:
    """Which rungs survived between two dumps of the same screen?

    This is the measurement the briefing's 'half-life of ~1-2 weeks' claim needs
    turned into data: per attribute, per app build, how many sessions does a
    locator last before it stops resolving to its element?
    """
    a, b = load(a_path), load(b_path)
    controls = [n for n in a if n.actionable]
    survived = {"resource-id": 0, "content-desc": 0, "text": 0, "class": 0}
    checked = {k: 0 for k in survived}
    deaths = []
    for n in controls:
        hull = {}
        if n.rid:
            hull["resource-id"] = ("id", n.rid)
        if n.desc:
            hull["content-desc"] = ("desc", n.desc)
        if n.text:
            hull["text"] = ("text", n.text)
        for kind, spec in hull.items():
            checked[kind] += 1
            if count(b, spec) >= 1:
                survived[kind] += 1
            else:
                deaths.append((kind, n.label()[:40], n.cls.split(".")[-1]))
    return {"a": os.path.basename(a_path), "b": os.path.basename(b_path),
            "controls": len(controls), "checked": checked,
            "survived": survived, "deaths": deaths[:20]}


def print_drift(r: dict):
    print(f"{r['a']}  ->  {r['b']}   ({r['controls']} controls)")
    print(f"{'rung':16s} {'checked':>8s} {'survived':>9s} {'rate':>7s}")
    for k, v in r["checked"].items():
        if not v:
            continue
        print(f"{k:16s} {v:8d} {r['survived'][k]:9d} {100*r['survived'][k]/v:6.0f}%")
    if r["deaths"]:
        print("\nfirst deaths (rung, label, class):")
        for d in r["deaths"]:
            print(f"  {d[0]:16s} {d[1]!r:30s} {d[2]}")


# ---------------------------------------------------------------------------
# Self-test: synthetic IG-shaped dumps, so the logic is provable without a device
# ---------------------------------------------------------------------------

FIXTURE_COMPOSE = """<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy index="0" class="hierarchy" rotation="0" width="1080" height="2400">
  <android.widget.FrameLayout class="android.widget.FrameLayout" package="com.instagram.android" bounds="[0,0][1080,2400]">
    <android.widget.TextView class="android.widget.TextView" resource-id="com.instagram.android:id/action_bar_title" package="com.instagram.android" text="New post" bounds="[300,120][780,200]"/>
    <android.widget.FrameLayout class="android.widget.FrameLayout" resource-id="com.instagram.android:id/crop_root" package="com.instagram.android" bounds="[0,200][1080,2000]">
      <android.widget.ScrollView class="android.widget.ScrollView" resource-id="com.instagram.android:id/crop_scroll" package="com.instagram.android" scrollable="true" bounds="[0,200][1080,1900]">
        <android.widget.HorizontalScrollView class="android.widget.HorizontalScrollView" resource-id="com.instagram.android:id/filter_tray" package="com.instagram.android" scrollable="true" bounds="[0,1700][1080,1900]">
          <android.widget.ImageView class="android.widget.ImageView" resource-id="com.instagram.android:id/filter_thumb" package="com.instagram.android" content-desc="Filter 1" clickable="true" bounds="[0,1700][200,1900]"/>
          <android.widget.ImageView class="android.widget.ImageView" resource-id="com.instagram.android:id/filter_thumb" package="com.instagram.android" content-desc="Filter 2" clickable="true" bounds="[200,1700][400,1900]"/>
          <android.widget.ImageView class="android.widget.ImageView" package="com.instagram.android" content-desc="" clickable="true" bounds="[400,1700][600,1900]"/>
        </android.widget.HorizontalScrollView>
      </android.widget.ScrollView>
    </android.widget.FrameLayout>
    <android.widget.TextView class="android.widget.TextView" resource-id="com.instagram.android:id/next_button_textview" package="com.instagram.android" text="Next" clickable="true" bounds="[900,2100][1060,2200]"/>
    <android.widget.LinearLayout class="android.widget.LinearLayout" resource-id="com.instagram.android:id/feed_row" package="com.instagram.android" bounds="[0,2000][1080,2400]">
      <android.widget.ImageView class="android.widget.ImageView" package="com.instagram.android" content-desc="Like" clickable="true" bounds="[100,2000][200,2100]"/>
      <android.widget.TextView class="android.widget.TextView" package="com.instagram.android" text="nasa" bounds="[220,2000][400,2100]"/>
    </android.widget.LinearLayout>
    <android.widget.LinearLayout class="android.widget.LinearLayout" resource-id="com.instagram.android:id/feed_row" package="com.instagram.android" bounds="[0,2400][1080,2800]">
      <android.widget.ImageView class="android.widget.ImageView" package="com.instagram.android" content-desc="Like" clickable="true" bounds="[100,2400][200,2500]"/>
      <android.widget.TextView class="android.widget.TextView" package="com.instagram.android" text="natgeo" bounds="[220,2400][400,2500]"/>
    </android.widget.LinearLayout>
    <android.widget.EditText class="android.widget.EditText" resource-id="com.instagram.android:id/caption_text" package="com.instagram.android" text="Write a caption" clickable="true" bounds="[0,2200][1080,2300]"/>
  </android.widget.FrameLayout>
</hierarchy>
"""

# Same screen after an app update: ids renamed, "Next" renamed, filter tray
# flattened into the parent scroll view, one control lost its label.
FIXTURE_COMPOSE_AFTER = """<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy index="0" class="hierarchy" rotation="0" width="1080" height="2400">
  <android.widget.FrameLayout class="android.widget.FrameLayout" package="com.instagram.android" bounds="[0,0][1080,2400]">
    <android.widget.TextView class="android.widget.TextView" resource-id="com.instagram.android:id/title_bar_text" package="com.instagram.android" text="New post" bounds="[300,120][780,200]"/>
    <android.widget.FrameLayout class="android.widget.FrameLayout" resource-id="com.instagram.android:id/crop_root" package="com.instagram.android" bounds="[0,200][1080,2000]">
      <android.widget.ScrollView class="android.widget.ScrollView" resource-id="com.instagram.android:id/crop_scroll" package="com.instagram.android" scrollable="true" bounds="[0,200][1080,1900]">
        <android.widget.ImageView class="android.widget.ImageView" package="com.instagram.android" content-desc="" clickable="true" bounds="[0,1700][200,1900]"/>
        <android.widget.ImageView class="android.widget.ImageView" package="com.instagram.android" content-desc="" clickable="true" bounds="[200,1700][400,1900]"/>
        <android.widget.ImageView class="android.widget.ImageView" package="com.instagram.android" content-desc="" clickable="true" bounds="[400,1700][600,1900]"/>
      </android.widget.ScrollView>
    </android.widget.FrameLayout>
    <android.widget.TextView class="android.widget.TextView" resource-id="com.instagram.android:id/next_button" package="com.instagram.android" text="Next" clickable="true" bounds="[900,2100][1060,2200]"/>
    <android.widget.LinearLayout class="android.widget.LinearLayout" resource-id="com.instagram.android:id/feed_row" package="com.instagram.android" bounds="[0,2000][1080,2400]">
      <android.widget.ImageView class="android.widget.ImageView" package="com.instagram.android" content-desc="Like" clickable="true" bounds="[100,2000][200,2100]"/>
      <android.widget.TextView class="android.widget.TextView" package="com.instagram.android" text="nasa" bounds="[220,2000][400,2100]"/>
    </android.widget.LinearLayout>
    <android.widget.LinearLayout class="android.widget.LinearLayout" resource-id="com.instagram.android:id/feed_row" package="com.instagram.android" bounds="[0,2400][1080,2800]">
      <android.widget.ImageView class="android.widget.ImageView" package="com.instagram.android" content-desc="Like" clickable="true" bounds="[100,2400][200,2500]"/>
      <android.widget.TextView class="android.widget.TextView" package="com.instagram.android" text="natgeo" bounds="[220,2400][400,2500]"/>
    </android.widget.LinearLayout>
    <android.widget.EditText class="android.widget.EditText" resource-id="com.instagram.android:id/caption_text" package="com.instagram.android" text="Write a caption" clickable="true" bounds="[0,2200][1080,2300]"/>
  </android.widget.FrameLayout>
</hierarchy>
"""


def selftest() -> int:
    fails = []

    def check(name, cond, detail=""):
        print(("  PASS  " if cond else "  FAIL  ") + name + (f"   {detail}" if detail and not cond else ""))
        if not cond:
            fails.append(name)

    nodes = parse(FIXTURE_COMPOSE)
    n_checks = 0

    print("parsing & structure")
    n_checks += 1
    check("parses every element", len(nodes) == 17, f"got {len(nodes)}")
    check("root has no parent", nodes[0].parent is None)
    check("bounds parsed", nodes[1].bounds == (0, 0, 1080, 2400), str(nodes[1].bounds))
    check("path is a child index chain", nodes[1].path == (0,), str(nodes[1].path))
    check("descendants() walks the subtree", any(d.text == "nasa" for d in nodes[0].descendants()))

    print("\ncontrol classification")
    nextbtn = [n for n in nodes if n.text == "Next"][0]
    check("Next is actionable", nextbtn.actionable)
    check("row label is not a control", not [n for n in nodes if n.text == "nasa"][0].actionable)
    check("unlabelled ImageView is a control", [n for n in nodes if n.cls.endswith("ImageView")
                                                and not n.desc][0].actionable)

    print("\ncoverage")
    cov = coverage_report("compose", nodes)
    check("7 controls counted", cov["controls"] == 7, str(cov["controls"]))
    check("1 anonymous control", cov["anonymous"] == 1, str(cov["anonymous"]))
    check("2 distinct rids are shared", cov["rid_shared"] == 2, str(cov["rid_shared"]))
    check("only 2 controls are rid-1-of-1", cov["rid_unique_usable"] == 2, str(cov["rid_unique_usable"]))
    check("2 controls are desc-1-of-1", cov["desc_unique_usable"] == 2, str(cov["desc_unique_usable"]))

    print("\nladder: unique control takes the strongest unique rung")
    lad = ladder(nextbtn, nodes)
    best = lad[0]
    check("best rung is resource-id", best.rung == "resource-id", best.rung)
    check("it is verified 1-of-1", best.unique, f"count={best.count}")
    check("grade A", best.grade == "A", best.grade)
    check("verdict ship", best.verdict == "ship", best.verdict)

    print("\nladder: ambiguous control gets a scoped chain")
    like = [n for n in nodes if n.desc == "Like"][0]
    lad = ladder(like, nodes)
    direct = [c for c in lad if c.rung == "content-desc"]
    check("bare content-desc is ambiguous", bool(direct) and direct[0].count == 2,
          str(direct[0].count if direct else None))
    check("a unique scoped chain is promoted above it", lad[0].unique and lad[0].rung == "scoped", lad[0].rung)
    check("scope pins the row by its own text", '@text="nasa"' in lad[0].selector, lad[0].selector)
    check("no bare shared-rid scope is emitted",
          not any(c.selector == '//*[@resource-id="com.instagram.android:id/feed_row"]'
                  '//*[@content-desc="Like"]' for c in lad), "emitted a shared-rid chain")
    natgeo = [n for n in nodes if n.desc == "Like"][1]
    check("the sibling control gets its own distinct chain",
          "natgeo" in ladder(natgeo, nodes)[0].selector, ladder(natgeo, nodes)[0].selector)

    print("\nscroll structure")
    thumb = [n for n in nodes if n.rid.endswith("filter_thumb")][0]
    sc = scroll_containers(thumb)
    check("two scroll ancestors found", len(sc) == 2, str(len(sc)))
    check("deepest scrollable is first", sc[0].rid.endswith("filter_tray"), sc[0].rid)
    check("next button has no scroll ancestor", scroll_containers(nextbtn) == [])

    print("\ndrift across an app update")
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        pa, pb = os.path.join(td, "before.xml"), os.path.join(td, "after.xml")
        open(pa, "w", encoding="utf-8").write(FIXTURE_COMPOSE)
        open(pb, "w", encoding="utf-8").write(FIXTURE_COMPOSE_AFTER)
        dr = drift_report(pa, pb)
        check("rid loses the renamed button", dr["survived"]["resource-id"] < dr["checked"]["resource-id"])
        check("text survives the rename", dr["survived"]["text"] == dr["checked"]["text"],
              f"{dr['survived']['text']}/{dr['checked']['text']}")
        check("content-desc reports its casualties", dr["survived"]["content-desc"] < dr["checked"]["content-desc"])

    print()
    if fails:
        print(f"SELFTEST FAILED ({len(fails)}): " + ", ".join(fails))
        return 1
    print("SELFTEST OK - all checks passed")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd = argv[0]
    if cmd == "--selftest":
        return selftest()

    if cmd == "coverage":
        target = argv[1] if len(argv) > 1 else "."
        paths = sorted(glob.glob(os.path.join(target, "*.xml"))) if os.path.isdir(target) else [target]
        if not paths:
            print(f"no .xml dumps in {target}")
            return 1
        rows = [coverage_report(os.path.basename(p), load(p)) for p in paths]
        print_coverage(rows)
        return 0

    if cmd == "rungs":
        nodes = load(argv[1])
        print_ladder(nodes, only_actionable="--all" not in argv)
        return 0

    if cmd == "drift":
        if len(argv) < 3:
            print("usage: hierdump.py drift before.xml after.xml")
            return 1
        print_drift(drift_report(argv[1], argv[2]))
        return 0

    print(f"unknown command {cmd!r}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
