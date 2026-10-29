# fyp-mvp/ - the product

| file | what it is |
|---|---|
| `harness.js` | **the product** (about 3,700 lines, one file, injected into the app page). Source of truth; the runner serves it live and `site/fyp-harness.js` is a build copy |
| `build-demo.sh`, `sync-demo.sh` | rebuild the app (`../insta clone/`) and copy the bundle into `../demo/` (only when the app source changed) |
| `make-site.sh` | build `../site/` (demo + harness) for Vercel; rerun and redeploy after ANY change to `harness.js` |
| `vendor/` | `html2canvas` (vendored so failure screenshots work offline) |
| `logs/` | git-ignored runtime logs |

## Inside `harness.js` (section numbers are in the file's own comments)
1. control model (what counts as a control) - 2. screens and regions - 3. **the intent model** (9 intents, each with a success predicate) -
4. **the ladder**: `id`, `label`, `text`, `scoped`, `learned`, `semantic`, `vision` (geometry); a route only counts when it matches exactly one control -
4b. route memory (drift detection, distilling a model answer into a `learned` route) - 5. acting (hit-testing, keyboard fallback) -
6. the session log and scoreboard - 7. running the flow, the baseline arm, the model-only arm (`runLlmOnly`) -
8. **breaks B1-B11** - 9. accessibility measurement - 10. the panel - 11. public surface and **teaching** (`teachSuggest`) -
12. **agent API** (`window.__FYP_AGENT`: `runFlow`, `runIntent`, `experiment`, `teach.*`, `semantic.*`, `memory.*`).

Rules that must hold after any edit (also in `../../AGENTS.md`): `node --check fyp-mvp/harness.js`, `node agent/semantic.test.mjs`, a clean `run`
and `run --breaks B1,B4` give 9/9, and `run --breaks B8` stops honestly at step 1. The model may only answer with indices into the on-screen list.
