# Path B: Accessibility-Tree-First Android Automation — Build Guide

*You're committing to the hybrid the briefing recommends: **drive IG's Android app from the accessibility tree, and fall back to screenshot+coordinates only on the specific screens where Instagram suppresses it** — then characterise exactly where and why that happens. That characterisation is your contribution; "we used Appium" is not.*

This guide is the procedure. It assumes your existing Python rig stays put for the web side (Playwright) and adds a second, Android-side pipeline.

**Companion file:** [`hierdump.py`](../path-b/hierdump.py) — an offline analyzer for saved hierarchy dumps. It computes the go/no-go measurement, builds and verifies the locator ladder, finds scroll containers, and measures rung survival across app builds. `python3 path-b/hierdump.py --selftest` proves it works with no device attached.

---

## 📍 The One Decision That Shapes Everything

You could drive Android three ways. Pick deliberately, because this is the thing you'll be defending in a viva.

| Option | What You Get | Why Not (or Why) |
|---|---|---|
| **Appium + UiAutomator2 driver** | `page_source` (full XML tree), `By.ID`, `By.ACCESSIBILITY_ID`, `-android uiautomator`, XPath, `mobile:` gesture commands, driver settings | Verbose, a Node server, ~50–200 ms per `find_element` round trip. **Recommended anyway** — see below. |
| **`uiautomator2` (openatx) Python lib** | Fast `dump_hierarchy()`, no WebDriver, tiny API | Installs its own ATX agent; less standard in the literature; you'll write your own wait/gesture layer. Fine as a side tool, weak as the system under test. |
| **`adb shell uiautomator dump`** | Nothing but XML | Cannot act, cannot scroll, and **cannot run while Appium holds the UiAutomation connection** — the two clients fight and one silently fails. Sanity check only. |

**Take Appium**, for one reason that outweighs all its clumsiness: `page_source` gives you an **archivable snapshot** of every screen you ever touched. That single property is what makes your evaluation affordable (see [Evaluation](#evaluation-design-that-survives-a-viva)) — you can re-run locator policies against 100 recorded sessions offline, in seconds, instead of burning 100 live sessions per experiment.

### The Architecture That Follows From It

```text
dump once  →  parse in Python  →  resolve intent against the in-memory tree
           →  act on bounds/element  →  re-dump and assert a predicate
           →  append (intent, rung, route, outcome, ms) to the session log
```

**Do not loop `driver.find_element(...).click()` per step.** Three reasons:

1. Every find is a device round trip
2. Android XPath is evaluated on-device and is slow
3. A find tells you nothing you can archive or evaluate later

Resolve against the dump you already have.

---

## 🥇 Step 0 — The Measurement That Decides Your Project (Do This First, 2–3 Days)

> **Before you build anything, answer: *how much of IG's compose flow is actually reachable in the tree?* If the answer is "almost none", Path B collapses and you should know that in week 1, not week 9.**

### 0.1 Get One IG Account, One Emulator, and the Compose Flow to the Crop Screen

1. **Create AVD**: Android Studio → AVD Manager → "Create Virtual Device" → select a phone (Pixel 7 recommended) → "System image" → **Google APIs** → Next → Name it "ig_fyp" → Finish
2. **Boot the AVD**, then reduce animation flakiness:

```bash
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

3. **Install the pinned IG APK** from APKMirror:

```bash
adb install com.instagram.android.apk
```

4. **Verify the main activity** (you'll need this for Appium caps):

```bash
adb shell cmd package resolve-activity --brief com.instagram.android
# Example output: com.instagram.android/.activity.MainTabActivity
# Copy that full string for Step 1
```

5. **Install Appium and the UiAutomator2 driver**:

```bash
npm i -g appium
appium driver install uiautomator2
```

6. **Start Appium server**:

```bash
appium
# You should see: Appium server listening on http://127.0.0.1:4723
```

### 0.2 Take Hierarchy Dumps at Every Screen

**The goal**: At every screen that matters, save `driver.page_source` to an XML file. Do this **5 times per screen** across different sessions (this is your first drift sample too).

**Screens to dump** (in order of the compose flow):

1. **Feed/home screen** — the first thing you see after login
2. **Profile tab** — the bug you're trying to fix
3. **Create post (+)** — entry point to the flow
4. **Gallery picker** — after tapping "+"
5. **Crop/filter screen** — the nested scrollview bug
6. **Caption screen** — after selecting a photo
7. **Share screen** — before posting

**Python script to dump one screen** (save as `dump_screen.py`):

```python
from appium import webdriver
from appium.options.android import UiAutomator2Options
import time

def session():
    opts = UiAutomator2Options().load_capabilities({
        "platformName": "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": "emulator-5554",
        "appium:appPackage": "com.instagram.android",
        "appium:appActivity": ".activity.MainTabActivity",   # from step 0.1
        "appium:noReset": True,
        "appium:newCommandTimeout": 300,
        # The two that change everything:
        "appium:settings[waitForIdleTimeout]": 0,
        "appium:settings[allowInvisibleElements]": True,
    })
    driver = webdriver.Remote("http://127.0.0.1:4723", options=opts)
    return driver

driver = session()

# --- Navigate to each screen, then dump ---
# Example: dump the feed home screen
time.sleep(5)  # wait for load
xml = driver.page_source
with open("dumps/s01_feed_session1.xml", "w", encoding="utf-8") as f:
    f.write(xml)

# Example: navigate to profile, dump
# driver.find_element("accessibility id", "Profile").click()
# time.sleep(5)
# xml = driver.page_source
# with open("dumps/s02_profile_session1.xml", "w", encoding="utf-8") as f:
#     f.write(xml)

# ... repeat for all screens, 5 sessions each ...
```

**How to navigate within the dump**: Use `driver.find_element(...).click()` or `driver.swipe()` to move between screens. The `time.sleep(5)` gives the UI time to settle; we'll replace this with the `settle()` function in Step 2.

### 0.3 Run the Coverage Report

Once you have dumps in a `dumps/` folder:

```bash
python3 hierdump.py coverage dumps/
```

**Example output** (your numbers will differ):

```
screen                    ctrl  rid  desc  text  anon  rid1  ridX  desc1  descX
------------------------------------------------------------------------------------
feed_screen               12    8    5    3    1    3    2     2     1
profile_screen            14    9    6    2    2    4    1     1     1
create_post_entry         8     4    3    1    2    2    0     1     1
gallery_picker            9     5    3    1    1    3    0     1     1
crop_filter_screen        11    4    3    2    3    2    1     0     1
caption_screen            6     3    2    1    1    2    0     1     1
share_screen              5     2    2    1    1    1    0     1     1
------------------------------------------------------------------------------------
TOTAL                     65   35   22   12   9   15    3     6     4
  a tree hook that is unique 1-of-1:  rid 23%   desc 17%
  either rid or desc present:         54% / 34%  (overlap not de-duplicated)
  ANONYMOUS (screenshot-fallback zone): 14%
  Read it like this:
   * anonymous% is the size of the screenshot-fallback surface - that is the
     number your hybrid design has to live with, and the paper's headline.
   * ridX/descX are collisions: a hook exists but is shared, so it needs a scoped chain.
     High collisions mean 'ladder + scoping', not 'no hooks'.
   * rid is version-pinned. Re-run this per app build to get half-life.
```

### 0.4 Interpret the Numbers — Decision Rule

| `anon%` (anonymous) | What It Means | Your Project Action |
|---|---|---|
| `< 25%` | Path B is comfortably right; the fallback (screenshot+coords) is a minority path | Proceed with Path B as the primary design |
| `25–50%` | Path B still right, but the fallback policy *is* a first-class deliverable, not an afterthought | Most likely outcome — build the fallback carefully |
| `> 50%` | You're really doing Path A with a tree-based oracle | **Reframe immediately**: project is about "where the tree fails", tell your supervisor now. Path B as stated won't fly. |

**Also look at**:

- `rid_unique_usable / controls`: What percentage of controls have a **unique** resource-id? This tells you how often `By.ID` alone will work.
- `rid_shared / desc_shared`: Collisions — how many hooks are shared. High numbers mean you need the **scoped chain** logic (Step 4).
- `drift` output across app builds: Which rungs survive? This is your "half-life" data.

**Run it per app build** (even the unpinned one) to get the half-life numbers the briefing asks for. Use:

```bash
python3 hierdump.py drift dumps/screen_before.xml dumps/screen_after.xml
```

---

## 🚀 Step 1 — Environment Setup (Detailed)

### 1.1 Create a Dedicated Automation Session

**Never** point the harness at your main measurement account until the harness is stable. Use a throwaway account.

### 1.2 Configure Appium Caps — The Two That Change Everything

Create a Python module `config.py`:

```python
#!/usr/bin/env python3
"""Appium configuration for Path B Android automation.

The two settings below are the single biggest lever in this whole project.
Without them, the tree is truncated and you get false negatives (elements
that are there but invisible to the tree)."""
from appium import webdriver
from appium.options.android import UiAutomator2Options

def make_opts():
    opts = UiAutomator2Options().load_capabilities({
        # ===== Identify the app and device =====
        "platformName": "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": "emulator-5554",
        "appium:appPackage": "com.instagram.android",
        "appium:appActivity": ".activity.MainTabActivity",   # verify with adb, above
        "appium:noReset": True,              # keep the logged-in state
        "appium:newCommandTimeout": 300,
        
        # ===== THESE TWO ARE THE DIFFERENCE-MAKERS =====
        # waitForIdleTimeout: 0 — IG never goes idle.
        # The default makes every command wait for a quiet UI that never arrives
        # (timeout generator). Setting to 0 means you own your waits explicitly.
        "appium:settings[waitForIdleTimeout]": 0,
        
        # allowInvisibleElements: True — by default the tree traversal STOPS
        # recursing at the first invisible node. Anything off-screen or
        # displayed=false never appears in page_source. This is EXACTLY your
        # "profile tab isn't in the initial-load viewport" failure: the node isn't
        # missing, it's filtered out. With this on, you can see it, read its bounds,
        # and scroll to it deliberately instead of guessing. (Confirm the setting
        # name against your driver version's README; it is set the same way at
        # runtime via driver.update_settings({...})).
        "appium:settings[allowInvisibleElements]": True,
    })
    return opts

def make_driver():
    return webdriver.Remote("http://127.0.0.1:4723", options=make_opts())
```

### 1.3 Reduce Animations (But Note the Fingerprint Trade-off)

```bash
# In the emulator, once per boot:
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

**Why this matters**: Fewer animations = fewer flaky timeouts. But: **animations off is a fingerprint difference from a real device**. Note it, and re-enable for at least one measurement arm so you can quantify what it bought you.

### 1.4 Verify the Session Starts

Run a quick test:

```python
from config import make_driver
driver = make_driver()
print("Session started OK")

# Basic sanity: how many elements does the tree expose?
xml = driver.page_source
print(f"page_source length: {len(xml)} chars")

# Find the profile tab — does it appear?
import xml.etree.ElementTree as ET
root = ET.fromstring(xml.strip())
# Count hierarchy nodes
hierarchy = root.find('.//hierarchy')
if hierarchy is not None:
    nodes = hierarchy.findall('.//*')
    print(f"Tree nodes exposed: {len(nodes)}")
else:
    print("No hierarchy node found — check caps")

driver.quit()
```

**Expected**: With `allowInvisibleElements: True`, you should see 60–120+ nodes on a typical IG screen. Without it, you might see 30–60 — the invisible ones are filtered out.

---

## 📐 Step 2 — The Dump → Resolve → Act Loop (The Core Loop)

> **This is the heart of Path B. Never loop `find_element().click()` per step.** Instead:
> 1. **Dump the tree** (`driver.page_source`)
> 2. **Parse it** in Python (`hierdump.parse()`)
> 3. **Resolve** the intent against the in-memory tree
> 4. **Act on bounds** (click at center, or scroll then click)
> 5. **Re-dump** and assert a predicate (the success signal)
> 6. **Append** `(intent, rung, route, outcome, ms, tree_hash)` to the session log

### 2.1 The `settle()` Function — Honest Wait-for-Idle

```python
import time

def settle(driver, tries=10, interval=0.25):
    """Wait for the tree to stop changing.
    
    Two identical consecutive dumps = the UI has stopped mutating.
    This is the honest replacement for wait-for-idle and for time.sleep().
    """
    prev = None
    for _ in range(tries):
        xml = driver.page_source
        if prev is not None and xml == prev:
            return xml  # UI has stabilized
        prev = xml
        time.sleep(interval)
    return prev  # gave up; return last snapshot, flagged
```

### 2.2 Parse & Resolve Against the Tree

```python
import time, hashlib
from hierdump import parse, ladder, coverage_report, find, scroll_containers

def run_intent(intent: str, driver):
    """Resolve one intent against the current screen's tree.
    
    Args:
        intent: a semantic description, e.g. "navigate to profile"
        driver: the Appium WebDriver
    
    Returns:
        (action, next_xml, success) tuple
    """
    # 1. Dump and settle
    xml = settle(driver)
    tree = parse(xml)
    
    # 2. Compute a tree hash for the session log
    tree_hash = hashlib.md5(xml.encode()).hexdigest()[:8]
    
    # 3. Pick the target node based on intent
    #    (this is your policy — see Step 4 for the ladder)
    target = pick_target(tree, intent)   # you implement this
    
    if target is None:
        return ("no_match", None, False, tree_hash)
    
    # 4. Run the ladder to find the best locator
    lad = ladder(target, tree)
    best = lad[0]
    
    # 5. Verify it's 1-of-1 in the snapshot before acting
    if not best.unique:
        # Fall back to screenshot+coords
        return ("fallback_screenshot", None, False, tree_hash)
    
    # 6. Confirm live count matches snapshot
    from hierdump import live_count
    if live_count(driver, best) != 1:
        # Tree changed between dump and act — re-dump, don't click
        return ("stale_tree", None, False, tree_hash)
    
    # 7. Act on the element's bounds
    x, y = best.center
    driver.execute_script("mobile: clickGesture", {
        "x": x,
        "y": y
    })
    
    # 8. Wait and re-dump
    time.sleep(3)  # or use settle() again
    next_xml = settle(driver)
    
    # 9. Assert a predicate: did the next screen appear?
    #    e.g. check for the "Next" button on the next screen, or the profile header
    success = assert_next_screen(next_xml, intent)
    
    return (best.rung, next_xml, success, tree_hash)

def assert_next_screen(xml, intent):
    """Check that the expected marker appears on the next screen.
    
    This is what makes the success metric defensible.
    Never rely on "no exception was raised".
    """
    root = ET.fromstring(xml.strip())
    hierarchy = root.find('.//hierarchy')
    if hierarchy is None:
        return False
    
    # Example: for "navigate to profile", check for profile header text
    # Example: for "post composition", check for the caption field
    # You implement the specific predicate for each intent
    
    # Placeholder: always return True for now; you fill this in
    return True  # <-- replace with real predicate
```

### 2.3 The Full Loop in One Function

```python
def automation_cycle(driver, intent_log):
    """One complete attempt at an automation step.
    
    Appends one row to intent_log and returns it.
    """
    import csv, time, hashlib
    
    # 1. Run the intent
    rung, next_xml, success, tree_hash = run_intent(intent, driver)
    
    # 2. Log the attempt
    row = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "intent": intent,
        "rung": rung,
        "outcome": "success" if success else "failed",
        "tree_hash": tree_hash,
        "session_ms": int(time.time() * 1000),  # approximate
    }
    
    # 3. Append to the log file
    log_file = "session_log.csv"
    try:
        with open(log_file, "a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=row.keys())
            # Write header only if file is new
            if f.tell() == 0:
                writer.writeheader()
            writer.writerow(row)
    except:
        pass  # file may already have header
    
    return row
```

---

## 🛠️ Step 3 — The Two Bugs Path B Actually Fixes

### 3.1 The Missing Profile Tab

**Root cause**: Not "IG hides the tab" but "the dump stopped at the first invisible node."

**With `allowInvisibleElements: True`, the fix**:

1. **Find the target** by `content-desc` / `resource-id` even while off-screen
2. **Read its `bounds`** — e.g., `(100, 2000, 200, 2100)` tells you it's at the bottom of the screen
3. **Find its scrollable ancestor**: `scroll_containers(target)[0]`
4. **Scroll that container** in small `percent` steps using `mobile: scrollGesture`
5. **Re-dump**, confirm the target's bounds moved and it's now fully on-screen (`0 <= y1` and `y2 <= screen_height`)
6. **Act**

**Code example**:

```python
from hierdump import parse, scroll_containers

def find_and_scroll_profile(driver, intent="navigate to profile"):
    xml = settle(driver)
    tree = parse(xml)
    
    # Find the profile tab — looks for a node with profile-related text/desc
    profile = None
    for n in tree:
        if any(kw in (n.desc or "") + (n.text or "") for kw in ["profile", "you", "account"]):
            if n.actionable:  # only act on clickable nodes
                profile = n
                break
    
    if profile is None:
        return "profile not found in tree"
    
    print(f"Found profile tab at bounds: {profile.bounds}")
    print(f"  center: {profile.center}")
    
    # Find scroll containers
    sc = scroll_containers(profile)
    if not sc:
        return "no scrollable ancestor — may already be visible"
    
    container = sc[0]  # deepest first
    print(f"Scrolling container: {container.rid or container.cls.split('.')[-1]}")
    print(f"  container bounds: {container.bounds}")
    
    # Scroll the container (percent is 0-100, where 50 = middle)
    # Small steps: 10% at a time
    driver.execute_script("mobile: scrollGesture", {
        "action": "scroll",
        "elementId": container.xpath,
        "direction": "down",
        "percent": 10,
    })
    
    # Wait and re-dump
    time.sleep(1)
    xml2 = settle(driver)
    tree2 = parse(xml2)
    
    # Find it again
    profile2 = None
    for n in tree2:
        if any(kw in (n.desc or "") + (n.text or "") for kw in ["profile", "you", "account"]):
            if n.actionable:
                profile2 = n
                break
    
    if profile2:
        print(f"After scroll, profile found at bounds: {profile2.bounds}")
        delta = (
            profile2.bounds[1] - profile.bounds[1],  # y1 delta
            profile2.bounds[3] - profile.bounds[3],  # y2 delta
        )
        print(f"  Bounds shifted by: {delta}")
        if delta[0] != 0:  # y1 changed = we scrolled
            return "success — profile now visible"
    
    return "profile still not visible after scroll"
```

### 3.2 The Crop/Filter Nested Scrollview

**The problem**: On the crop/filter screen, there are **two nested scrollables**. From a screenshot you cannot tell which one your drag is hitting — which is why the current pipeline misses "about a third of the time."

**The tree tells you**:

```python
from hierdump import parse, scroll_containers

xml = settle(driver)
tree = parse(xml)

# Find the filter thumb (one of the targets)
thumb = [n for n in tree if n.rid and "filter_thumb" in n.rid][0]
print(f"Filter thumb: {thumb.cls.split('.')[-1]}, bounds: {thumb.bounds}")

# Get scroll containers — deepest first
sc = scroll_containers(thumb)
print(f"Scroll containers (deepest first):")
for i, s in enumerate(sc):
    print(f"  [{i}] {s.rid or s.cls.split('.')[-1]}, bounds: {s.bounds}")

# The output will be something like:
# [0] filter_tray (deepest, innermost)
# [1] crop_scroll (outermost)

# THE KEY INSIGHT: Scroll the INNermost container that holds your target,
# not the outermost one. Scrolling the outermost sweeps the whole screen
# and is unreliable. Scrolling the innermost hits the exact target.

# So: scroll sc[0] (filter_tray) in small steps
container = sc[0]
driver.execute_script("mobile: scrollGesture", {
    "action": "scroll",
    "elementId": container.xpath,
    "direction": "down",
    "percent": 15,
})

# Re-dump and verify the thumb moved
time.sleep(1)
xml2 = settle(driver)
tree2 = parse(xml2)
thumb2 = [n for n in tree2 if n.rid and "filter_thumb" in n.rid][0]
print(f"After scroll, thumb bounds: {thumb2.bounds}")
```

**Why this works**: The app's UiAutomator2 tree explicitly marks both scrollables with `scrollable="true"`. By scrolling the **deepest** one first, you're scrolling the container that actually holds the target. The outermost scrollable may be a parent container that doesn't directly contain your target — scrolling it just moves everything, but the target's position relative to the screen doesn't change predictably.

**Metric to log**: "mean scroll steps to reveal" — count how many 15% scrolls it takes to bring the target fully on-screen. This is a clean, objective metric for your results chapter.

---

## 📊 Step 4 — The Ladder, Translated to Android

The ladder gives you an ordered list of locator strategies for every control, from strongest to weakest. Here's the Android translation:

| Rung | Android Attribute | Appium Strategy | Grade | Survives App Build |
|---|---|---|---|---|
| 1 | `resource-id` | `By.ID` | A | **Within a build only** — id is `com.instagram.android:id/next_button_textview` today, `.../next_button` after an update |
| 2 | `content-desc` | `By.ACCESSIBILITY_ID` | A | Survives re-layout, reskin |
| 3 | `text` | `UiSelector().text()` | B | Breaks on copy/locale change |
| 4 | `class` + `instance` | `UiSelector().className().instance()` | D | Any new sibling breaks it |
| 5 | absolute XPath | `By.XPATH` | F | Nothing |

### 4.1 The Scoped Chain — The Android Analogue of the Inspector's Contextual Locator

**Key insight from the code**: A bare `//*[@resource-id="…/feed_row"]//*[@content-desc="Like"]` matches **two** rows (it's ambiguous). The scoped chain conjoins the container's hook **with** the row's distinguishing text:

```
//*[@resource-id="…/feed_row"][.//*[@text="nasa"]]//*[@content-desc="Like"]
```

This is **1-of-1** because it requires BOTH the row id AND the row's distinguishing text.

**Code from hierdump.py's `_scope_options`**:

```python
def _scope_options(node: Node, nodes: list):
    """Containers that make an otherwise-ambiguous leaf 1-of-1."""
    leaf_specs = []
    if node.desc:
        leaf_specs.append((("desc", node.desc), f'[@content-desc="{_esc(node.desc)}"]'))
    if node.text:
        leaf_specs.append((("text", node.text), f'[@text="{_esc(node.text)}"]'))
    
    out, seen = [], set()
    for anc in list(node.ancestors())[:5]:
        hints = []
        if anc.rid:
            hints.append((("id", anc.rid), f'[@resource-id="{_esc(anc.rid)}"]', "A"))
        if anc.desc:
            hints.append((("desc", anc.desc), f'[@content-desc="{_esc(anc.desc)}"]', "A"))
        
        # Get a text hint from the ancestor's descendants (NOT including the target)
        txt = next((d.text for d in anc.descendants() if d.text and d is not node), None)
        text_hint = (("has_text", txt), f'[.//*[@text="{_esc(txt)}"]]', "B") if txt else None
        
        # Conjoin container hint with row text hint — this is what makes the scope specific
        combos = list(hints)
        if text_hint:
            if hints:
                combos += [((("and", h[0], text_hint[0]), h[1] + text_hint[1], h[2]) for h in hints)]
            else:
                combos.append(text_hint)
        
        for scope_spec, scope_xp, grade in combos:
            for leaf_spec, leaf_xp in leaf_specs:
                spec = ("scoped", scope_spec, leaf_spec)
                if count(nodes, spec) != 1:
                    continue  # not unique — skip
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
```

**Result**: For a Like button inside a `feed_row` that carries text `"nasa"`:
- The emitted XPath: `//*[@resource-id="com.instagram.android:id/feed_row"][.//*[@text="nasa"]]//*[@content-desc="Like"]`
- This matches **exactly one** Like button — the one in the row whose text is "nasa"
- The sibling Like (in the `natgeo` row) is excluded because its row's text is "natgeo", not "nasa"

### 4.2 Per-Build Grade Empiricism

**Don't inherit letter grades a priori.** Grade each rung **empirically per app version** from observed survival. Example:

> "On version 314.0.0.32.112 of IG, `resource-id` had a survival half-life of 8.2 sessions (mean). On version 315.0.0.29.047, it was 3.1 sessions. So we reorder the ladder: for this build, `content-desc` becomes rung 1, `resource-id` rung 2."

This is the "self-updating" flavour the briefing asks for, and it's a small idea with real consequences.

---

## 🛡️ Step 5 — Suppression Taxonomy (Your Research Core)

Classify every screen into these buckets. This taxonomy *is* a contribution, and it's what turns "we used Appium and it mostly worked" into a paper.

| # | Suppression | How You Detect It | What You Do |
|---|---|---|---|
| **S1** | **No hook at all** — no rid, no desc, no text (custom-drawn / Compose without `testTag`) | `hierdump` `anon` column | screenshot+coords fallback; measure size |
| **S2** | **Shared hook** — rid/desc repeated across rows | `rid_shared` / `desc_shared` from coverage report | scoped chain (Step 4) |
| **S3** | **Subtree excluded** — `importantForAccessibility="no"` / `noHideDescendants` | node absent even with `allowInvisibleElements` | fallback; note that "invisible" ≠ "excluded" — only the first is recoverable |
| **S4** | **Data-sensitive view** — Android 16 `accessibilityDataSensitive` | node absent/redacted on API 36 devices | fallback; **measure whether instrumented automation is denied too** |
| **S5** | **WebView surface** — settings/legal/help | tree stops at a `WebView` node | route those to your Playwright pipeline |
| **S6** | **Obscured-touch filtering** — `setFilterTouchesWhenObscured` | taps silently ignored | detect via "tap landed, predicate false"; don't retry blindly |

### 5.1 The S4 Deep Dive — Android 16 Data Sensitivity

**The fact**: Android 16's `accessibilityDataSensitive` flag (`View.setAccessibilityDataSensitive(View.ACCESSIBILITY_DATA_SENSITIVE_YES)`, `android:accessibilityDataSensitive="1"`, or Compose `Modifier.semantics { sensitiveData = true }`) **denies access to that view to any app requesting accessibility permission that hasn't declared `isAccessibilityTool=true`**.

Additionally, views with `setFilterTouchesWhenObscured(true)` are treated as sensitive automatically.

**The open question** (and a potential publishable micro-result): **Whether instrumented UiAutomation** (what the UiAutomator2 server uses) is subject to the same denial as an `AccessibilityService`.

**How to test**: Build two throwaway APKs:
1. One with a button marked `android:accessibilityDataSensitive="1"` 
2. One without

Run your harness against each on an API 36 emulator. **Result A**: Both behave the same → instrumented UIA2 is denied too, and Path B needs a workaround. **Result B**: Only the registered AccessibilityService is denied, not UIA2 → you have a genuine advantage to cite in your writeup.

**Related, worth measuring**: An app **can enumerate enabled accessibility services** (`AccessibilityManager.getEnabledAccessibilityServiceList()`, and `AccessibilityServiceInfo.isAccessibilityTool()`). UIA2 is instrumentation-based rather than a registered accessibility service, so it may not appear in that list — a genuine advantage of this stack over a hand-rolled AccessibilityService.

---

## 📈 Step 6 — The Fallback Policy (Failure Class 4)

The briefing's real question: **"what's the right abstraction for intent vs implementation route?"** Answer it with data, not prose.

### 6.1 The Intent Dataclass

```python
from dataclasses import dataclass
from typing import Tuple

@dataclass(frozen=True)
class Intent:
    id: str              # e.g. "compose.next"
    screen: str          # e.g. "crop"
    action: str          # "click" | "type" | "reveal"
    target: dict         # semantic description: labels, anchors, expected class
    pre: tuple           # preconditions that must already hold
    success: str         # predicate id checked on the NEXT tree
```

### 6.2 The Attempt Log Row

Every attempt appends one row:

```
(intent_id, session, app_version, route_index, rung, attempt, outcome, ms, tree_hash)
```

| Column | Meaning |
|---|---|
| `intent_id` | Unique identifier for the intent |
| `session` | Session number (1, 2, 3, ...) |
| `app_version` | e.g. "314.0.0.32.112" |
| `route_index` | Which route in the ordered list (0 = first strategy, 1 = second, etc.) |
| `rung` | The locator strategy that matched (resource-id, content-desc, etc.) |
| `attempt` | Try number (1, 2, 3, ...) for this route |
| `outcome` | "success" / "failed - wrong element" / "failed - not found" / etc. |
| `ms` | How long the attempt took (milliseconds) |
| `tree_hash` | Hash of the hierarchy dump at that moment (compare across app updates) |

### 6.3 Route Order for `compose.next`

The ordered routes (try in this order, stop at first success):

1. **Rung 0**: `resource-id` (By.ID) — strongest, version-pinned within a build
2. **Rung 1**: `content-desc` (By.ACCESSIBILITY_ID) — survives re-layout
3. **Rung 2**: `text` (UiSelector().text()) — breaks on copy/locale change
4. **Rung 3**: `scoped xpath` — the conjoined chain (container id + row text)
5. **Rung 4**: `screenshot + coords` — OCR-based fallback

**The screenshot route is a *route*, not an exception handler**: it gets its own success check and its own row in the log. You don't "fall back to screenshot when nothing else works" — you *try the screenshot route at index 4* and log it like any other.

### 6.4 The Full Log Schema

```csv
timestamp,intent,rung,outcome,tree_hash,app_version,session,route_index,attempt_ms
2026-01-15 10:30:00,"navigate to profile","resource-id","success",abc123,314.0.0.32.112,1,0,1240
2026-01-15 10:31:45,"navigate to profile","content-desc","failed - wrong element",def456,314.0.0.32.112,1,1,890
2026-01-15 10:33:20,"navigate to profile","scoped","success",ghi789,314.0.0.32.112,1,3,1450
2026-01-15 10:35:10,"navigate to profile","screenshot","success",jkl012,314.0.0.32.112,1,4,2100
```

**Analysis you can do with this log** (after 100 sessions per arm):

- **Task success rate** per arm (baseline vs Path B hybrid)
- **Steps to success** distribution (median, mean, interquartile range)
- **Recovery cost** (extra attempts + seconds needed when the first route fails)
- **Rung distribution** (how often you needed rung 4+)
- **Per-rung half-life** (from `hierdump.py drift` over your archived dumps — how many sessions does a rung survive before it stops resolving?)
- **anonymous-surface %** (from Step 0 coverage measurement, per screen)

---

## 📊 Step 7 — Evaluation Design That Survives a Viva

### 7.1 Two-Arm Design

| | Baseline (Current) | Path B Hybrid |
|---|---|---|
| **Locating** | screenshot + coordinates | tree ladder + scoped chains |
| **Recovery** | log and skip | ordered routes, incl. screenshot route |
| **Success signal** | exception-free | next-screen predicate |
| **Rung used** | always screenshot | distribution across rungs 0–4 |

**Report, per arm**:

- **Task success rate** (primary outcome)
- **Steps to success** (median, mean, interquartile range)
- **Recovery cost** (extra attempts + seconds needed when first route fails)
- **Rung distribution** (how often you needed rung 4+)
- **anonymous-surface %** (from Step 0 coverage measurement, per screen)
- **Per-rung half-life in sessions** (from `hierdump.py drift` over your archived dumps — how many sessions does a rung survive before it stops resolving?)

### 7.2 The Methodological Lever

> **"Two arms, same account type, same device, same 100 tasks."**
> Collect dumps and traces once (~100 sessions), then evaluate policies by replay.
> Rung ordering, scoping thresholds, and "when to give up and use the screenshot" can all be swept against the same corpus in seconds.
> Separating expensive data collection from cheap policy evaluation is what makes a 16-week project produce a defensible N=100 evaluation instead of N=12.

**Power sanity check**: To resolve 50% → 80% success you need roughly 40 sessions per arm at conventional error rates; 100 per arm is comfortable. State the calculation in your methodology.

---

## 🗓️ 16-Week Plan, Mapped to the Briefing

| Weeks | Do |
|---|---|
| **1–4** | Lit review; emulator + Appium + pinned APK; **Step 0 coverage measurement**; archive dumps from 5 sessions/screen; ethics + disclosure framing |
| **5–6** | Dump→resolve→act loop; ladder + scoping ported and unit-tested (`hierdump --selftest`); two fixes (profile tab, nested scroll) |
| **7–8** | Intent/route layer + the attempt log; suppression taxonomy instrumented (S1–S6) |
| **9–10** | The API 36 `accessibilityDataSensitive` experiment; web pipeline for WebView screens; stabilise |
| **11–13** | Baseline vs hybrid, 100 sessions/arm; offline policy replay; half-life analysis |
| **14–16** | Writeup, disclosure section, artefact handover |

---

## 🚫 Pitfalls That Will Cost You Days

| Pitfall | Why It's Dangerous | How to Avoid |
|---|---|---|
| **One automation client per device** | Appium holding UiAutomation means `adb shell uiautomator dump` fails or hangs silently | Never dump from a device Appium is already using. Keep a second "measurement only" emulator. |
| **Stale element handles** | Top cause of "click landed on the wrong thing" | Always re-dump after every action; act on `bounds`, not element references. |
| **Dumping mid-animation** | Gives a half-built tree | Use `settle()` — two identical consecutive dumps = UI stabilized. |
| **`bounds` can be off-screen or zero-area** | Zero-area click is a silent no-op | Check `node.onscreen` (zero-area or wholly off-screen boxes cannot be tapped). |
| **XPath is slow and fragile** | Reach for `By.ID`/`By.ACCESSIBILITY_ID` at runtime; use XPath for scoping only | Never use XPath as the primary rung. |
| **Emulator timing ≠ physical device timing** | Do at least one arm on real hardware before claiming generality | Budget at least 1 week on a physical device. |
| **`allowInvisibleElements` inflates the tree** | Hundreds of nodes you'll never touch | Filter to `actionable`, which `hierdump` already does. |
| **Login/MFA state** | Top source of "run died at step 1" | Keep one long-lived `noReset` session; check login before measuring. |
| **Pinned APK vs live IG** | Pinning gives reproducibility; unpinned gives realism | You need both arms, labelled, or a reviewer will call your drift numbers unfalsifiable. |
| **Confounding behavioral detection with UI detection** | Class 3 (behavioral) is untouched — Appium clicks are synthetic, not hardware touch | Don't conflate the two. Measure behavioral detection separately, if at all. |

---

## 🌍 Ethics, in One Paragraph You Can Reuse

> **"The work measures how a specific production app's accessibility surface behaves under automation, and builds a harness that degrades gracefully when that surface is suppressed. It does not publish an evasion recipe: report suppression *mechanisms and rates*, not a tuned bypass, and coordinate disclosure with the platform before publishing anything that could function as an attack guide. Accounts are isolated, rate-limited to human-plausible levels, and the automation device is separated from any account whose survival is being measured. Get this paragraph signed off in week 1, not week 14."**

---

## 💡 Try It Without a Device (Proof the Logic Works)

```bash
cd path-b
python3 hierdump.py --selftest    # 28 checks, no device needed
python3 hierdump.py coverage dumps/    # per-screen go/no-go numbers
python3 hierdump.py rungs dumps/compose.xml    # the ladder for every control
python3 hierdump.py drift dumps/before.xml dumps/after.xml    # drift across app updates
```

**`--selftest`** runs against embedded IG-shaped fixtures (duplicate feed-row Like buttons, a nested scrollview, an unlabelled icon, an app update that renames ids), so the ladder, the scoping rule, the scroll discovery and the drift report are all proven before you own an emulator.

---

## 📦 Summary: What You Walk Away With

After following this guide, you will have:

1. **A measured `anon%` per screen** — the headline number for your project's feasibility
2. **An Appium-configured harness** with the two magic settings (`waitForIdleTimeout: 0`, `allowInvisibleElements: True`)
3. **A dump→resolve→act loop** that never uses stale element handles
4. **A ladder of locator strategies** per control, with empirical grades per app build
5. **Two bug fixes**: the missing profile tab (scroll the innermost container) and the crop/filter nested scrollview (scroll deepest-first)
6. **A suppression taxonomy** (S1–S6) that's your research contribution
7. **An intent-and-route log** with per-attempt data, usable for policy replay and half-life analysis
8. **An evaluation design** (two-arm, N=100) that's defensible in a viva
9. **A written ethics paragraph** approved early in the project

**Start with Step 0** — measurement before building. The `anon%` number decides whether Path B is even viable for your project, and you'll have it in 2–3 days, not week 9.

---

## 📦 Summary: What You Walk Away With

After following this guide, you will have:

1. **A measured `anon%` per screen** — the headline number for your project's feasibility
2. **An Appium-configured harness** with the two magic settings (`waitForIdleTimeout: 0`, `allowInvisibleElements: True`)
3. **A dump→resolve→act loop** that never uses stale element handles
4. **A ladder of locator strategies** per control, with empirical grades per app build
5. **Two bug fixes**: the missing profile tab (scroll the innermost container) and the crop/filter nested scrollview (scroll deepest-first)
6. **A suppression taxonomy** (S1–S6) that's your research contribution
7. **An intent-and-route log** with per-attempt data, usable for policy replay and half-life analysis
8. **An evaluation design** (two-arm, N=100) that's defensible in a viva
9. **A written ethics paragraph** approved early in the project

### 🛠️ Follow-up: Live Appium Dumper

I've built `live_dumper.py` (see `path-b/live_dumper.py`) to automate the Step 0 measurement. It:

- Connects to Appium on your emulator
- Navigates through the IG compose flow at each screen
- At every important screen, settles the UI and saves:
  - `driver.page_source` → `dumps/sNN_<screen>_session<X>.xml`
  - Screenshot → `screenshots/sNN_<screen>_session<X>.png`
- After all screens are dumped, runs `hierdump.py coverage dumps/` to give you the go/no-go `anon%` numbers immediately

**Usage**: `python3 path-b/live_dumper.py --sessions 5`

This gives you the `anon%` measurement in one automated run instead of manually dumping 7 screens × 5 sessions = 35 times.

### 🛠️ Follow-up: Intent-and-Route Layer

I've built `intent_route_layer.py` (see `path-b/intent_route_layer.py`) to scaffold the per-attempt recovery log. It includes:

- The `Intent` dataclass with `id`, `screen`, `action`, `target`, `pre`, `success` fields
- Ordered `ROUTE_ORDER` per intent (resource-id → content-desc → text → scoped-xpath → screenshot)
- CSV log schema with 11 columns: `timestamp`, `session_id`, `app_version`, `intent_id`, `route_index`, `rung`, `attempt_number`, `outcome`, `outcome_detail`, `ms_elapsed`, `tree_hash`, `next_screen_marker`
- `replay_intent()` function that tries each route in order, logs every attempt, and returns the first success
- `check_next_screen()` helper to verify the next screen's marker appeared
- `make_row()` and `open_log()` / `close_log()` utilities

**Usage**: `python3 path-b/intent_route_layer.py compose.next` prints the route ordering for that intent.

This gives you the full attempt-logging infrastructure so that every automation step is recorded as `(intent_id, session, app_version, route_index, rung, attempt, outcome, ms, tree_hash)` — the data you need for policy replay and half-life analysis.

---

## 🤝 Share With Peers

You can copy this entire guide to a markdown file and share it. The key items to emphasize when discussing with peers:

- **The `anon%` measurement** is the go/no-go gate — don't build anything until you have it
- **`allowInvisibleElements: True`** is the single biggest fix for "elements not found" bugs
- **`settle()`** replaces all `time.sleep()` and `wait-for-idle` with honest tree stabilization
- **The ladder + scoping** is what makes locators survive app updates, not magic
- **The attempt log** is the deliverable that makes "self-healing" testable later
- **S4 (data sensitivity)** is the most interesting and most misreported suppression mechanism — measure it

Want me to walk through any specific step in even more detail, or help you set up the first dump?