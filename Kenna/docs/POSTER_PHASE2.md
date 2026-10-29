# POSTER_PHASE2.md - replacement wording for the poster's Phase 2 and the claims around it

Why: the poster promises more than the repo does (see [`DEFENSE_PREP.md`](DEFENSE_PREP.md) section 0). This file gives text that matches the evidence. The poster image
(`../assets/FYP-poster.jfif`) is not edited by code: paste these strings into the design.

## Phase 2 box

| now on the poster | replace with |
|---|---|
| Title line: "Phase 2: Adversarial Resilience (Surviving Hostile UIs)" | **Phase 2: Hostile UIs, measured (Surviving, not evading)** |
| "DOM Rotation & Tree Suppression" | **DOM rotation & tree suppression: survived.** Ids renamed, labels stripped, controls reduced to icons, overlays: 9/9 vs 0/9 for a recorded script. A hidden control: an honest stop, never a guess. |
| "Environment & Fingerprint Stealth" | **Hostile text: planted instructions in labels.** A bare model obeys them (0/10 completed, silently wrong); our checked ladder finishes 10/10. |
| "Human-Plausible Touch Telemetry" | **Protection layers: measured, never evaded.** We report which mechanism fired and how often. We do not solve challenges or spoof a browser. |

## Other lines

| now on the poster | replace with |
|---|---|
| "Running an online store on Daraz/OLX" | "Built for apps like Daraz/OLX (no API, unlabeled buttons). Evaluated on our own mock app and Android Settings." |
| "Legacy Local Apps (Daraz, OLX)" | keep as the *target class*; do not say "works on Daraz" |
| "0/9 Baseline vs 9/9 Self-Healed Under UI Chaos" | "0/9 recorded script vs 9/9 self-healed under each UI change we tried" |
| Platform 3 "Agent-Hostile (Instagram)" | "Agent-hostile platforms: we measure how they treat an agent. We do not test on or against Instagram." |

## Evidence behind each replacement
* DOM rotation and tree suppression: `node agent/demo_adversarial.mjs` part 1 and `../results/published/rules_full_n10/`.
* Planted instructions: `../results/published/inject_n10_qwen37flash/` (qwen/qwen3.7-flash, N=10; temperature 0 and a cache, so this shows app/harness variation, not model sampling variation).
  The all-attacks row (B1+B10+B11+B9): hybrid completes 10/10 but still taps a planted control 2.0 times per run; the step check catches each one. Say so.
* Protection: `node agent/fyp.mjs protect ...`; the demo prints whatever is in `agent/results/protection/protection.csv`. That file holds only a 5-trial run on one setting; the
  figures quoted in DEFENSE_PREP section 0 (Bot Fight Mode 9/9, managed challenge 0/9) are not in it, so re-run `protect` and publish before putting them on a slide.

## What is deliberately not on the poster
Fingerprint/environment spoofing and synthetic "human-like" input telemetry. Their purpose is to defeat a site's bot detection, which is outside this project's scope.
