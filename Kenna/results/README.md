# results/ - committed evidence

> The model-arm results from before the 2026-10-29 state-leak fix (see `docs/FYP_MVP_PLAN.md` section 15) were invalid and have been deleted; `semantic_n10`, `inject_n10` and
> `vision_*_n5` below are the re-runs on the fixed harness.

Working output of experiments goes to the git-ignored `agent/results/` (`path-b/results/` holds earlier **stub-model** Android runs, tracked and labelled STUB, not citable as model results). **What you cite goes here**, via
`node agent/report.mjs <dir> --publish <name>` (web) or `python path-b/report_android.py <json> --out results/published/<name>/report_android.md` (Android).
Each folder holds the raw log (`results.json`, `attempt-log.csv`, `calls.jsonl` when a model was used), a `manifest.json`
(git commit, harness hash, model, call counts, `valid`) and a `report.md` / `report.csv` regenerated from the raw log. Nothing is typed by hand.

| folder | what | model | N | valid |
|---|---|---|---|---|
| `published/semantic_n10_qwen37flash/` | **C2/C3**: drift configs x 5 arms (baseline, healed, llm-only, model-verified, hybrid) | `qwen/qwen3.7-flash` (OpenRouter), thinking off | 10 flows per cell (partly duplicates: temperature 0 + cache) | yes |
| `published/rules_full_n10/` | **C1**: recorded script vs ladder over 12 break configurations | none | 10 flows per cell | yes |
| `published/qual_qwen37flash_reasoning_default/` | go/no-go: 3 hard configs, 4 arms, thinking tokens on | `qwen/qwen3.7-flash` (OpenRouter) | 1 | yes |
| `published/qual_qwen37flash_reasoning_off/` | same, thinking tokens off (the setting used afterwards) | same | 1 | yes |
| `published/qual_qwen37flash_screenshot_reasoning_off/` | llm-only vs hybrid with a screenshot and numbered badges | same | 1 | yes |
| `published/android_qual_qwen37flash/` | Android Settings: stale-hint suite and **real drift** (French / large font), plus every model decision | same | 5 rows x 2 sessions per cell | yes |

How to read any report: *completed* = every action step succeeded; a *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not
notice (it carried on). Intervals are 95% Wilson. Repetitions use temperature 0 and a cache, so they show variation in the app and harness, not model sampling variation.
A report whose header says **valid: NO** had model calls fail and must not be quoted. A header that says STUB used the offline word-overlap stand-in, which is not a language model.

Not published (invalid or superseded): the first screenshot run (one transient call failure), and every stub-model run.
