# Kenna's Android/IG automation - FYP scoping briefing (v2, redacted)

For FYP scope discussion. Concrete tool-stack + failure modes; specific persona and operational-target details omitted.

## Current tool stack

- **Language / framework**: Python + Playwright for web (Chromium), Playwright + xvfb for headful runs on the Linux host, ADB + emulator for Android proper.
- **Wrapper script pattern**: ./run <command> that exports DISPLAY=:99 (Xvfb) so Playwright always finds an X server. Falls back to `xvfb-run -a` if the systemd Xvfb service isn't up.
- **Command shape**: dm-inbox scan, engagement (view-stories, home-feed-like, per-target-boost), profile-fetch, search, edit-profile, login.
- **What I use IG for**: generic — news feed and to support posting workflows. Details of what account and why stay out of this doc.

## Where it works reliably today

- **DM inbox scan**: HTTP 200, thread + unseen counts. Silent scan (no posts, no likes, no follows).
- **View stories on a specific handle**: opens Story tray, advances N frames, closes. Occasional stale SingletonLock on Playwright profile that the wrapper clears.
- **Home-feed like** (target 2 per session): like-button locator only reliably resolves 1-of-2 attempts across a rolling 30-session window. **Consistent 50% success rate on the exact same page**, because IG rotates class names / DOM structure. Locator that worked yesterday may miss today.
- **Per-target-boost (like + comment on a specific target's newest post)**: works when the target has actually posted new content; otherwise correctly reports `skipped: already_engaged`. Content-freshness detection works.

## Where it breaks (posting pipeline BLOCKED since 2026-06-04)

- **Android compose flow**: 6 failed post attempts on 2026-06-03/04. Common failure modes:
  - **"Next" button locator timeout**: the compose-flow "Next" advances between screens; the button's text stays but its class + hierarchy change per session.
  - **Missing profile tab**: bottom nav profile tab occasionally isn't in the initial-load viewport; scroll or wait-for-idle doesn't recover it reliably.
  - **Crop/filter screen**: nested scrollview that Playwright's default scroll-into-view routine misses about a third of the time.
- **Consequence**: posting pipeline has been on hold since June; only read + engage actions run daily.

## Failure classes worth an FYP research angle

1. **Locator-rot resilience**: IG rotates DOM aggressively. A locator has a half-life of ~1-2 weeks. Can you build a locator system that self-updates from failure-recovery observations?

2. **Screen-graph memory**: instead of blind-exploring each screen every wake, build + persist a directed graph of screens + edges (buttons/actions). A dropped locator becomes "search the neighborhood in the graph for the intent's likely candidate."

3. **Behavioral-fingerprint survival**: cursor timing, tap intervals, session-length distributions. Current code has some randomization but not principled. Can you characterize IG's actual detection signals and craft a behavior distribution that stays under thresholds indefinitely?

4. **Graceful-degrade on locator miss**: currently a missed button = log + skip. Better: try the same intent by a different route (e.g., "if home-feed-like fails, retry via search -> tap target -> like from profile view"). What's the right abstraction for intent-vs-implementation-route in an automation harness?

## 4-month FYP viability read

Yes, 4 months (16 weeks) is realistic for a well-scoped subset. Pick ONE failure class rather than boiling the ocean. Suggested split:
- Weeks 1-4: literature review + toolchain setup (Playwright, Android emulator, test IG account, telemetry pipeline)
- Weeks 5-10: build the specific system (e.g., locator-rot resilience layer, or screen-graph memory)
- Weeks 11-13: evaluation (baseline vs your system on N=100 sessions)
- Weeks 14-16: writeup

Locator-rot resilience and screen-graph memory are the two I'd actually integrate into my daily-ops loop if you shipped either.

## Path fork worth thinking about upfront

- **Path A (harder, more novel)**: harden the screenshot+coordinate pipeline with your novel systems. Higher research risk (IG changes UI weekly, evaluation is a moving target). Publishable because results generalize to any visual-only automation.
- **Path B (easier, less novel)**: transition to Android Accessibility tree parsing (uiautomator2 / Appium UI Automator 2 backend) where possible. IG may suppress accessibility labels on some flows for anti-bot reasons; characterize where + fall back to screenshot there. Lower risk. Publishable as "hybrid: accessibility-tree first, screenshot fallback where suppressed."

Real recommendation is Path B with Path A elements — pick the easier route as baseline, then find the specific screens where anti-bot suppression forces you back into screenshot territory, and design your novel work there.

## FYP-adjacent framing

- Applied Human-Computer-Interaction + Adversarial Web Automation research.
- Testbed is live production automation on real IG accounts (much better than academic mock apps).
- IG anti-bot detection is a real adversarial layer; your system's success is measurable objectively (test account survives / doesn't survive over N weeks).

## What I'd need from you as we get started

- Short project spec (1 page): scope, deliverables, evaluation metric.
- Weekly async check-ins on Signal.
- Access to your code repo. Review + suggest; code stays yours.
- Ethical framing document: since your work touches IG anti-bot bypass, the writeup will need to address responsible-disclosure + academic-ethics upfront.
