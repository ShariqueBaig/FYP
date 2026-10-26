# Path B: accessibility-tree-first Android automation — build guide

You're committing to the hybrid the briefing recommends: **drive IG's Android app
from the accessibility tree, and fall back to screenshot+coordinates only on the
specific screens where Instagram suppresses it** — then characterise exactly
where and why that happens. That characterisation is your contribution; "we used
Appium" is not.

This guide is the procedure. It assumes your existing Python rig stays put for
the web side (Playwright) and adds a second, Android-side pipeline.

Companion file: [`hierdump.py`](hierdump.py) — an offline analyzer for saved
hierarchy dumps. It computes the go/no-go measurement, builds and verifies the
locator ladder, finds scroll containers, and measures rung survival across app
builds. `python3 hierdump.py --selftest` proves it works with no device attached.

---

## The one decision that shapes everything

You could drive Android three ways. Pick deliberately, because this is the thing
you'll be defending in a viva.

| Option | What you get | Why not (or why) |
|---|---|---|
| **Appium + UiAutomator2 driver** | `page_source` (full XML tree), `By.ID`, `By.ACCESSIBILITY_ID`, `-android uiautomator`, XPath, `mobile:` gesture commands, driver settings | Verbose, a Node server, ~50–200 ms per `find_element` round trip. **Recommended anyway** — see below. |
| **`uiautomator2` (openatx) Python lib** | Fast `dump_hierarchy()`, no WebDriver, tiny API | Installs its own ATX agent; less standard in the literature; you'll write your own wait/gesture layer. Fine as a side tool, weak as the system under test. |
| **`adb shell uiautomator dump`** | Nothing but XML | Cannot act, cannot scroll, and **cannot run while Appium holds the UiAutomation connection** — the two clients fight and one silently fails. Sanity check only. |

Take **Appium**, for one reason that outweighs all its clumsiness: `page_source`
gives you an **archivable snapshot** of every screen you ever touched. That
single property is what makes your evaluation affordable (see
[Evaluation](#evaluation-design-that-survives-a-viva)) — you can re-run locator
policies against 100 recorded sessions offline, in seconds, instead of burning
100 live sessions per experiment.

### The architecture that follows from it

```
dump once  ->  parse in Python  ->  resolve intent against the in-memory tree
           ->  act on bounds/element  ->  re-dump and assert a predicate
           ->  append (intent, rung, route, outcome, ms) to the session log
```

Do **not** loop `driver.find_element(...).click()` per step. Three reasons:
every find is a device round trip; Android XPath is evaluated on-device and is
slow; and a find tells you nothing you can archive or evaluate later. Resolve
against the dump you already have.

---

## Step 0 — the measurement that decides your project (do this first, 2–3 days)

Before you build anything, answer: **how much of IG's compose flow is actually
reachable in the tree?** If the answer is "almost none", Path B collapses and you
should know that in week 1, not week 9.

1. Get one IG account, one emulator, and the compose flow to the crop screen.
2. At every screen that matters — feed, profile, create-post entry, gallery
   picker, crop/filter, caption, share — save `driver.page_source` to
   `dumps/sNN_<screen>.xml`. Do it 5 times per screen across different sessions
   (this is your first drift sample, too).
3. Run:

```bash
python3 hierdump.py coverage dumps/
```

You get, per screen: how many controls exist, how many carry a unique
`resource-id`, a unique `content-desc`, text only, or **nothing at all**. The
`anon` column is the size of your screenshot-fallback surface. That number is
the headline of your results chapter, so measure it honestly and early.

**Decision rule.** Treat `anonymous%` on the compose screens as the thing you're
studying, not a blocker:

- `< ~25%` anonymous → Path B is comfortably the right call; the fallback is a
  minority path and you can afford to make it good.
- `25–50%` → Path B still right, but the fallback policy *is* a first-class
  deliverable, not an afterthought. Most likely outcome.
- `> 50%` → you're really doing Path A with a tree-based oracle. Still viable,
  but reframe the project around "where the tree fails", and say so to your
  supervisor immediately.

Run the same command per app build to get the half-life data the briefing asks
for, and `python3 hierdump.py drift before.xml after.xml` to see which rung died.

---

## Step 1 — environment

```bash
# device: AVD with a Google APIs image (NOT a Play Store image - you want adb
# root-free control and sideloading). API 34 or 35; API 36 if you want to test
# the Android 16 data-sensitivity behaviour.
# app:  pin the IG APK (APKMirror) so runs are comparable, and keep one
#       un-pinned device for the "IG updated underneath me" arm.

npm i -g appium && appium driver install uiautomator2
pip install Appium-Python-Client

adb shell cmd package resolve-activity --brief com.instagram.android   # verify the activity
```

Then, once per boot, in the emulator:

```bash
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
```

Turning animations off reduces your flake rate a lot — but it is also a
**fingerprint difference from a real device**. Note it, and re-enable for at
least one measurement arm so you can quantify what it bought you.

---

## Step 2 — session configuration that actually matters

```python
from appium import webdriver
from appium.options.android import UiAutomator2Options

def session():
    opts = UiAutomator2Options().load_capabilities({
        "platformName": "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": "emulator-5554",
        "appium:appPackage": "com.instagram.android",
        "appium:appActivity": ".activity.MainTabActivity",   # verify with adb, above
        "appium:noReset": True,              # keep the logged-in state
        "appium:newCommandTimeout": 300,
        # The two that change everything:
        "appium:settings[waitForIdleTimeout]": 0,
        "appium:settings[allowInvisibleElements]": True,
    })
    return webdriver.Remote("http://127.0.0.1:4723", options=opts)
```

- **`waitForIdleTimeout: 0`** — IG never goes idle; there is always an animation,
  a video, or a spinner. The default makes every command wait for a quiet UI
  that never arrives, which is a timeout generator. Set it to 0 and own your
  waits explicitly (next section).
- **`allowInvisibleElements: True`** — by default the tree traversal **stops
  recursing at the first invisible node**, so anything off-screen or
  `displayed=false` never appears in `page_source`. That is *exactly* your
  "profile tab isn't in the initial-load viewport" failure: the node isn't
  missing, it's filtered out. With this on, you can see it, read its `bounds`,
  and scroll to it deliberately instead of guessing. (Confirm the setting name
  against your driver version's README; it is set the same way at runtime via
  `driver.update_settings({...})`.)

Keep a **separate emulator + account** for this pipeline. Never point it at an
account whose survival you're measuring, until the harness is stable.

---

## Step 3 — the dump → resolve → act loop

The naive `find_element().click()` loop has a failure mode you must design out:
**stale handles**. Any UI mutation invalidates the element reference you hold, so
a click can land on the wrong node or throw. Dump-and-resolve avoids it because
you always act from a tree you just read.

```python
import time, hashlib

def settle(d, tries=10, interval=0.25):
    """Wait for the tree to stop changing, instead of guessing a sleep.

    Two identical consecutive dumps = the UI has stopped mutating. This is the
    honest replacement for wait-for-idle and for time.sleep(), and it hands you
    the snapshot you archive.
    """
    prev = None
    for _ in range(tries):
        xml = d.page_source
        if prev is not None and xml == prev:
            return xml
        prev = xml
        time.sleep(interval)
    return prev
```

Then:

```python
from hierdump import parse, ladder

xml = settle(d)
tree = parse(xml)                      # in-memory, milliseconds
target = pick(tree, intent)            # your policy, see Step 4
best = ladder(target, tree)[0]         # verified 1-of-1 against THIS snapshot

if best.unique:
    assert live_count(d, best) == 1    # confirm on device before acting
    d.execute_script("mobile: clickGesture", {"x": target.center[0],
                                             "y": target.center[1]})
else:
    route_to_fallback(intent)          # Step 6
```

Two habits worth the two extra seconds they cost:

- **`live_count(d, best) == 1` before acting.** `hierdump` verifies against the
  snapshot; the driver confirms against the live device. When they disagree, the
  tree changed between dump and act — re-dump rather than click blind. That
  disagreement is itself data: log it.
- **Assert a predicate after acting**, never "no exception was raised". The
  success signal is the next screen's marker node appearing; that is what makes
  your success metric defensible.

---

## Step 4 — the ladder, translated to Android

`hierdump.ladder()` emits this ordering for every control, verified by counting
matches in the snapshot:

| Rung | Android attribute | Appium strategy | Grade | Survives |
|---|---|---|---|---|
| 1 | `resource-id` | `By.ID` | A | one app build |
| 2 | `content-desc` | `By.ACCESSIBILITY_ID` | A | re-layout, reskin |
| 3 | scoped chain | `By.XPATH` / chained find | A–B | re-sort, re-render |
| 4 | `text` | `UiSelector().text()` | B | until copy/locale changes |
| 5 | `class` + `instance` | `UiSelector().className().instance()` | D | nothing |
| 6 | absolute XPath | `By.XPATH` | F | nothing |

Live example from the self-test fixture — a feed row whose Like buttons are all
`content-desc="Like"` and whose row ids are all shared:

```
//*[@resource-id="…/feed_row"][.//*[@text="nasa"]]//*[@content-desc="Like"]
```

That's the Android analogue of the Inspector's contextual locator: the shared
container id **conjoined with** the row's distinguishing text, with both halves
verified 1-of-1. Note what the tool refuses to emit — a bare
`//*[@resource-id="…/feed_row"]//*[@content-desc="Like"]`, because it matches two
rows. Getting that refusal right is most of the work.

**The nuance your system should beat the Locator Inspector on:** the Inspector
grades `resource-id` as **A** a priori. On Android that's only true *within a
build* — the id is `com.instagram.android:id/next_button_textview` today and
`…/next_button` after an update. So don't inherit letter grades; **grade each
rung empirically per app version** from observed survival, and reorder the ladder
from measurement. That is a small idea with real consequences, and it is exactly
the "self-updating" flavour the briefing asks for.

---

## Step 5 — the two failures Path B actually fixes

### The missing profile tab

Root cause is usually not "IG hides the tab" but "the dump stopped at the first
invisible node". With `allowInvisibleElements` on:

1. Find the target by `content-desc` / `resource-id` even while off-screen.
2. Read its `bounds` — you now know *which direction* and *how far*.
3. Find its scrollable ancestor (`hierdump.scroll_containers(target)[0]`).
4. `mobile: scrollGesture` on **that container**, in small `percent` steps.
5. Re-dump, confirm the target's bounds moved and it is now fully on-screen
   (`0 <= y1` and `y2 <= screen_height`), then act.

Verify by **bounds delta**, never by "I swiped and waited". A swipe that did
nothing and a swipe that worked are indistinguishable otherwise — which is
presumably why the current `wait-for-idle` version "doesn't recover reliably".

### The crop/filter nested scrollview

This is the clearest win in the whole project. On that screen there are two
nested scrollables; from a screenshot you cannot tell which one your drag is
hitting, which is why the current pipeline misses "about a third of the time".

The tree tells you: `scrollable="true"` marks both, and
`scroll_containers(target)` returns them **deepest first**. Scroll the innermost
container that actually holds your target, in bounded steps, checking after each
that the target's bounds changed — and stop as soon as it's fully visible. No
guesswork, no global sweep, no idle wait.

Log the number of scroll steps each time; "mean steps to reveal" is a clean,
objective metric for your results chapter.

---

## Step 6 — the fallback policy (this is failure class 4)

The briefing's real question is *"what's the right abstraction for intent vs
implementation route?"*. Answer it with data, not prose:

```python
@dataclass(frozen=True)
class Intent:
    id: str             # "compose.next"
    screen: str         # "crop"
    action: str         # click | type | reveal
    target: dict        # semantic description: labels, anchors, expected class
    pre: tuple          # preconditions that must already hold
    success: str        # predicate id checked on the NEXT tree
```

Routes are ordered per intent, and every attempt appends one row:

```
(intent_id, session, app_version, route_index, rung, attempt, outcome, ms, tree_hash)
```

Route order for `compose.next`: `id` → `accessibility id` → `text` →
`scoped xpath` → `screenshot+coords`. The screenshot route is a *route*, not an
exception handler: it gets its own success check and its own row.

That table is your failure→recovery dataset. It is the thing neither the Locator
Inspector (authoring-time, human-confirmed healing) nor Agent-Reach (backend
fallback, no UI at all) produces, and it is what makes a self-healing claim
testable later: with it you can simulate "what if we auto-promoted route 3 after
2 consecutive successes" against recorded history.

---

## Step 7 — where Instagram will suppress you (your research core)

Classify every screen into these buckets. The taxonomy *is* a contribution, and
it's what turns "we used Appium and it mostly worked" into a paper.

| # | Suppression | How you detect it | What you do |
|---|---|---|---|
| S1 | **No hook at all** — no rid, no desc, no text (custom-drawn / Compose without `testTag`) | `hierdump` `anon` column | screenshot+coords fallback; measure size |
| S2 | **Shared hook** — rid/desc repeated across rows | `rid_shared` / `desc_shared` | scoped chain (Step 4) |
| S3 | **Subtree excluded** — `importantForAccessibility="no"` / `noHideDescendants` | node absent even with `allowInvisibleElements` | fallback; note that "invisible" and "excluded" are different and only the first is recoverable |
| S4 | **Data-sensitive view** — Android 16 `accessibilityDataSensitive` | node absent/redacted on API 36 devices | fallback; **measure whether instrumented automation is denied too** |
| S5 | **WebView surface** — settings/legal/help | tree stops at a `WebView` node | route those to your Playwright pipeline |
| S6 | **Obscured-touch filtering** — `setFilterTouchesWhenObscured` | taps silently ignored | detect via "tap landed, predicate false"; don't retry blindly |

On **S4**, be precise, because it's the most interesting and the most
misreported. Android 16's `accessibilityDataSensitive` flag
(`View.setAccessibilityDataSensitive(View.ACCESSIBILITY_DATA_SENSITIVE_YES)`,
`android:accessibilityDataSensitive="1"`, or Compose
`Modifier.semantics { sensitiveData = true }`) denies access to that view to any
app requesting accessibility permission that hasn't declared
`isAccessibilityTool=true`; views with `setFilterTouchesWhenObscured(true)` are
treated as sensitive automatically ([Android Developers Blog, 11 Dec
2025](https://android-developers.googleblog.com/2025/12/enhancing-android-security-stop-malware.html)).

The open question — and a publishable micro-result — is whether **instrumented
UiAutomation** (what the UiAutomator2 server uses) is subject to the same denial
as an `AccessibilityService`. Nobody's writeup of IG answers that. Build two
throwaway APKs: one with a sensitive-marked button, one without, and run your
harness against each on API 36. That's a day of work and it either makes Path B
robust or tells you exactly where it dies.

Related, and worth measuring for the same reason: an app **can enumerate enabled
accessibility services** (`AccessibilityManager.getEnabledAccessibilityServiceList()`,
and `AccessibilityServiceInfo.isAccessibilityTool()`). UIA2 is
instrumentation-based rather than a registered accessibility service, so it may
not appear in that list — a genuine *advantage* of this stack over a hand-rolled
AccessibilityService, and a sentence your writeup can defend.

---

## Step 8 — what Path B does not fix

Say this out loud in your report rather than letting an examiner find it:

- **Behavioural detection** (your failure class 3) is untouched. Appium's
  `clickGesture` and `adb shell input tap` both inject synthetic events; how
  distinguishable they are from hardware touch is a measurement, not an
  assumption, and it's a separate failure class. Don't conflate the two.
- **Action blocks, rate limits, login challenges** are policy, not UI. The tree
  can't see them until they render.
- **The tree is itself an attack surface**: enabling automation changes what the
  device exposes. Keep the automation device separate from your measurement
  device, and say which is which.

---

## Evaluation design that survives a viva

Two arms, same account type, same device, same 100 tasks:

| | Baseline | Path B hybrid |
|---|---|---|
| Locating | screenshot + coordinates (current) | tree ladder + scoped chains |
| Recovery | log and skip | ordered routes, incl. screenshot route |
| Success signal | exception-free | next-screen predicate |

Report, per arm: **task success rate**, **steps to success**, **recovery cost**
(extra attempts + seconds), **rung distribution** (how often you needed rung 4+),
**anonymous-surface %**, and **per-rung half-life in sessions** (from
`hierdump.py drift` over your archived dumps). Your existing 50%-on-like-buttons
number is the natural headline comparison — same page, same task, two locators.

**The methodological lever:** collect dumps and traces once (~100 sessions), then
evaluate policies by replay. Rung ordering, scoping thresholds, and "when to give
up and use the screenshot" can all be swept against the same corpus in seconds.
Separating expensive data collection from cheap policy evaluation is what makes a
16-week project produce a defensible N=100 evaluation instead of N=12.

Do a power sanity check before you commit: to resolve 50% → 80% success you need
roughly 40 sessions per arm at conventional error rates; 100 per arm is
comfortable. State the calculation in your methodology.

---

## 16-week plan, mapped to the briefing

| Weeks | Do |
|---|---|
| 1–4 | Lit review; emulator + Appium + pinned APK; **Step 0 coverage measurement**; archive dumps from 5 sessions/screen; ethics + disclosure framing |
| 5–6 | Dump→resolve→act loop; ladder + scoping ported and unit-tested (`hierdump --selftest`); two fixes (profile tab, nested scroll) |
| 7–8 | Intent/route layer + the attempt log; suppression taxonomy instrumented (S1–S6) |
| 9–10 | The API 36 `accessibilityDataSensitive` experiment; web pipeline for WebView screens; stabilise |
| 11–13 | Baseline vs hybrid, 100 sessions/arm; offline policy replay; half-life analysis |
| 14–16 | Writeup, disclosure section, artefact handover |

---

## Pitfalls that will cost you days

- **One automation client per device.** Appium holding UiAutomation means
  `adb shell uiautomator dump` fails or hangs. Don't "just check quickly".
- **Stale element handles.** Always the top cause of "click landed on the wrong
  thing". Re-dump after every action; act on `bounds`.
- **Dumping mid-animation** gives a half-built tree — `settle()` exists for this.
  A tree that never settles means a video/indeterminate spinner; bound the wait
  and move on with the last snapshot, flagged.
- **`bounds` can be off-screen or zero-area.** `Node.onscreen` checks both. A zero
  area click is a silent no-op.
- **XPath is slow and fragile.** Reach for `By.ID`/`By.ACCESSIBILITY_ID` at
  runtime; use XPath for scoping where nothing else works, and never as the
  primary rung.
- **Emulator timing ≠ physical device timing.** Do at least one arm on real
  hardware before you claim generality.
- **`allowInvisibleElements` inflates the tree.** Hundreds of nodes you'll never
  touch — filter to `actionable`, which `hierdump` already does.
- **Login/MFA state** is the top source of "run died at step 1". Keep one
  long-lived `noReset` session, and check login before measuring.
- **Pinned APK vs live IG.** Pinning gives reproducibility; unpinned gives
  realism. You need both arms, labelled, or a reviewer will (fairly) call your
  drift numbers unfalsifiable.

---

## Ethics, in one paragraph you can reuse

The work measures how a specific production app's accessibility surface behaves
under automation, and builds a harness that degrades gracefully when that
surface is suppressed. It does not publish an evasion recipe: report suppression
*mechanisms and rates*, not a tuned bypass, and coordinate disclosure with the
platform before publishing anything that could function as an attack guide.
Accounts are isolated, rate-limited to human-plausible levels, and the
automation device is separated from any account whose survival is being
measured. Get this paragraph signed off in week 1, not week 14.

---

## Try it without a device

```bash
cd path-b
python3 hierdump.py --selftest                    # 28 checks, no device
python3 hierdump.py coverage dumps/               # per-screen go/no-go numbers
python3 hierdump.py rungs dumps/crop_s01.xml      # the ladder for every control
python3 hierdump.py drift dumps/before.xml dumps/after.xml
```

`--selftest` runs against embedded IG-shaped fixtures (duplicate feed-row Like
buttons, a nested scrollview, an unlabelled icon, an app update that renames
ids), so the ladder, the scoping rule, the scroll discovery and the drift report
are all proven before you own an emulator.
