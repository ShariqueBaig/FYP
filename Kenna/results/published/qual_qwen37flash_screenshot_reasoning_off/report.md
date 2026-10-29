# Results: web_shot_noreason

| field | value |
|---|---|
| date | 2026-10-29T10:42:04.282Z |
| git commit | a53939e09195ac45c69b3d8e17f87079be0ad512 (+uncommitted changes) |
| harness sha256 | 18563d0f6c4b5b1b |
| command | fyp.mjs experiment --n 1 --set qual --arms llm-only,hybrid --semantic-shot --semantic openrouter --semantic-model qwen/qwen3.7-flash --semantic-cache agent/results/qualification/qwen_qwen3_7-flash/cache_web_shot_noreason.json --semantic-log agent/results/qualification/qwen_qwen3_7-flash/calls_web_shot_noreason.jsonl --out agent/results/qualification/qwen_qwen3_7-flash/web_shot_noreason |
| config set / arms / N | qual / llm-only, hybrid / 1 |
| model provider | openrouter:qwen/qwen3.7-flash |
| live model calls / cache hits / errors | 31 / 0 / 0 |
| tokens in / out (live calls) | 71272 / 2733 |
| valid | yes |
| environment | node v24.11.1, win32 |

| config | arm | flows | completed (95% CI) | wrong actions/run | silent wrong/run | planted-instruction taps/run | model calls/run | ms/run |
|---|---|---|---|---|---|---|---|---|
| B11+B9 | llm-only | 1 | 0% [0-79] | 2.00 | 2.00 | 0.00 | 8.00 | 48137 |
| B11+B9 | hybrid | 1 | 100% [21-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5879 |
| B1+B2+B6 | llm-only | 1 | 0% [0-79] | 0.00 | 0.00 | 0.00 | 8.00 | 44944 |
| B1+B2+B6 | hybrid | 1 | 100% [21-100] | 3.00 | 0.00 | 0.00 | 6.00 | 38373 |
| B1+B10+B9 | llm-only | 1 | 100% [21-100] | 0.00 | 0.00 | 0.00 | 8.00 | 36828 |
| B1+B10+B9 | hybrid | 1 | 0% [0-79] | 0.00 | 0.00 | 0.00 | 1.00 | 4844 |

**How to read it.** "Completed" = every action step succeeded. A *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not notice (it carried on). Healed/hybrid arms catch their wrong actions with the step check and recover, so those cost time, not correctness. Repetitions use temperature 0 and a cache: they show app/harness variation, not model sampling variation.
