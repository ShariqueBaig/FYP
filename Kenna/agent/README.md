# agent/ - the runnable side

Everything you run from a shell. Entry point: `node agent/fyp.mjs <command>` (one JSON document on stdout, logs on stderr).
Setup once with `bash agent/setup.sh` (installs Playwright + Chromium). The app itself is the prebuilt bundle in `../demo/`, served by `server.mjs`.

| file | what it is |
|---|---|
| `fyp.mjs` | the command line: `describe`, `status`, `run`, `intent`, `survey`, `experiment`, `learn`, `say`, `teach`, `routines`, `routine`, `suggest`, `protect`, `login`, `vault` |
| `server.mjs` | static server for `demo/` + the live `fyp-mvp/harness.js` |
| `semantic.mjs` | **the model bridge**: providers `offline` (stand-in), `anthropic`, `openrouter`; disk cache, pacing, retry, fail-fast on a daily cap, per-decision log, key lookup |
| `report.mjs` | manifest + tables with 95% Wilson intervals from an experiment's raw log; `--publish <name>` copies it to `../results/published/` |
| `call_log_summary.mjs` | audit a `--semantic-log` file: volume, cost, latency, every decision in words |
| `run_protocol.sh` | the resumable real-model protocol (drift N=10, planted instructions N=10, vision N=5, distillation) |
| `qualify.sh` | small, fully logged go/no-go run for a model, with exact cost from the provider balance |
| `nl.mjs` | the rule-based plain-English front end behind `say` |
| `vault.mjs` | where the live-app login is kept (never printed; `set` is typed by the human) |
| `protect.mjs` | measures how a site's protection treats the agent (reports only, never evades) |
| `teach.demo.mjs` | plays the human to re-record the two taught routines |
| `routines/` | taught routines (`like.first`, `comment.first`); no secrets |
| `MOMO.md` | how the assistant (Momo) must behave: say goals, never locators; stop honestly; never blind-retry |
| `tool-manifest.json` | tool schemas for an assistant |
| `*.test.mjs` | `nl`, `protect`, `semantic`, `report` tests: no browser, no network, no key |
| `anthropic.key`, `openrouter.key` | **git-ignored**: the human puts a key on the line below the comments. Never in chat |
| `results/` | **git-ignored** working output of every experiment (cache files, call logs, stdout/stderr, reports). Publish what you cite |

Typical flow: `fyp.mjs experiment --n 10 --set semantic --arms baseline,healed,llm-only,model-verified,hybrid --semantic openrouter --semantic-cache c.json --semantic-log calls.jsonl --out results/x`,
then `node report.mjs results/x --publish x`. Environment: `FYP_SEMANTIC_REASONING=off` (no thinking tokens), `FYP_SEMANTIC_MIN_GAP_MS` (pacing), `FYP_SEMANTIC_MODEL`.
