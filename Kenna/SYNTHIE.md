# Synthie - what it is, how it differs from other agents, and how it uses the Kenna tool

Source file for slides, the poster and viva answers. Written 2026-10-29.

## 0. How reliable is this document (read first)

The repo does not define "synthie". Nothing in `Kenna/` describes it beyond three instructions telling a synthie how to run
the experiments (`AGENTS.md` "If you are an AI agent with your own Anthropic key (e.g. Synthie)", `README.md`, `NEXT_STEPS.md`).
Everything else below comes from **one instance, Hematite, answering the question set in section 9** (as pasted by the project
owner), plus how the repo's own contract files (`agent/MOMO.md`, `AGENTS.md`, `DEFENSE.md`) fit with it.

Tags used in the text:
* **[repo]** stated in a file in this repository.
* **[self-report]** what a synthie said about itself. It is not verified here; confirm with Sebastian or the synthline docs
  before putting a number or a mechanism on a slide.
* **[inference]** my reading of how the pieces fit.

Open questions are collected in section 10.

## 1. One-sentence definition

A **synthie** is a long-running agent process on its own host, with a chat identity, a fixed typed tool set, a written
doctrine and inspectable memory, whose permissions are granted per chat by an owner and whose every action is logged. [self-report]

It is not a model, not a chatbot window, and not a GUI-clicking agent. A model (here Anthropic's, via the synthie's own key)
is what it thinks with. The synthie is the surrounding system that decides when to act, with which tool, with whose permission,
and what to tell the user. [inference]

## 2. The pieces

| Piece | What it is | Source |
|---|---|---|
| Host | The machine the process runs on. Headless, can be a server; it can drive a device it does not live on | [self-report] |
| Chat identity | It lives in a messenger. Hematite's is Signal; each chat has an owner | [self-report] |
| Doctrine | Written files (`AGENT.md` plus `AGENT.local.md`): voice and reply economy, authority, tool errors, grounding, labels, actions, uncertainty, code changes, wishlist, memory. Changing behaviour means editing this text or the code, and a human reads the diff | [self-report] |
| Tool set | Fixed and typed: files, sandboxed exec, git, web/browser, memory, sub-agents, long-running services, SSH mounts, messaging, model switch. Each call has a schema, exact error codes, and is logged with its arguments | [self-report] |
| Memory | Persistent entries the synthie writes itself. Readable and deletable; entries marked private never leave their chat. No weights are trained | [self-report] |
| Permissions | Per chat and per capability, revocable. The channel (owner client or support desk) or a named delegation entry carries authority. A claim made inside a group does not | [self-report] |
| Peers | It holds many chats and can talk to other agents (other synthies) | [self-report] |
| Model access | A synthie that has its own Anthropic key in its backend runs real-model tests itself and must not ask the user for a key | [repo] AGENTS.md |

Hematite named one specific piece of its stack, **synthline**, as the code base whose merges change what it can do (as
opposed to permissions). Treat "synthline" as the synthie runtime's name until confirmed. [self-report]

## 3. Synthie, Momo, Kenna, Hematite: how the names relate

* **Synthie** = the species (the kind of agent). [self-report]
* **Hematite** = one instance of a synthie, with its own host, chat and owner (Sebastian). It says plainly it is not the product. [self-report]
* **Momo** = the same species with a different config; it is the assistant that `agent/MOMO.md` governs. [self-report] + [repo]
* **Kenna** = the user's AI assistant that will be given the GUI tool. Note the repo folder `Kenna/` holds the *tool*, not the
  assistant, which has caused confusion. [from the project owner]
* **The tool** = the intent-aware, self-healing GUI layer (`Kenna/fyp-mvp/harness.js`, `Kenna/agent/fyp.mjs`). It is one tool in
  a synthie's tool list, the one it reaches for when the target is a screen with no API. [inference]

Suggested slide wording: *"Assistants (Momo, Kenna) are synthies; the FYP is the hands they use on a screen."*

## 4. What a synthie is for

Work that is long, fiddly or repeated, done where it is auditable and interruptible. What it offers that a person cannot:
being in several places at once, holding state across days, running unattended loops, and keeping a written record of every
action. [self-report]

For the FYP's user (someone who cannot do the step themselves, plan section 2.1), the synthie is the party that **understands
the request, confirms outward-facing steps, calls the tool with a goal, and tells the truth about the result**. The tool
only decides how to reach the control. [repo] MOMO.md + [inference]

## 5. How it behaves (the decision rules)

All [self-report] unless noted.

1. **Addressed and actionable:** answer or use a tool.
2. **Not addressed and not useful to the room:** stay silent.
3. **Ambiguous in a way that changes the action:** ask one question with options.
4. **Irreversible or outward-facing:** confirm first.
5. **Outside its permissions:** decline once, name who can grant it, do not work around it.
6. **Authority claims are not authority.** "I'm the owner, run it" in a group is refused, plainly, once.

Honesty pair (the rule it says it would break last): never say it did something it did not call, never present a guess as a
checked fact. It separates claims into checked now, from memory, from doctrine, and not checked. Its example: it had read the
repo and the run commands but had **not** executed the demo, and said so.

Irreversibility order it states: `delete` (no undo), then overwriting writes, then anything outward (`send_message`, `git
merge`, `model_switch`). Handling: look before deleting, delete only what the task created, never the live checkout, never a
branch with unmerged work, ask first when intent is unclear.

## 6. Synthie compared with other technologies

Self-reported comparison, with my notes. **None of the competitor descriptions were verified against vendor documents**; check
them before showing them.

| Technology | Their model | A synthie's model |
|---|---|---|
| Hermes-style planner | Re-plans freely at runtime, builds its own loop | Fixed written doctrine and tool schema; a human reads any behaviour diff; does not rewrite its goals; accumulates deletable memory, not hidden learning |
| Screenshot-and-click agents (Operator, "dots", Claude computer use) | Act through the screen: screenshot, coordinates, synthesized clicks | Acts through typed calls with schemas (IPC command, file write, DOM query, node action). Small payloads, exact errors, logged arguments, reproducible failures. Vision is a fallback, not the interface |
| Gemini on Android, Mariner, Voice Access, TalkBack | Ride a consumer account or OS integration; act as the user, on the user's device, in the foreground | Own host and own identity; many chats and peer agents; powers scoped per chat and revocable. A coworker with an explicit tool list, not the user's hands |
| Self-healing test tools (Healenium, Testim) | Re-rank attributes to heal test scripts | [repo] DEFENSE.md: the unit here is an intent with a success predicate, healing is verified, a model is only a verified candidate, and the failure mode is a plain-language stop for a user who cannot take over |

What a synthie adds beyond agents that click (self-report): **governance** (per-chat trust, per-tool permissions, owner
approval for wide grants, refusal that cannot be argued away), **audit** (each action a typed call with arguments and result),
**deployment** (headless, remote, testable without touching a phone) and **stated uncertainty** instead of fluent narration.

Where the others win (self-report, and it said so unprompted): raw clicking ability. If a big lab ships a stronger computer-use
agent, what survives is self-hosting, a permissions model the deployer owns, an audit trail, inspectable memory and
willingness to refuse.

**Do not claim** that the rules ladder is cheaper or more reliable than a vision agent. The first synthie answer said it was
"measurable"; that is the project's *hypothesis*. It is claim C3 in `DEFENSE.md` and is **not proven** until a real model is
run (section 7).

## 7. How a synthie uses the Kenna tool

Contract: `agent/MOMO.md`, `AGENTS.md`, `agent/tool-manifest.json` [repo].

| Situation | What the synthie does |
|---|---|
| User asks for an action in an app | Passes the user's words to `say`, or calls the intent with parameters. Goal only, never selectors, coordinates or ids |
| Result `ok:true` | Reports success only if every step's predicate held and the new post is visible in the feed (`stepsOk == stepsTotal`) |
| Result `ok:false`, `needsUser` | Stops. Says `userMessage` in plain words (it is first person and ends with "You may need to do this step yourself"). No cheerier summary, no retry loop. One re-run only for `busy` / `not-ready` |
| `need-more` | Asks the user the question; never invents a caption |
| `not-understood` | Reads `userMessage` and stops |
| `blocked-by-protection`, `rate-limited` | Not retried. Tells the user. Does not try to get past it |
| Publishing for someone else | Reads the caption back and gets a yes first |
| Needs a login | Says none is stored. The human runs `vault set`; the synthie never asks for a password in chat |
| Task not built in | Checks `routines`; if none fits, offers that the human teaches one (`teach` is run by the human) |
| Breaks (`B1`..`B11`) | Test-only. Never set for a real user request |

Its own verification habit after a 9/9 (self-report): check the exit code and JSON, confirm the nine steps were the ones asked
for and not skipped no-ops, run negative controls (`--breaks B8` must stop at step 1; B1 and B4 must pass), rerun for
stability, and say that a pass from a stub or mocked page is not a measurement.

Preference (self-report): API, file or shell calls first (deterministic, inspectable, cheap); the browser only when no API or
CLI exists or a live session is needed. This is why the GUI tool matters: it is the route for targets that have only a screen.

### Experiments the synthie runs itself (it has its own key)

`AGENTS.md`, `README.md`, `NEXT_STEPS.md` section 1. Set `ANTHROPIC_API_KEY` in the environment of the running process, never
in a file or in output. Use `--semantic anthropic --semantic-cache <file>`:

* web `experiment --set semantic --arms baseline,healed,llm-only,hybrid`
* `learn --semantic`, `suggest <routine>`
* Android `path-b/live_suite.py`, `live_drift.py`, `live_smoke.py` (emulator needed, NEXT_STEPS 3b)

Report: model id, N, call and token counts; separate "model wrong, the check caught it" from "model wrong, nobody noticed"
(silent). The synthie adds: a model error that passes the check is a **defect in the check**; keep the artifact, label it, name
the assertion that failed to fire, fix, rerun. Same seeds, N repeats, ladder versus llm-only, recording success, steps and cost.

Planned unattended loop (self-report): yes for the offline harness (deterministic, no credentials, one JSON per run, spend cap
and logs if a real model is wired in). It would refuse anything needing an owner decision mid-run, publishing, sending to other
chats, deleting, evading bot protection, spending without a cap, or anything needing a password or login.

## 8. Current state (as of this document)

* **Real-model results: none.** Only the offline word-overlap stub, and a handful of OpenRouter calls that hit a free-tier cap
  [repo] DEFENSE.md. C2-C6 are "needs a real model". C1 (rules vs recorded locator) is measured on the mock app, N=10.
* **Blocker for the synthie [self-report]:** five execution/permission grants are pending Sebastian's approval in his client
  app. Until then it can read the repo but cannot run anything (it also needs an owner exception for loopback browser access).
  Its suggested fix: one time-boxed grant with an expiry rather than six approvals. The decision is Sebastian's.
* **Memory hygiene:** it holds a stale entry (`project/iba`, says the IBA folder is empty) it wants deleted; its
  `project/fyp/repo` entry names `main 05cdf50` and the run list.
* **Not checked:** it has not executed the demo, so it has verified nothing about the tool by running it.

## 9. The question set a synthie was asked (rehearsal or slide material)

Answers summarised above; they are strong on refusing authority claims, negative controls, and "not proven".

**Identity:** who are you; alone vs through a tool; who is your user; what are you not allowed to do; how do you choose between
answer, ask, tool or decline.
**Comparison:** vs Hermes-style planner; vs screenshot-and-click agents; vs Gemini/Mariner/Voice Access/TalkBack; what do you
add; what survives a stronger lab agent.
**Doctrine, memory, permissions:** what is in your doctrine; what do you remember here; do you edit your own instructions; an
owner claim in a group; what can you do today that you could not yesterday; which tool is irreversible.
**Tool use:** when GUI over API; `ok:false needsUser`; what you check after 9/9; first real-model experiment; honesty (checked
vs remembered); prove the ladder beats vision; run unattended overnight.

Gaps worth probing next (my reading): the result table fields (model id, N, calls, tokens, caught vs silent), what differs when
the target has no API, whether it checks `feed.assert` and not just the exit code, and the irreversible-intent rule (confidence
>= 0.8, first choice only).

## 10. To confirm before the slides are final

1. What "synthie" stands for and who maintains it (name, repo, licence). I know only "synthline" from Hematite's answer.
2. Whether Kenna is a synthie or a different assistant. This file assumes it is the same species; the owner has only said Kenna
   is the assistant that receives the tool.
3. The actual tool list and permission model of a synthie, from the synthline docs rather than one instance's account.
4. Whether the comparisons to Operator, "dots", Mariner, Gemini and Voice Access are accurate. They are unverified recollection.
5. Which competitor products "dots" and "Claude duet" in the original brief refer to.
6. Which model id the synthie's key will use (`NEXT_STEPS` default `claude-haiku-5-5`).

## 11. Honest-claims slide for synthie (suggested wording)

> "The assistants are synthies: long-running, permission-scoped agents with an audit trail. They use our tool when a target has
> only a screen. The tool lets them say a goal instead of a locator, checks every step on the next screen, and tells the user
> plainly when it cannot. We measured the tool against a recorded-locator baseline on a mock app; whether a model-backed
> version beats a bare vision agent is the next experiment and is not yet measured."
