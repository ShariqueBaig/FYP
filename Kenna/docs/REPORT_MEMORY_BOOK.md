# REPORT_MEMORY_BOOK - everything needed to write the FYP report

Purpose: one page of context for whoever writes (or helps write) the final report. It is a summary with pointers, not a second source of truth. Every number lives in a
file under `results/published/`; copy numbers from there, never from here. Rules for agents are in [`../../AGENTS.md`](../../AGENTS.md); the full guide is [`../README.md`](../README.md).

## 1. The project in one paragraph
Kenna is **intent-aware, self-healing GUI automation for accessible AI assistants** (Sharique Baig, Maira Aijaz, Barkhi Khan, IBA). Some people cannot tap, swipe or
read a screen the usual way, so an assistant does it for them. Apps keep changing (buttons renamed, reworded, moved) and assistants then break, or tap the wrong thing and
say nothing. Kenna takes a **goal** ("show me my most listened songs", "post a photo with caption hello"), finds the right control through a ladder of ways, **checks
the next screen to confirm the step really worked**, and when it cannot finish it **stops and tells the user in plain words** instead of failing silently.

## 2. The motivating use: ease of use, not tricks
The report should frame the work around **what a user wants to get done**, in apps they already have an account for.

| user says | what the assistant does on the user's behalf |
|---|---|
| "Tell me my most listened songs" | opens the music app, goes to the stats/profile screen the user can already see, reads the list aloud |
| "Post this photo with caption hello" | walks the create-post screens the user could tap themselves, publishes only when sure |
| "Turn on large text" | finds the setting in Settings, flips it, confirms it is on |
| "Like the first post" | taps the like control, confirms the count or icon changed |

**Honest scope note (put this in the report):** only the post flow (mock app) and stock Android Settings were actually run. The music-app example is a *motivating
scenario*, not a tested result; do not present it as measured.

## 3. Positioning: what makes this an assistive tool and not a bot
Use this wording (adapted from the defense notes):

> Kenna is distinguished by **purpose, authorization and behavior**, not by mechanism. It acts only inside the user's own signed-in session, on their own device, doing
> only what that user is already permitted to do, one goal at a time at human pace. It does not hide what it is, does not try to look like a person, and does not
> work around a site's protections. When something blocks it, it stops and tells the user.

Points to make, each true of the build:
- **Same permissions as the user.** No extra access, no bulk collection, no other people's accounts. The login is typed by the human into a local vault and never shown to the assistant or the model.
- **Terms of service.** The design aim is that every action is one the user could do by hand in the same app. Say that the team did not review each target app's terms; that is the user's and deployer's responsibility, and apps that forbid assistants should be left alone.
- **Transparent, not stealthy.** The assistant narrates what it does and what it is unsure about, and has a voice mode (`--speak`) for users who cannot see the screen.
- **Stops instead of forcing.** If a control cannot be found with certainty, or a step's check fails, it halts (exit code 1, "needs the user") and says why. Irreversible actions (publishing) need high confidence and the first choice only.
- **A model is a helper, never a boss.** It can only point at controls that are really on screen; its pick is judged by the same success check as everything else.
- **Accessibility law context.** Disability and accessibility rules (for example ADA/Section 508, the EU Accessibility Act, local disability acts) push apps to work with assistive technology. This is context, not legal advice; the legal status of AI agents under those exemptions is still unsettled, so state it as a limitation.

**Deliberately left out of the report narrative:** anything about outsmarting anti-bot systems, fingerprinting, or planted-instruction attacks. The repo still contains some of that
tooling (the `protect` command, break B11, `demo_adversarial.mjs`, `POSTER_PHASE2.md`), but it only measures and reports, and it is not part of the user-benefit story. Nothing was deleted from the repo.

## 4. How it works (for the method chapter)
1. **Intents, not locators.** A step is "tap the share control", with a success predicate (what must be true on the next screen).
2. **The ladder** of routes: id, label, text, container, remembered (learned), model (semantic), position. A route counts only if it matches **exactly one** control.
3. **Verify after every action.** A tap that changed nothing counts as wrong; the next route is tried. "No exception" is never success.
4. **Honest stop.** Nothing works, so it says so in plain words (with a screenshot).
5. **Route memory.** A model's correct answer is remembered, so the next run does not need to ask again.
6. **Arms used in experiments:** `baseline` (recorded script), `healed` (rules ladder), `llm-only` (bare model), `model-verified`, `hybrid` (rules + model + checks).
7. **Plain-English front end** (`say`), **taught routines** (the human does a task once; it learns steps and checks; never records passwords), **voice feedback**.

Code: `fyp-mvp/harness.js` (product), `agent/semantic.mjs` (model bridge), `path-b/` (Android). See [`../fyp-mvp/README.md`](../fyp-mvp/README.md) and [`../path-b/README.md`](../path-b/README.md).

## 5. Evidence to cite (status words matter)
| claim | result | folder |
|---|---|---|
| C1 recorded script breaks under UI change, ladder survives | N=10, 12 configs; ladder 100% [72-100] on clean and most single drifts; script 0% [0-28] on several; both stop honestly on the unreachable-control config | `results/published/rules_full_n10/` |
| C2 model rung heals drift the rules cannot read | real model `qwen/qwen3.7-flash`, N=10; rules 0% on three drifted configs, hybrid 100% [72-100] on four | `results/published/semantic_n10_qwen37flash/` |
| C3 verification stops silent wrong actions | bare model 0% completed on every config, 1.0-4.4 silent wrong actions per run; hybrid 0 silent | same folder |
| C6 real drift on Android (French, large font) | French: rules 20% [6-51], hybrid 100% [72-100]; large font 8/10 all arms (nothing scrolls yet) | `results/published/android_qual_qwen37flash/` |
| C7 accessibility gap | 2% of controls nameless once inner labels count (78% by own attributes alone) | `path-b/dumps/sessions/` |
| C8 works on a real device | 18/18 on an emulator, stock Settings | `path-b/` live tests |
| C5 remembering cuts model calls | stub only; real-model run pending | `NEXT_STEPS.md` |

Quote with model id, N, and `valid: yes`. Never quote `--semantic offline` numbers as a model's. Repetitions use temperature 0 plus a cache, so they measure app/harness variation, not model sampling variation. Details and exact wording: [`DEFENSE.md`](DEFENSE.md).

Planted-instruction results (C4, B11) are safety testing of the model layer; mention in one sentence at most ("the model can only name on-screen controls and every pick is checked"), or omit.

## 6. Limitations to state (they will be asked)
One mock web app plus stock Android Settings; one real model; hand-written success checks; no user study with screen-reader users; nothing runs on real third-party apps (Instagram, Spotify, banking are untested);
nothing scrolls yet on Android; Android drift covers language and font only; position fallback is the weakest route; legal status of agents acting for a user is unsettled.

## 7. Suggested report outline
1. Introduction: who cannot use touch UIs, what goes wrong today (silent failures)
2. Related work: self-healing locators (Healenium, Testim), screen readers and TalkBack, LLM GUI agents; the gap is verified, user-protective failure ([`DEFENSE_PREP.md`](DEFENSE_PREP.md) has prior art with sources)
3. Design principles: user's own session, same permissions, transparent, stop-and-tell (section 3 above)
4. Method: intents, ladder, verification, model as candidate generator, memory
5. Implementation: harness, Android layer, voice, taught routines
6. Evaluation: C1, C2/C3, C6, C7, C8 with intervals; threats to validity
7. Discussion: ease-of-use scenarios, legal and ethical position, accessibility law context
8. Limitations and future work ([`NEXT_STEPS.md`](NEXT_STEPS.md))
9. Conclusion

## 8. Existing report material (check before rewriting)
`../report/main.tex` (final report source; `build.sh`, generated tables and figures via `build_tables.py` and `build_figures.py`), `../report_m1/m1_proposal.tex` (milestone 1),
`DEFENSE_SCRIPT.md`, `DEFENSE_PREP.md`, `GLOSSARY.pdf`, `FYP_MVP_PLAN.md` (dated log, section 15). This book has not been diffed against `main.tex`; do that before pasting anything.

## 9. Words to keep consistent
**intent** (goal plus success check), **route** (one way to find a control), **ladder** (ordered routes), **drift** (the app changes underneath), **honest stop**, **silent wrong action** (acted on the wrong control and did not notice),
**hybrid** (rules + model + checks), **arm**, **valid** (no failed model calls). Authors' names and the demo link: see [`../README.md`](../README.md).
