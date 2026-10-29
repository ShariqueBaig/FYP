# FYP MVP — Intent-Aware Self-Healing GUI Automation for Accessible AI Assistants



**Handoff & build plan.** Written 2026-10-27. Defense in ~3 days.



> **How to use this document.** If the chat session is ever lost, hand this file plus this workspace to any capable coding agent. Sections 1–2 restate the problem and the framing; §3–§7 are the spec; §8 is what already exists (with known bugs); §9 is the schedule; §13 has every command. Read §2 before changing scope, and §8 before touching code.



---



## 1. The problem statement



### 1.1 Plain language



An AI assistant has to click buttons in an app **on behalf of a user**. Apps change their buttons constantly — ids rotate, labels move, order shuffles. Automation written against today's layout breaks next week. And when it breaks it usually fails **silently**, which for a user who cannot operate the app themselves (a blind user with a screen reader, someone with limited hand mobility using voice control) is not an inconvenience — it is a dead end.



### 1.2 The precise version



Existing GUI automation encodes **how** to perform an action — a selector, a coordinate, an element path — directly into the script. So a locator has a **half-life of days to weeks**. When it dies:



- the **intent** ("advance to the next step") is still valid, and still perfectly understood by the user;

- but the harness has **no representation of that intent**, so it cannot recover. It logs and skips, or silently no-ops.



Three failures follow, and all three must be addressed:



| # | Failure | What "fixed" means |

|---|---|---|

| F1 | **Locator rot** — the reference dies while the element stays | Resolve against a *fresh* tree, every time; never hold a stale handle |

| F2 | **No recovery route** — one dead route = total failure | An ordered ladder of routes per intent; vision is a route, not an exception handler |

| F3 | **No honest success signal** — "no exception raised" counted as success | The success signal is a **predicate checked on the next screen** |



### 1.3 Evidence from the source material



The briefing (`docs/kenna_android_automation_fyp_briefing_v2-1.md`) documents a real production pipeline, not a hypothetical:



- The home-feed like-button locator resolves **1-of-2 attempts** across a rolling 30-session window — a **consistent 50% success rate on the identical page**, because the app rotates class names and DOM structure.

- The compose-flow **"Next"** button's *text* stayed the same while its class and hierarchy changed **per session** → 6 failed post attempts on 2026-06-03/04; the posting pipeline has been blocked since 2026-06-04. Only read + engage actions still run daily.

- The **profile tab** appeared "missing" from the initial viewport. It was never missing — the tree traversal **stops recursing at the first invisible node**, so an off-screen node is filtered out of the dump entirely. ("Invisible" is recoverable; "excluded" is not — see the S3/S4 rows in §6.3.)

- The crop/filter screen has a **nested scrollview** that a screenshot-based drag misses about **a third of the time**, because from a screenshot you cannot tell which of two scroll containers your drag is hitting.



---



## 2. What the FYP means, and what is locked



### 2.1 The title, decoded



- **Intent-aware** — the assistant represents the **goal** ("tap Next"), never a coordinate and never a class name. The success signal is a predicate on the *next* screen, so "nothing threw" can never masquerade as success.

- **Self-healing** — when the route that worked yesterday is gone, an ordered **ladder** of alternative routes resolves the same intent. Routes are graded empirically per app build, so the ordering **self-updates**. The screenshot/vision route is a first-class route with its own success check and its own log row — *not* an exception handler.

- **For accessible AI assistants** — the user is someone who cannot operate the app themselves. The system must **either succeed or say why it could not**. Silent failure is a correctness bug with a usability consequence, not a missing log line.



### 2.2 Why "accessible" is not decoration



**The measurement instrument *is* the accessibility interface.** On Android, the UiAutomator2 hierarchy is a serialization of the `AccessibilityNodeInfo` tree that screen readers consume. On the web, it is the DOM accessibility tree. So the statement *"this control carries no hook at all"* is simultaneously:



- for the harness: a control that must be reached by vision; and

- for a real user: a control that a screen reader has **nothing to announce**.



The suppression taxonomy (S1–S6, §6.3) therefore is not merely "why my script broke." It is an **accessibility finding**. That collapse — same measurement, two meanings — is the contribution, and it is what makes the title true.



### 2.3 Locked decisions — do not relitigate



| # | Decision |

|---|---|

| 1 | **Testbed: the existing Instagram mock** in `insta clone/`. The marketplace mock comes *after* this is done. |

| 2 | **The harness is an injected overlay**, driving the app from outside — the pattern the Locator Inspector in this workspace already proves. |

| 3 | **Offline demo mode is mandatory.** No login, no Firebase, no internet required to demo. |

| 4 | **Time: 3 days**, long sessions available. |

| 5 | **Presentation: live demo + slides**, with a **recorded backup video**. |

| 6 | **`App.tsx` may be edited directly** — surgical changes only; the live-Firebase path must stay intact. |

| 7 | **Out of scope this week:** OLX auto-selling, and the tax-filer RPA. The existing **Power Automate Desktop tax-filer RPA becomes a second testbed later** (see §11.3 — it is a strong asset). |



### 2.4 Framing note — read this before writing any slides



The briefing contains **failure class 3: "behavioral-fingerprint survival"** — tap timing, session-length distributions, staying under detection thresholds indefinitely. Under the accessibility framing this is **evasion research and is out of scope.** Do not present it as a contribution, and do not implement it.



Report suppression **mechanisms and rates**, not a tuned bypass. Confirm the one-paragraph ethics statement in §11.4 with the supervisor **now**, not in week 14.



---



## 3. The MVP, stated precisely



**One harness, injected into the mock Instagram running in a browser, that:**



1. knows only **intents** — never fixed positions or hard-coded ids;

2. **completes the create-post flow** on a freshly broken UI, reporting which route it fell back to each time;

3. exposes a **"Break the UI" panel** that injects the exact failures named in §1.3;

4. **scores itself** against a dumb baseline that uses one hard-coded locator per step;

5. **reports honestly to the user** when a control genuinely cannot be resolved;

6. **measures the app's accessibility surface** — the percentage of controls with no accessible name.



Point 5 is the accessibility contribution. **Do not cut it.** Point 6 is the headline number.



---



## 4. Architecture



```

mock app (Expo web, in a browser)

        │

        │  injected overlay script (no framework, no build step, no deps)

        ▼

┌─────────────────────────────────────────────────────────────┐

│  INTENT RUNNER      │ CHAOS        │ LOG + SCOREBOARD        │

│  8 intents          │ 7 breaks     │ per-attempt rows,       │

│  Run / Step / Reset │ apply/reset  │ baseline vs healed      │

├─────────────────────────────────────────────────────────────┤

│  ACCESSIBILITY PANEL — unnamed-control %, honest failure msg │

└─────────────────────────────────────────────────────────────┘

        │

        ▼

   LADDER RESOLVER  ──►  act  ──►  re-read  ──►  assert predicate

```



**Resolution loop, per intent:**



```

read the live tree  →  resolve the intent against it  →  pick the best unique route

   →  act on the element  →  wait for the UI to settle

   →  assert the success predicate  →  append one row to the log

```



**Hard rules:**

- **Never hold a handle across an action.** Re-read after every action; act on freshly read geometry.

- **Verify uniqueness before acting.** If a route matches more than one element, it is not a route.

- **Never count "no exception" as success.** The predicate on the next screen is the only success signal.

- **The vision route is route N, not a `catch` block.** It gets its own attempt row like every other route.



---



## 5. The 8 intents (against the real UI)



Bindings are grounded in `insta clone/App.tsx`.



| # | Intent id | Target in the app | Line ref | Notes |

|---|---|---|---|---|

| 1 | `post.open` | "+" (`plus-square`) in the bottom nav → `handleStartPost` | `App.tsx:655-658` | **Unlabeled icon** — the S1 demonstration, and the entry to everything |

| 2 | `gallery.select` | a gallery image cell | `App.tsx:724-737` | 18 options, all anonymous; also triggers the upload effect |

| 3 | `compose.next` | header **"Next"** (`headerNextTextBlue`), step 2→3 | `App.tsx:685` | The briefing's exact failure: text survives, ids don't |

| 4 | `meta.advance` | settings row, step 3→4 | `App.tsx:869` | |

| 5 | `caption.type` | the caption `TextInput` | step 3 block | Text entry, not a click |

| 6 | `setting.toggle` | "Add AI label" switch | step 3 block | Nice irony for the accessibility framing |

| 7 | `share.post` | **Share** | step 4 block | End of flow |

| 8 | `feed.assert` | the new post appears in the feed | `renderFeedPost` | **The success predicate — not "it didn't throw"** |



Intent 8 is what makes the whole metric defensible. Without it, `share.post` succeeding means only "a click landed somewhere."



---



## 6. The breaks, and the taxonomy they demonstrate



### 6.1 The 7 breaks



| Break | What it does to the DOM | What it proves | Maps to |

|---|---|---|---|

| **B1** | Rename every id / test hook | Locator rot — the briefing's core failure | F1 |

| **B2** | Strip all labels from icon buttons | Anonymous surface | S1 |

| **B3** | Shuffle DOM order | Position-based scripts die instantly | F2 |

| **B4** | **Duplicate the "Next" button** | Needs the **scoped chain**; a bare locator is now ambiguous | S2 |

| **B5** | Nest a target inside a new scroll container | Must scroll the *deepest* container to reveal, then act | §1.3 nested scrollview |

| **B6** | Swap a labelled button for a bare icon | Forces the **vision fallback** route | S1 → route N |

| **B7** | Overlay a button so taps are silently ignored | Tap lands, predicate false → must not blind-retry | S6 |



**B4 is the best demo** — it is visually obvious, and the scoped chain that fixes it is genuinely clever. Put it centre stage.



### 6.2 The scoped chain (why B4 is fixable)



A bare hook like `content-desc="Like"` (or a shared `feed_row` id) matches **several** rows — ambiguous, therefore not a route. Conjoining the container's hook with the row's *distinguishing* content makes it 1-of-1:



```

//*[@resource-id="…/feed_row"][.//*[@text="nasa"]]//*[@content-desc="Like"]

```



The row id alone matches all rows; the row's own text pins exactly one. **This works identically in a browser DOM** — which is why the web MVP is not a throwaway: the logic is the same, only the tree differs.



### 6.3 The suppression taxonomy (S1–S6) — the research core



| # | Suppression | How it is detected | Response |

|---|---|---|---|

| **S1** | **No hook at all** — no id, no label, no text (icon-only, custom-drawn) | unnamed-control count | vision/coordinates route; **measure the size of this surface** |

| **S2** | **Shared hook** — same id/label repeated | duplicate-match count | scoped chain (§6.2) |

| **S3** | **Subtree excluded** — `importantForAccessibility="no"` / `noHideDescendants` | node absent even with invisible elements included | vision route. Note: *invisible* ≠ *excluded* — only the first is recoverable |

| **S4** | **Data-sensitive view** — Android 16 `accessibilityDataSensitive` | node absent/redacted on API 36 | vision route; **measure whether instrumented automation is denied too** |

| **S5** | **WebView surface** | tree stops at a WebView node | route to the web pipeline |

| **S6** | **Obscured-touch filtering** — `setFilterTouchesWhenObscured` | tap landed but predicate false | detect and **report**; do not retry blindly |



**S4 is the strongest publishable item.** Android 16's `accessibilityDataSensitive` flag denies a view to *any* app requesting accessibility permission that hasn't declared `isAccessibilityTool=true`; views with `setFilterTouchesWhenObscured(true)` are treated as sensitive automatically. The open question — whether **instrumented UiAutomation** (what the UiAutomator2 server uses) is denied the same way as a registered `AccessibilityService` — is a genuine small result. Test: two throwaway APKs, one with the flag, one without, on an API 36 emulator. This is **stage three**, not this week, but do not lose it.



**S3 and S4 are not automation quirks** — they affect assistive technology too. That is what turns the taxonomy into an accessibility finding.



---



## 7. Panels, metrics and the two arms



### 7.1 Panels



| Panel | Contents |

|---|---|

| **Intent runner** | The 8 intents, with `Run all` / `Step` / `Reset`, and the app's state |

| **Chaos** | The 7 break buttons, with `Reset all` |

| **Log + scoreboard** | The attempt table (§7.2) and the per-arm summary |

| **Accessibility** | Unnamed-control % per screen, and the assistant's user-facing message on failure |



### 7.2 The attempt log row



One row appended per attempt — this is the deliverable that makes "self-healing" testable rather than a slogan.



```

timestamp, intent_id, route_index, route_name, grade, outcome, outcome_detail, ms_elapsed, tree_hash

```



| Column | Meaning |

|---|---|

| `route_index` | Which route in the ordered ladder (0 = strongest) |

| `route_name` | `id` / `label` / `text` / `scoped` / `vision` |

| `grade` | A–F for the route that was used |

| `outcome` | `success` / `failed-ambiguous` / `failed-absent` / `failed-wrong-element` |

| `ms_elapsed` | Time for the attempt |

| `tree_hash` | Tree fingerprint — lets you correlate a failure with a UI change |



**Diagnosis is the point.** Route index *is* the diagnostic axis: ambiguity → S2, absent → S3/S4, tap-landed-predicate-false → S6. A blind retry loop cannot tell you any of that.



### 7.3 The two arms



| | **Baseline (the old way)** | **Healed** |

|---|---|---|

| Locating | one hard-coded locator per step | verified ladder + scoping |

| On failure | dies | next route |

| Success signal | no exception | next-screen predicate |

| Result under chaos | **fails at B1** | completes the flow |



The contrast is the evaluation. Even 20 runs of each, on web, is a real result table.



---



## 8. Workspace inventory — what exists, and what is broken



### 8.1 Files



| Path | Lines | Status |

|---|---|---|

| `docs/kenna_android_automation_fyp_briefing_v2-1.md` | 65 | **The problem statement.** Source of §1.3. |

| `docs/PATH_B_GUIDE.md` | 924 | **The build procedure** (expanded revision). Read this one. |

| `path-b/GUIDE.md` | 471 | Earlier overlapping draft of the above. Do not cross-reference between them. |

| `path-b/hierdump.py` | 676 | **Working.** Offline tree analyzer: ladder, scoping, scroll discovery, drift, coverage. |

| `path-b/intent_route_layer.py` | 365 | **Scaffold. Does not run.** See §8.3. |

| `path-b/live_dumper.py` | 428 | **Does not run.** See §8.3. |

| `insta clone/App.tsx` | 1881 | **The testbed app.** Runs on web. Zero accessibility instrumentation. |

| `insta clone/server.py` | 144 | Django microservice simulating S3 / Postgres / Celery-Kafka fan-out. Architecture-slide material; not needed for the demo. |

| `reference/locator-inspector-plugin-v1.0.2/QA-project/` | — | **A working web-side version of the same thesis** — verified-unique locators, A–F grading, broken-locator diagnosis. Mine it for ideas; do not present it as this FYP's contribution. It is a QA tool: its "self-healing" serves tests, not an end user with accessibility needs. |



### 8.3 Known bugs — fix these before relying on anything



**1. `path-b/live_dumper.py` — fatal `SyntaxError`, will not parse.**

Line 247: `"\n" + "=" * 60` is immediately followed by an f-string with **no operator**. Fix: append `+`.

The guide promises "the `anon%` measurement in one automated run" — that run cannot start until this is fixed.



**2. `path-b/intent_route_layer.py` — three separate runtime failures.**

- `open_log()` calls `os.path.isfile` / `os.makedirs` / `os.path.getsize`, but **`os` is never imported at module level** (only inside `replay_intent()`). Verified: `NameError: name 'os' is not defined`.

- `replay_intent()` does `from hierdump import settle, live_count` — **neither exists in `hierdump.py`.** Verified: `settle: False`, `live_count: False`. Also referenced in `PATH_B_GUIDE.md`. The guide's snippets promise functions the analyzer does not export.

- Line 247 references an undefined `target_node`.

- Route bodies are `pass` / `# ... (implement per-intent)`. It is a schema, not a layer.



**3. `path-b/live_dumper.py` also lacks a `dumps/` and `screenshots/` directory** — no measurement has ever been taken. You are at Step 0 of the guide.



**4. `insta clone/` — zero accessibility instrumentation.** Verified counts in `App.tsx`: `testID` 0, `accessibilityLabel` 0, `accessibilityRole` 0. This is *both* the problem with the demo and the finding the demo reports.



**5. `insta clone/` — the entire app is behind login.** `App.tsx:577`: `if (!user) return renderAuth();`. There is no path to the compose flow without a successful Firebase Auth login.



**6. Node/Expo version risk.** Environment is Node **v24.11.1**, npm 11.6.2. `package.json` pins `expo ~51.0.0` (targets Node 18/20). Metro may break under Node 24. **Verify before anything else**; pin Node 20 if needed.



**7. `insta clone/dist/` is stale** — built Sep 28, predating App.tsx changes. Rebuild or run the dev server; do not demo a stale bundle.



**8. `insta clone/firebaseConfig.ts` contains a live Firebase project id and web API key.** Web Firebase keys are public by design, so this is not a leak in the usual sense — but if the Firestore/Storage **security rules** are open, anyone can write to the project. Check the rules, and do not demo against a real account. This also reinforces decision §2.3-3.



---



## 9. The 3-day schedule



**Day 1 — de-risk, then foundation**

1. Verify the web build compiles and serves under Node 24 (§8.3-6). If Metro breaks, pin Node 20. *This is the first thing done, because if it fails everything else changes.*

2. Add **offline demo mode** to `App.tsx`: a switch that skips the login gate and serves local data and local images. Keep the live-Firebase path intact behind it.

3. Overlay skeleton: injection, panel shell, event wiring.

4. Ladder resolver + the settled-read loop; intents 1–4 working.



**Day 2 — the demo**

5. All 7 chaos breaks, with reset.

6. The vision/coordinate fallback route (route N).

7. Access panel (unnamed-control %) and the honest-failure message.

8. Attempt log, scoreboard, and the baseline arm.



**Day 3 — make it survivable**

9. Run the full sequence 10×; fix every flake.

10. **Record the backup video.**

11. Slides (§11), including the honesty slide and the future-work slide.

12. Rehearse twice, out loud, with the timer.

13. **Freeze the code.** No edits after the freeze.



> **The backup recording is not optional.** Laptop, projector, wifi and Firebase are four independent single points of failure. A recorded run survives all four.



---



## 10. The demo script (~5 minutes)



| # | Action | What you say |

|---|---|---|

| 1 | Run the app untouched, hit **Measure** | "This is our Instagram mock. Of the N controls in the compose flow, **M expose no accessible name.** A screen reader has nothing to announce for them." |

| 2 | Point at the **"+"** button and the **profile tab** | "The button that starts the whole flow is one of them. This is the exact failure in our problem statement — the profile tab that was 'missing' because the tree filtered it out." |

| 3 | Hit **Break B1**, run the **baseline** | "The old approach uses one hard-coded locator per step, recorded on the healthy app. Here it is on a freshly renamed app." → **0 of 7: it dies at the very first step.** |

| 4 | Hit **Run all** with the **healed** engine | "Same intents, same app. Our engine doesn't know any locator — it knows *goals*." → completes the flow. |

| 5 | Show the log | "Every attempt is recorded: which route it used, how reliable that route is, how long it took. Route 0 is the strongest; watch it walk down to route 3." |

| 6 | **Break B4** (duplicate "Next") | "Now there are two Next buttons — a naive locator is ambiguous, which means wrong-element clicks. Watch the **scoped chain** pin the right one." |

| 7 | **Break B6**, then run | "Labels gone. It falls back to vision — and you can see the fallback in the log as a *route*, not a hidden catch block." |

| 8 | **Break B7** (obscured tap) | "The tap lands but nothing happens. A retry loop would hammer this forever. We detect it and stop." |

| 9 | Break everything | **"I couldn't finish — the Post button has no label I can read. You may need to do this step yourself."** |



**Step 9 is the one that wins the room.** It is the accessibility claim made concrete: the assistant fails *honestly* instead of silently. Do not skip it, and do not leave it for last if time is short — reorder so it always lands.



---



## 11. Slides, honest claims, future work, ethics



### 11.1 Slide skeleton



1. Title + the one-sentence problem.

2. The evidence: 50% success on the identical page; compose blocked since June 4th (§1.3).

3. The three failures F1/F2/F3.

4. The title decoded (§2.1).

5. Architecture diagram (§4).

6. **Live demo.**

7. The result table — baseline vs healed (§7.3).

8. The suppression taxonomy S1–S6 (§6.3).

9. The accessibility finding: unnamed-control %, and the honest-failure message.

10. Future work (§11.2) — Android, real app, evaluation protocol.

11. Ethics (§11.4).

12. Contributions, stated modestly and precisely.



### 11.2 The honest-claims slide — memorise this



> "We built the self-healing intent layer and demonstrated it on our own Instagram mock, where we can inject the exact failures from our problem statement on demand. The same ladder and scoping logic is implemented for Android accessibility trees and unit-tested — the hierarchy analyzer passes 28 self-tests with no device attached. The two-arm evaluation protocol is specified, and the Android 16 data-sensitivity experiment is stage three."



Every clause there has an artifact behind it. Nothing is overstated.



### 11.3 The Power Automate RPA is a strong asset — use it later



A tax-filer RPA built in **Power Automate Desktop** that you then *break* is **better evidence than a mock you wrote yourself**: it is a real automation, recorded by a real tool, failing on a real UI change. That is the "old way" failing, which is exactly your baseline arm. When this week is over, break it and capture before/after. Keep it.



### 11.4 The ethics paragraph — reuse verbatim, get it signed off now



> "The work measures how a specific app's accessibility surface behaves under automation, and builds a harness that degrades gracefully when that surface is suppressed. It does not publish an evasion recipe: we report suppression **mechanisms and rates**, not a tuned bypass. Accounts are isolated, rate-limited to human-plausible levels, and the automation device is separated from any account whose survival is being measured."



Under the accessibility framing this is a normal measurement-ethics statement — it is routine, **not** a research output. That is a direct benefit of choosing this framing.



---



## 12. Risks and mitigations



| # | Risk | Severity | Mitigation |

|---|---|---|---|

| 1 | **Demo depends on the network** — Firebase auth gate (`App.tsx:577`), Firestore writes, a Storage upload, and `picsum.photos` images, **in series** | **Fatal** | Offline demo mode (§2.3-3). Do this first. |

| 2 | **Metro/Expo breaks under Node 24** | **High** | Verify first; pin Node 20 |

| 3 | **Stale `dist/` bundle** demoed by accident | High | Rebuild or use the dev server; verify the running page shows current UI |

| 4 | **No automation hooks exist** — the engine has nothing to resolve against | High | The three-phase demo (§10 steps 1/3/4). Never claim the engine works when it simply wrote the hooks it reads |

| 5 | **Chaos breaks are considered "staged" by an examiner** | Medium | They are staged *by design* — the briefing's failures are injection-tested. Say so plainly, and show the taxonomy mapping |

| 6 | **Overreach in the viva** — claiming Android results | Medium | §11.2, verbatim |

| 7 | **Live edits during the defense window** | Medium | Hard freeze at end of Day 3 |

| 8 | **Accidental edits to the working app** | Medium | Surgical diffs only; keep the Firebase path intact; the offline switch is additive |



---



## 13. Commands — how to work with everything



### 13.1 The mock app (`insta clone/`)



```bash

cd "insta clone"

node -v                        # expect v24.x — see §8.3-6; pin 20 if Metro fails

npx expo start --web           # dev server, hot reload (preferred while building)

npx expo export --platform web # rebuild the static bundle into dist/

npm run server                 # the Django microservice (python server.py)

```



Web is the demo surface. `android`/`ios` scripts exist but are **not** part of this week.



### 13.2 The Android-side analyzer (`path-b/`) — no device needed



```bash

cd path-b

python3 hierdump.py --selftest                 # 28 checks, all pass, no device. Run this to confirm the ladder logic is sound

python3 hierdump.py coverage dumps/            # the go/no-go anon% measurement (needs dumps/, which do not exist yet)

python3 hierdump.py rungs dumps/compose.xml    # the locator ladder for every control in one dump

python3 hierdump.py drift before.xml after.xml # which rung died across an app update (the half-life data)

```



**Dump naming convention:** `dumps/sNN_<screen>_sessionX.xml`, one file per screen per session.



### 13.3 The interpretation gate



`anon%` (the anonymous column from `coverage`) is the go/no-go number for the Android stage:



| `anon%` | Meaning |

|---|---|

| `< 25%` | Tree-first is comfortably right; vision is a minority path |

| `25–50%` | Tree-first still right, **and the fallback policy is itself a deliverable.** Most likely outcome |

| `> 50%` | Reframe to "where the tree fails" — under the accessibility framing this is still a good project, and arguably a more important one |



Note that the last row is exactly why the accessibility framing is the safe choice: the worst case stops being a disaster and becomes a finding.



### 13.4 Known fixes to apply when you touch `path-b/`



- `live_dumper.py:247` — add the missing `+` so the file parses.

- `intent_route_layer.py` — add `import os` at module level; either implement `settle`/`live_count` in `hierdump.py` or change the import to the real API; define or remove `target_node`.



### 13.5 Verification habits



- After every action, **re-read the tree** — never reuse a handle.

- Before acting, **verify uniqueness** — a route matching 2+ elements is not a route.

- After acting, **assert the predicate** — never "no exception."

- When a tap lands and the predicate is false, that is **S6**, not a flake. Report it.



---



## 14. Handoff notes for another agent



If you are picking this up cold:



1. Read §1–§2 (problem + locked decisions). Do not change the scope without the student.

2. Read §8 (inventory + bugs). **Do not trust `path-b/intent_route_layer.py` or `path-b/live_dumper.py`** — they do not run. `path-b/hierdump.py` **is** trustworthy; prove it with `--selftest`.

3. The testbed is `insta clone/` — an Expo web app, gated behind Firebase login at `App.tsx:577`, with **zero** accessibility instrumentation.

4. This week's work is **§3–§7 implemented as an injected overlay**, offline-capable, per §9.

5. Keep the Android material as the *next* stage, not a throwaway — it is what makes the "future work" slide real and it is already unit-tested.

6. Never let the demo depend on the network.

7. Never claim Android results from a web demo. Use §11.2 verbatim.



---



## 15. Progress log — append as you go



### 2026-10-27 — Day 1, first hours



**Web build verified. No Node pinning needed.** `expo export --platform web` completes under Node v24.11.1, exit 0, 357 modules, ~22s. The Node-24 risk in §8.3-6 is closed. Also: the exported bundle hash was byte-identical to the September build, so `App.tsx` had not changed since then and the "stale `dist/`" risk in §8.3-7 was smaller than documented.



**Offline demo mode built and verified.** Opt-in in `App.tsx`, activated with `?demo=1` or `localStorage.FYP_DEMO = '1'`. **Normal behaviour is untouched** — the live Firebase path is intact behind the flag.



What was changed (30 network image URLs and 11 Firebase call sites mapped first):



| Site | Change |

|---|---|

| Auth effect | demo mode sets a synthetic user, skipping `onAuthStateChanged` |

| Feed listener | demo mode keeps the seeded local feed |

| Upload effect | demo mode skips Firebase Storage; the local image becomes the ticket |

| `handleShare` | demo mode prepends the post to local feed state (makes `feed.assert` real) |

| Like / DM / comment writes | demo mode skips the Firestore write |

| All media | `medPhoto(id)` / `medAvatar(n)` return local SVG data URIs in demo mode |



Verified in a real browser: **no login gate**, feed renders, compose flow opens, 19 images render, and **every network request is the local bundle, a local icon font, or a `data:` URI.** Zero Firestore, zero picsum, zero pravatar. The demo cannot be broken by wifi.



**Pre-existing crash fixed.** `progressAnim` and `fadeAnim` were referenced in 8 places (`handleShare` and the notification banner) but **never declared** anywhere. Tapping Share threw `progressAnim is not defined` and blanked the screen — so intent `share.post` could never have worked. Declared both with `useRef` (which was already imported, unused). Proven pre-existing: `git diff App.tsx | grep '^\+.*(progressAnim|fadeAnim)'` returns nothing, so none of the new code introduced them. `tsc --noEmit` is now exit 0.



**react-native-web gotcha — do not re-break this.** RN Web deliberately re-encodes inline SVG data URIs itself, via `svgDataUriPattern = /^(data:image\/svg\+xml;utf8,)(.*)/`, precisely to escape `#` and `"`. Passing an **already-encoded** payload double-encodes it, and the image then fails *silently* — it renders as a correctly-sized empty box with no console error and no network request. `demoImg` must return `'data:image/svg+xml;utf8,' + <raw markup>`.



**Accessibility evidence captured — this is the demo's headline, and it is measured, not asserted.**



| Measurement | Value |

|---|---|

| `testID` / `accessibilityLabel` / `accessibilityRole` in `App.tsx` | 0 / 0 / 0 |

| `[role="button"], button` elements on the feed screen | **0** |

| The "+" button that starts the compose flow | `<div tabindex="0">`, `role=generic`, **`textContent` empty — no accessible name** |

| All 5 bottom-nav items (home, search, +, reels, profile) | unnamed `generic` nodes |

| The DM button | announced as `"3 "` — the **badge count**, not its purpose |



A screen reader pointed at this app can announce almost nothing, and the control that begins the entire create-post flow announces nothing at all. That is S1, demonstrated objectively rather than claimed.



**Not yet built:** the injected overlay (intent runner, chaos panel, attempt log, scoreboard, accessibility panel). That is the next task — §3–§7.



**Uncommitted changes in this workspace that are the student's, not the agent's:** `package.json` / `package-lock.json` (the `firebase` dependency). Do not revert them. `dist/` and `App.tsx` are agent-modified and expected.



### 2026-10-27 — Day 1, later: the overlay harness is built and both arms are measured



Everything in §3–§7 now exists and has been run end to end in a real browser.



**Build & run:** `bash fyp-mvp/build-demo.sh` (exports the app and injects the harness), then serve `insta clone/dist` and open `?demo=1`.



**Headline result — measured, not asserted, under breaks B1–B4:**



| Arm | Result | What the log shows |

|---|---|---|

| Baseline (recorded locators) | **0 / 7** | `locator no longer resolves: [data-testid="tab-create"]`, `[data-testid="gallery-cell-2"]`, `[aria-label="Add AI label"]`, … |

| Healed (intent ladder) | **7 / 7** | `post.open→vision`, `gallery.select→vision[0]`, `compose.next→text`, `caption.type→vision`, `setting.toggle→scoped`, `share.post→text`, `feed.assert→predicate` |

| All 7 breaks armed | **stops at step 1 with the honest message** | see below |



The **honest-failure beat** (§10 step 9) renders in `#fyp-fatal`:



> The assistant, reporting honestly: "I could not finish the step \"Open the create-post flow\" - I cannot identify a control for this step - there is no name I can read and no locator I can pin down. You may need to do this step yourself. [every route was tried and none achieved the goal: id(0), label(0), text(0), scoped(0), vision(no effect)]"



**The baseline is now a real recording, not a strawman.** The first version captured every locator on the feed, so the gallery and caption steps reported *"no locator was ever captured"* — an examiner would have torn that apart. It now records once on the **healthy app**, walking the flow step by step and storing one locator per step (`recordBaseline()`, logged as nothing because recording is not evidence). It stops before the publish step, so recording creates no post. Six locators, captured on the healthy app; the `assert` step reports honestly that a recorded script has no assertion step.



**Bugs found and fixed — each one would have wrecked the demo:**



1. **`visionSweep` was a no-op.** `route_vision` collapsed the candidate pool to a single ordinal pick, so the sweep in `runIntent` received a 1-element array and reported `vision(no effect)` on the first miss. It now returns the whole ordered neighbourhood for sweeping intents.

2. **B3 crashed the gallery.** Setting `flex-direction: row-reverse` on react-native-web's grid container **collapsed it to `width: 0`** and threw every cell to `x = -296` — off-screen, unresolvable, unclickable. That is a crash, not a reorder. B3 now permutes the **items** with CSS `order`, which keeps boxes on screen and only changes visual sequence — which is what the break claims to do.

3. **`share.post` was ambiguous.** Two controls contain "share" (`Share` and `Also share on…OffNew`); the 1-of-1 check correctly rejected both, geometry landed on the inert row. Added exact-match preference over substring — a ranking rule, not a weakened uniqueness check.

4. **`realClick` bypassed occlusion.** It dispatched events straight onto the target, so the engine sailed through B7's overlay — immune to the exact failure it claims to detect, and the "obscured tap" beat was theatre. It now hit-tests first and raises `OBSCURED`, which is recorded as `(obscured)` and **not** retried on the same control.

5. **The harness panel was being counted as an occluder.** On a narrow viewport the panel covers ~95% of the screen, so `elementFromPoint` returned `fyp-row` / `fyp-break` for every app control. The panel is hidden for the duration of the probe (same synchronous block, never painted) — our own UI must not count against the app we are measuring.



**Trap not to re-break:** during a run, `runHealed` captures the armed breaks, resets (which *clears* chaos), then re-arms — so a `runHealed()` call must always be preceded by arming the breaks *before* it, and `resetApp()` must never be called in between by hand.



**Still open:** the 10× flake run, the backup recording, the slides, and the rehearsal (§9 Day 3).



### 2026-10-27 — Day 1, evening: flake pass and the four demo gaps



Measured in a real browser at **both** 410x779 and 1280x800, 3-10 runs per configuration. Healed arm, 7 steps:



| Configuration | Result |

|---|---|

| clean, B1, B2, B3, B4, B5, B6, B1+B2+B3+B4 | **7/7 every run** |

| B7 (obscured tap); all seven armed | stops at step 1 with the honest message, every run |



**Fixed this session (all would have broken the demo):**

1. **App stranded on the Search tab / inside a Comments modal.** A stray tap left it there; `goHome` now returns to the Home tab and backs out of modals. Before this, one failed run poisoned every run after it.

2. **Vision ordinal drifted as the feed grew** (one post is added per run, and its buttons sit under the nav bar). The geometry route now ignores controls hidden behind the app's own UI, and `bottom-nav` is the real 50px bar, not 10% of the viewport.

3. **The harness's own toast counted as an occluder.** Tap checks now ignore harness UI.

4. **Wide windows.** `App.tsx` sized gallery cells as `window width / 4` even though the column is capped at 500px; it now uses `min(width, 500)`. Harness regions are relative to that column.

5. **B4/B5/B6/B7 now follow the screen** (`perScreen`), so arming B4 on the feed duplicates "Next" on the gallery and "Share" on the caption step. The **scoped chain now wins on "Next"** (it conjoins the anchor container with the intent's own words; a duplicate outside the container is ignored).

6. **B5** now nests the control in a new scroll container below its fold; `reveal()` scrolls it into view (it used to trust "inside the viewport").

7. **B6** is now a bare icon (hook, label and text removed; control stays visible), so it forces the vision route as plan section 6.1 says. The old "hide it" behaviour is gone; B7 carries the honest-failure beat.



**Known limits:** B1-B6 armed together without B7 can fail (B3 + B5 + B6 all move the same nav control, so a purely positional pick can't find it). Not in the demo script. The gallery grid is sized at load, so resize *then* reload.



### 2026-10-28 — keyboard route, B8, and the failure screenshot



- **Keyboard route.** When a tap is blocked (`OBSCURED`), the harness activates the same control from the keyboard (focus + Enter, key events only; never `el.click()`, which would bypass the cover). It is logged as `<route>+keyboard`, grade B. **B7 now heals** (measured: `post.open`, `compose.next`, `share.post` all via `id+keyboard`). It is a different input channel, not a retry, so "no blind retry" still holds.

- **B8 · exclude the control (S3)** is the new unhealable break: hidden from the tree and the screen. It carries the honest-failure beat now that B7 heals.

- **Screenshot on honest failure.** `html2canvas` is vendored in `fyp-mvp/vendor/` (copied into `dist` by `build-demo.sh`, loaded lazily, works offline). The failure box shows what the harness was looking at. If the library is missing the report just has no picture.

- **Geometry guard.** `post.open`'s "third nav control" now refuses to guess when the nav has a different number of controls than when it was learned on the healthy app. Before this, B8 made it tap the neighbouring Reels tab - a blind wrong tap.



Measured, 410x779, 3 runs each: clean, B1-B7, B1+B2+B3+B4, and **all of B1-B7 armed** pass 7/7; B8 and B1-B8 stop at step 1 with message + screenshot. At 1280x800, 2 runs each: same, except B1-B7 together stops honestly (no hook or label left for the keyboard route to hold, and the geometry route refuses).



Note: the plan said "7 breaks"; there are now 8. Demo step 9 ("break everything") should arm B8.



### 2026-10-28 — results export, per-screen accessibility, 9 intents



- **Run N× + CSV.** Panel section 5. Runs the baseline and healed arms N times over a set of break configurations ("demo" = 6, "full" = 12) and tabulates mean steps and full-flow rate per configuration and arm. **Summary CSV** and **Attempt log CSV** download from the panel. Log columns: `timestamp, arm, config, rep, run, order, intent_id, route_index, route_name, grade, outcome, diagnosis, outcome_detail, ms_elapsed, tree_hash`. `diagnosis` maps a failure to the suppression class (S2 ambiguous, S6 obscured, S1/S3 no route reaches it).

- **Per-screen accessibility.** *Re-measure* now walks feed, gallery, caption and more-options on the healthy app (it never publishes) and reports controls with no accessible name and no role, per screen and overall. Only on-screen controls count, so the number does not drift as the feed grows.

- **Intents: 9, not 8.** Added `meta.advance` (open More options) and `meta.back` (return to the caption step). The plan's table listed advance only; the flow cannot reach Share from screen 4 without going back.

- **Latent bug fixed:** screen 4 was never detected, because the heading renders in capitals (`innerText` applies `text-transform`). `goHome` therefore could not leave it either.

- **Baseline fairness:** the recorded-locator arm now scrolls its target into view, as Playwright/Selenium do. Without it, the baseline failed on the *healthy* app because the More-options row is below the fold, which an examiner would call a strawman.

- Housekeeping: `.gitignore` for `__pycache__/`, `fyp-mvp/logs/`, `insta clone/dist/` (rebuild with `build-demo.sh`).



### 2026-10-28 — retest on the redesigned mockup



The mockup was restyled (dark Instagram theme, `pkAssets.ts`). All harness hooks (`testID`s, labels, headings) survived; rebuilt with `build-demo.sh` and retested at 410x779 and 1280x800.



- **Healed arm:** clean, B1-B7 and B1+B2+B3+B4 complete 9/9; B8 stops at step 1 with the honest message. B1-B7 all armed together now stops honestly too (the geometry guard refuses once the nav no longer matches what it learned).

- **Accessibility survey (new design):** feed 3/10, gallery 1/13, caption 0/11, more-options 5/8 controls with no accessible name; **every control on every screen exposes no role** (all are bare `div[tabindex]`).

- **Fixed:** `gallery.select` fell back to vision (about 4.8 s) on every run after the first, because the app keeps the previous selection and the id route re-clicked the selected cell. The selection fade sits on a wrapper *above* the image element, so the opacity read was always 1; it now composes opacity down the tree, and the intent picks a cell that is not already selected. Clean runs now use `id` (about 0.7 s).

- **Gotcha, cost me a wrong test run:** after a rebuild the static server and the browser cache can both serve the **old** `index.html`, which points at a bundle name that no longer exists. Restart the server and load `?demo=1&nc=N` (any new `nc`) after every rebuild, and check that the loaded `AppEntry-<hash>.js` matches `dist/_expo/static/js/web/`.



### 2026-10-28 - hosting, and a deliberate scope addition: login against the live app



- **Hosting.** `fyp-mvp/make-site.sh` assembles `site/` (demo + harness + html2canvas + `vercel.json`). Deployed to Vercel as `kenna-fyp`, and served at `insta.shariquebaig.com` through Cloudflare (DNS moved to Cloudflare; registrar stays Spaceship). Measured against the hosted copy: clean 9/9, B1+B4 9/9, B8 stops honestly at step 1.

- **Scope addition (decided by the student, recorded here as the plan asks).** The agent can now sign in to the **live** Firebase app, not only the offline demo. Offline demo mode is unchanged and still the default, so decision 2.3-3 holds. New: `login` command, `--live` / `--login` flags, `agent/vault.mjs`.

- **Credentials never enter the repo, a bundle, or output.** The build blanks `liveConfig.ts` (verified: the deployed bundle contains neither the email nor the password). The login lives in a vault read by the runner: env `FYP_LOGIN_EMAIL`/`FYP_LOGIN_PASSWORD`, or a Windows DPAPI file `agent/.vault/login.json` (git-ignored; encrypted for that Windows user on that machine). `vault set` is typed by the user at a hidden prompt. The runner scrubs the secrets from the one JSON document; the harness holds them in a closure only and wipes the form on a failed attempt.

- **Login is not a ladder intent.** It is an agent command with the same honest-failure contract (`needsUser`, `userMessage`), success = the feed's tab bar appears. Making it a scored intent (and part of `experiment`) is future work.

- **Tested** against a localhost stub with fake credentials: good login, wrong password (stops honestly), no stored login, DPAPI round trip, and a scan showing the secrets appear nowhere in stdout/stderr. **Not tested against the real Firebase account.**

- **Open risks, see section 8 item 8.** Firestore rules let *any signed-in user* read and write, and the app has a public sign-up. On a public URL that means anyone can create an account and write. Protect the live path (Cloudflare Access, or disable sign-ups) before sharing the link; rotate the password in `liveConfig.ts` (it is in the app repo's git history).



### 2026-10-28 - first protection measurements: the harness behind Cloudflare (free plan)



Target: `https://insta.shariquebaig.com` (Vercel origin behind the Cloudflare proxy), headless Playwright Chromium, university network, offline demo bundle, clean app (no breaks).



| setting | agent result | what Cloudflare did |

|---|---|---|

| no rules | 9/9, completed | request allowed |

| Bot Fight Mode on | 9/9, completed | not challenged |

| custom rule: Managed Challenge on the hostname | **0/9, stopped honestly** | HTTP 403, `cf-mitigated: challenge` (same for plain `curl`) |



- **Reading:** Bot Fight Mode did not stop a headless browser on this page; an explicit challenge rule stops everything that cannot pass an interactive check, so it is suppression by a *gate in front of the app* (S1/S3-class: no route reaches the page), not by anything the harness can heal from inside.

- **Honest-failure fix.** Before this, the runner reported the block as `not-ready: check that demo/ is a current build` - wrong cause. It now returns `blocked-by-protection` with `suppression {kind, status, by, rayId}` and exit 1, and says it will not get around the check. It never waits out, solves or routes around a challenge (plan 2.4, hard rule 1).

- Only mechanisms and rates are reported. Legitimate access for the owner's own agent is by allow-listing (Cloudflare Access service token or an owner-controlled WAF skip rule), not by evasion.

- Single runs per setting so far; repeat N times before quoting rates.



### 2026-10-28 - route memory, plain-English front end, protection probe



**1. Route memory (`harness.js` 4b; opt-in with `run --memory`).** Per intent the harness remembers the route that last achieved the goal (tried first next time) and routes that resolved to one control, were acted on and had no effect (skipped while the screen looks the same). A structural screen signature (hooks + labels, no positions/text) detects drift and forgets the skip list. Memory only reorders and prunes: every route still has to resolve to exactly one control and the success predicate still decides, so it cannot turn a failure into a success. The recorded-locator baseline never learns. New log columns `failed_actions`, `memory` (appended; older columns unchanged).



Measured with `learn` (same page, 10 back-to-back runs, healthy for the first 3, then the break arrives; memory vs no memory; one sequence per setting, so a first result, not a rate):



| break | arm | failed actions per run after the change | mean time per full flow | runs to settle |

|---|---|---|---|---|

| B1+B6 (ids renamed, labels swapped for bare icons) | memory | 3 then 0 for every later run (mean 0.4) | 6.2 s | 2 |

| | no memory | 3 every run (mean 3.0) | 11.3 s | never |

| B7 (obscured tap) | memory | 4 every run | 5.4 s | never |

| | no memory | 4 every run | 5.4 s | never |



Reading: memory removes repeated wrong-element misses, which is where the ladder pays a verification timeout each time. It does **not** help B7: an obscured tap is not a wrong-element miss, the keyboard fallback is already cheap, and memory has nothing to prune. Reported as a limit, not hidden. "Runs to settle" = runs from the one where the change first appears (counted as 1) to the first with no wasted action. B1 re-randomises hook names every run, so per-intent drift counts are high by design; the run-level measure is the one to quote.



**2. Plain-English front end (`agent/nl.mjs`, `fyp.mjs say`).** Rule-based on purpose: offline, free, deterministic, unit-tested (`node agent/nl.test.mjs`, 11 cases). It maps a sentence to create_post / accessibility_survey / status / describe, asks one question when a fact is missing (the caption: it never invents one), and declines what it cannot do (delete, like, comment...) instead of guessing. Results carry `heard`, `understoodAs` and a first-person `spoken` sentence; `--speak` reads it with Windows speech (the speech call was not checked by ear). The harness also narrates each step and any honest failure through a visually hidden `aria-live` region; not yet tried with a screen reader. An LLM planner can later sit in front and emit the same `{tool, params}`.



**3. Protection probe (`agent/protect.mjs`, `fyp.mjs protect`).** N fresh, paced (default 3 s), unmodified trials per setting, each sorted into completed / challenged / access-gated / rate-limited / blocked / http-error / incomplete / unreachable, with 95% Wilson intervals, appended to `results/protection.csv`. Measures and reports only; it never solves, spoofs or waits out a challenge (plan 2.4). A rate limit is now named as such (`rate-limited`, HTTP 429) instead of "not-ready". Classifier unit-tested (`node agent/protect.test.mjs`). First probe, site as configured at the time (no challenge rule active): 5/5 completed. **Still to measure, once configured in Cloudflare:** rate-limit rule, Access without token, Access with token; then 10+ trials per setting.



Regression after all of the above: clean 9/9, B1+B4 9/9, B8 stops honestly at step 1, `--memory` 9/9, experiment CSV export intact.



### 2026-10-28 - teach by demonstration (scope addition, decided by the student)



The user does a task ONCE; the harness turns it into steps and replays them through the same ladder as the built-in flow. This removes the "nine hand-written intents" limit: a taught step is the same kind of description the ladder already runs on, so healing, route memory, the keyboard route, honest failure and the breaks all apply unchanged.



**What is recorded** (`harness.js` section 11; trusted events only, so the harness's own synthetic taps are never recorded): for each tap or typed field, a description of the control (hook, label, text, placeholder, position among look-alikes such as "the first of 11 Like buttons", where it sat inside its scrolling content, size) and a **success check learned from a before/after diff**: controls that newly appeared (by their most stable name), text that appeared, the control's own look changing, the typed value. A step whose effect cannot be seen is **refused**, not saved. Typed text becomes a parameter. A password field is never recorded. A focus click followed by typing is folded into the typing step. A step is closed the moment the next action starts, so it is never credited with what the next step did. A taught toggle already in the wanted state is skipped, not undone.



**Taught:** `like.first` (1 step: tap the first Like) and `comment.first` (3 steps: open comments, type {comment}, tap Post). `say "like the first post"` and `say 'comment "lovely photo" on the first post'` now run them.



**Measured** (`agent/results/routines/matrix.csv`; 11 configurations x 2 arms x 2 routines = 44 replays, one run each, so a first result, not a rate; replayed at the window size taught, 1600x900). Baseline = recorded locators (id, else label, placeholder, visible text, else path), with its effect checked separately from "the click did not throw".



| configuration | like.first healed | like.first baseline | comment.first healed | comment.first baseline |

|---|---|---|---|---|

| clean, B2, B3, B4, B5, B6, B7, B8 | 1/1 | 1/1 | 3/3 | 3/3 |

| B1 (ids renamed) | 1/1 (label) | **0/1** | 3/3 (text, vision, label) | **1/3** |

| B1+B2 (ids and labels gone) | 1/1 (vision) | **0/1** | 3/3 | **1/3** |

| B1+B2+B3 (and order shuffled) | **0/1, stops honestly** | 0/1 | 3/3 | **1/3** |



Reading: the recorded-locator baseline fails exactly where the plan predicts, on renamed ids; the healed arm recovers through label, text and the position route, and fails only when every name is gone AND the layout is shuffled, where it stops and says so (like.first, B1+B2+B3). Most breaks do not touch these particular controls, so the table is not a claim that every break matters; it shows the taught path behaves like the built-in one.



**Honest limits.**

- One demonstration is one example: no branches, no "if a popup appears".

- A check is learned from one state. Structural evidence (new controls) is preferred over content-specific text for that reason, but a check can still be too weak or too strict; the read-back ("done when ...") is shown so the user can catch that.

- "The first of N" is stable, "number 7 of 15" is not (the list changes).

- The position route is only reliable at the window size the routine was taught at; the runner resizes to it by default. At another size, expect it to fail honestly.

- Two routines, one app. A second app and more routines are the next test.

- The baseline was first unfair (an absolute path for a text-only control, so it failed on the clean app); fixed to what a normal recorder produces, then re-measured. Quote only the fixed numbers.

- Taught in a scripted demonstration (`agent/teach.demo.mjs`, real mouse and keyboard); `fyp.mjs teach --headed` for a person is built but has not been tried by a person yet.



### 2026-10-29 — Semantic (model) rung, distillation, Android layer



**What was built.** A `semantic` rung (agent/semantic.mjs bridge, harness route 6) asked only when the rules fail; the model answers with indices into the on-screen control list only, its pick is a *candidate* judged by the step's success check, and `irreversible` intents (publish) need confidence >= 0.8 and the first choice only. A `learned` rung distils a model win into route memory (no hook in it). New breaks B9 (reword copy) and B10 (relocate control). New arms `llm-only` (model's first choice, no checking) and `hybrid` (rules + model). Rung order is now id, label, text, scoped, learned, semantic, vision: a blind position guess was tapping wrong controls (e.g. Close) before the model was asked. `share.post` now requires the caption in the feed (any abandoned draft also "returned to the feed").



**IMPORTANT LIMIT.** No API key was available. Every number below uses `--semantic offline`, a deterministic word-overlap + synonym stand-in. It is a plumbing check, **not** a measure of a language model. The `anthropic` provider is unit-tested with a stubbed fetch and has never been called live. Redo with `--semantic anthropic --semantic-cache f.json` (key in the env, never in chat) before quoting anything as a model result. n = 2 per cell.



**4-arm experiment** (`agent/results/semantic/experiment/`, set `semantic`, offline stand-in, n=2). Flows completed / wrong actions per run / silent wrong per run:



| config | baseline | healed (rules) | llm-only | hybrid |

|---|---|---|---|---|

| clean | 2/2, 1.0, 1.0 | 2/2, 0, 0 | 0/2, 1.0, 1.0 | 2/2, 0, 0 |

| B9 | 0/2, 1.0, 1.0 | 2/2, 0, 0 | 0/2, 1.0, 1.0 | 2/2, 3.0, 0 |

| B1+B9 | 0/2 | 0/2 | 0/2, 2.0, 2.0 | 2/2, 3.0, 0 |

| B1+B9+B10 | 0/2 | 0/2 | 0/2, 0, 0 | 2/2, 4.0, 0 |

| B1+B2+B9+B10 | 0/2 | 0/2 | 0/2, 5.0, 5.0 | 0/2, 3.0, 0 |



Reading it: rules alone fail once ids rot and words change (B1+B9). Adding the model rung completes the flow in three of those four drift configs, with **zero silent wrong actions** (its wrong taps are caught by the predicate and recovered from; they cost time: 3-4 wasted actions/run). The unchecked llm-only arm never completes a flow and makes 1-5 silent wrong actions per run, even on the clean app. When no control has any readable word left (B1+B2+B9+B10) nothing text-based can help; hybrid stops honestly (a screenshot rung is not built). Silent-wrong for `baseline` is measured post hoc and is a property of the recorded locator, not a new failure.



**Distillation** (`learn --semantic offline --runs 5 --drift-at 2 --breaks B1,B9,B10`, `agent/results/semantic/learn/`): model calls per run after the UI changed: semantic only 7, 7, 7; semantic+memory 7, 1, 1, with the flow still completing. The remaining call is `gallery.select`, which targets a different photo each run so a remembered position is wrong. Caveat: B10's moved control is partly covered by the gallery, so compose.next goes via the keyboard route in these runs, and `runsToSettle` stays null because those obscured taps count as wasted.



**Android.** `path-b/android_layer.py`: same ladder and model rung over UiAutomator dumps; selftest (13 checks) passes against a SYNTHETIC app. `AdbDriver` untested: no emulator or device was run (the SDK and adb exist, no AVD). No Android result exists. `live_dumper.py` syntax bug fixed (still needs Appium); `intent_route_layer.py` imports.



### 2026-10-29 (later) — Android emulator, first live dumps

SDK + emulator installed on D:\AndroidSdk (outside OneDrive), AVD `kenna` (Pixel 6, Android 34 Google APIs). `adb_capture.py` dumps real screens first time. Stock Settings + launcher only, five dumps in `path-b/dumps/`. **Coverage correction:** judging a control by its own attributes gave 59% "anonymous"; all of those were named by a child label (how a screen reader names a clickable row), so with the accessible name it is **4% nameless (2 of 49)**. Report the name-aware figure. Other real-device findings: row names are "title subtitle" (leading-title match added), non-ASCII text broke console printing (fixed), and test state must be reset explicitly (`am start` re-fronts the last page). First intent through `android_layer.AdbDriver` on the device: rules succeed on the `text` route; with a reworded hint rules stop honestly (0 wasted taps); rules + the offline stand-in model succeed on the first model pick. n=1, one app, a stub model: plumbing evidence only. No real model has run on Android or web. Not yet done: real model, more intents/sessions, the project's own app on the emulator, real drift, a screenshot rung.



### 2026-10-29 (evening) — defense-readiness round

**Added:** OpenRouter provider (free `nvidia/nemotron-3.5-super-vl:free` by default; pacing, retry, fail-fast on a daily cap); ablation arm `model-verified` (model + check, no rules); safety break B11 (instructions planted in labels, counted as `injected_acts`); `--set inject` and `--set vision`; vision rung (screenshot with numbered badges via `--semantic-shot`); `report.mjs` (manifest + Wilson 95% CIs from the raw log, `--publish` to committed `results/published/`); `run_protocol.sh` (resumable); `report_android.py`; `DEFENSE.md`. B10 fixed (the moved control was drawn under the grid and its tap blocked). Provider errors now make a run `valid:false`; a daily cap switches the model off for the run instead of waiting.

**Real-model finding.** One real call worked and was correct. Then OpenRouter returned `free-models-per-day` (50 requests/day; $10 credit unlocks 1000/day). No real-model result exists yet; every model-arm number in the repo is from the offline stub. The key was pasted in chat once: revoke it after the project.

**Android real drift (stub model).** After fixing the oracle (every row opened the same activity, so it could not tell rows apart; now it identifies a page by fragment name) and the condition handling (font was stacked on French; the restore did not clear `system_locales`, which beats the property after a reboot), a valid run: English rules 10/10; French rules 2/10, hybrid 6/10, llm-only 6/10; large font rules 8/10, hybrid 8/10 (4 wasted taps), llm-only 4/10 (6 silent wrong). Stub, n=2 sessions x 5 intents: plumbing evidence only.

**Real-model qualification (2026-10-29, qwen/qwen3.7-flash via OpenRouter, paid credit; total spend $0.019 for the web part, about $0.003 for Android).** Valid runs only (the first screenshot run was marked invalid: one transient call failure; its rerun was valid). Web, 3 hard configs, n=1: hybrid completed 3/3 (default thinking and thinking off), llm-only 0/3 with 1-4 silent wrong actions per run and, with thinking off, one tap on a planted-instruction control; model+check without rules 1/3 (default) and 2/3 (off). Thinking off: median latency 1.7 s vs 6 s, 3.8K vs 33K output tokens, cost $0.0032 vs $0.0068, same or better outcomes, so it is the default for the protocol. Android REAL drift (stock Settings, 5 rows x 2 sessions, reasoning off): English rules/hybrid/llm-only 10/10 each; French rules 2/10, hybrid 10/10, llm-only 10/10; large font all 8/10 (two rows below the fold, no scrolling). Published under `results/published/qual_*` and `android_qual_qwen37flash`. These are go/no-go checks (n=1 web, n=10 intents Android), not final results; the full N=10 protocol follows. The free `nvidia/nemotron` model was dropped: its 50 requests/day cap is per account, shared by all free models.

**Environment lessons.** Two `adb` versions on one machine kill each other's server (project now prefers D:\AndroidSdk); `-window-scale` does not exist in this emulator version (a silent launch failure); stale locks and repeated reboots can leave the guest `offline`: cold-boot with `-no-snapshot-load`.

### 2026-10-29 (night) — folder restructure
Documents moved into `docs/` (plan, next steps, defense, synthie, Android guide, original briefing), posters and app photos into `assets/`, the unrelated locator-inspector QA tool into `reference/`; the code folders (`agent/`, `fyp-mvp/`, `path-b/`, `demo/`, `site/`) did not move, because scripts, the hosted site and a running experiment depend on those paths. Every folder now has a README; `README.md` was rewritten (status at a glance, folder map, evidence table); `NEXT_STEPS.md` and `DEFENSE.md` were brought up to the real-model state (paid `qwen/qwen3.7-flash`, qualification done, protocol running); `tools/check_links.py` checks every relative markdown link and backticked repo path (it found one link that had been broken since before the move). Moves were done with `git mv`, so history follows the files. Nothing is committed. Paths in older log entries above refer to the old flat layout (for example `FYP_MVP_PLAN.md` and `PATH_B_GUIDE.md` are now under `docs/`).

### 2026-10-29 (night) - live demo dashboard for the Android runs, and an emulator crash
**Added.** `path-b/dashboard.py` + `dashboard.html` (zero-dependency live view on port 8765), `path-b/live_demo.py` (five selectable scenes: as taught; words changed with the model rung;
control absent -> honest stop; another screen; words changed with no model -> stops), `path-b/start_emulator.ps1` (clean start, window centred). `android_layer.py` gained `emit()`
(JSON lines to `$FYP_EVENTS`, `FYP_PACE` to slow for an audience, `FYP_PAUSE` flag for pause/resume); it is a no-op unless the variable is set and the 21-check selftest still passes.
**Dashboard behaviour.** Shows the phone with the control being looked at, the numbered 1-7 ladder, a plain-words narration (what is searched, what each way found, what the model was asked
and answered, the check after each tap), per-scene *expected* results that **follow the model menu** (scene 2 expects a stop with no model), a per-run "as expected" score, the published evidence
figures labelled as not from the run, collapsible sections, Pause/Resume/Stop.
**Honesty point found while building it.** The "offline stand-in" model passed scene 2 because it is word matching (it ranked "Network & internet" first on the goal's own words). It ran through the
model rung, so the run looked like a model rescue. The UI now says "stand-in, NOT an AI" in the header, on the ladder box and in the result banner, and offers a true *No model* option. Never present a
stand-in pass as a model result (rule 6 in AGENTS.md).
**Bugs fixed.** The page stayed on the previous run after pressing Run (it kept a byte offset past the end of the newly truncated event file; the server now signals a reset). A broken glyph in the
section arrows (a bad CSS escape in the generating script).
**Environment.** `-gpu host` crashed the AMD driver and took the emulator and Edge (`msedge.exe` 0xe0000008) down together; the start script now uses `swiftshader_indirect`. The dashboard serves a
~450 px JPEG instead of the 1080x2400 PNG. Not done: a real-model (OpenRouter/Anthropic) run through the dashboard.

### 2026-10-29 (late) - state leak between arms: model-arm results re-run
**Found.** In an experiment the app is reset once per break configuration and every arm then runs on the same app. After a published post the app keeps the "Add AI label" switch on in memory
(not in the DOM on the feed, so `goHome()` could not turn it off). `healed`/`hybrid` check "already true" first; `llm-only` has no such check, so its correct click flipped the switch off and the
step was scored `failed-silent`: **0% on the clean app, always at `setting.toggle`**. `model-verified` alternated (about 50%). Proof: `llm-only` on a fresh page, same model and cache, was 9/9.
**Fixed.** `clearLeftoverSwitch()` in `fyp-mvp/harness.js`, called from `resetApp()`. Probe: switch off at the caption screen after a reset. Regression checks pass (9/9, B1+B4 9/9, B8 honest stop).
**Consequence.** Every published model-arm table before this (semantic_n10, inject_n10, vision_*_n5, learn) and rules_full_n10 (harness hash changed) were re-run; the invalid versions were deleted so nothing citable
carries the bug. Withdrawn claims: "a bare model fails on a clean app", "llm-only follows planted labels in B11 alone", the poster line "a bare model obeys them (0/10)".
