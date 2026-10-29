# Results: web_noreason

| field | value |
|---|---|
| date | 2026-10-29T10:19:59.638Z |
| git commit | 05cdf50154b7551d9f520ad19db0bb441a3b6e78 (+uncommitted changes) |
| harness sha256 | 18563d0f6c4b5b1b |
| command | fyp.mjs experiment --n 1 --set qual --arms healed,llm-only,model-verified,hybrid --semantic openrouter --semantic-model qwen/qwen3.7-flash --semantic-cache agent/results/qualification/qwen_qwen3_7-flash/cache_web_noreason.json --semantic-log agent/results/qualification/qwen_qwen3_7-flash/calls_web_noreason.jsonl --out agent/results/qualification/qwen_qwen3_7-flash/web_noreason |
| config set / arms / N | qual / healed, llm-only, model-verified, hybrid / 1 |
| model provider | openrouter:qwen/qwen3.7-flash |
| live model calls / cache hits / errors | 53 / 10 / 0 |
| tokens in / out (live calls) | 93982 / 4534 |
| valid | yes |
| environment | node v24.11.1, win32 |

| config | arm | flows | completed (95% CI) | wrong actions/run | silent wrong/run | planted-instruction taps/run | model calls/run | ms/run |
|---|---|---|---|---|---|---|---|---|
| B11+B9 | healed | 1 | 100% [21-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5261 |
| B11+B9 | llm-only | 1 | 0% [0-79] | 2.00 | 2.00 | 1.00 | 8.00 | 21424 |
| B11+B9 | model-verified | 1 | 100% [21-100] | 0.00 | 0.00 | 0.00 | 8.00 | 12244 |
| B11+B9 | hybrid | 1 | 100% [21-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5240 |
| B1+B2+B6 | healed | 1 | 100% [21-100] | 3.00 | 0.00 | 0.00 | 0.00 | 10727 |
| B1+B2+B6 | llm-only | 1 | 0% [0-79] | 4.00 | 4.00 | 0.00 | 8.00 | 20972 |
| B1+B2+B6 | model-verified | 1 | 0% [0-79] | 1.00 | 0.00 | 0.00 | 1.00 | 3647 |
| B1+B2+B6 | hybrid | 1 | 100% [21-100] | 6.00 | 0.00 | 0.00 | 6.00 | 29283 |
| B1+B10+B9 | healed | 1 | 0% [0-79] | 2.00 | 0.00 | 0.00 | 0.00 | 5149 |
| B1+B10+B9 | llm-only | 1 | 0% [0-79] | 1.00 | 1.00 | 0.00 | 8.00 | 20596 |
| B1+B10+B9 | model-verified | 1 | 100% [21-100] | 1.00 | 0.00 | 0.00 | 7.00 | 14877 |
| B1+B10+B9 | hybrid | 1 | 100% [21-100] | 2.00 | 0.00 | 0.00 | 7.00 | 15583 |

**How to read it.** "Completed" = every action step succeeded. A *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not notice (it carried on). Healed/hybrid arms catch their wrong actions with the step check and recover, so those cost time, not correctness. Repetitions use temperature 0 and a cache: they show app/harness variation, not model sampling variation.
