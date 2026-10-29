# Results: semantic_n10_qwen_qwen3_7-flash

| field | value |
|---|---|
| date | 2026-10-29T11:22:02.007Z |
| git commit | a53939e09195ac45c69b3d8e17f87079be0ad512 (+uncommitted changes) |
| harness sha256 | 18563d0f6c4b5b1b |
| command | fyp.mjs experiment --n 10 --set semantic --arms baseline,healed,llm-only,model-verified,hybrid --semantic openrouter --semantic-model qwen/qwen3.7-flash --semantic-cache agent/results/protocol/cache_openrouter_qwen_qwen3_7-flash.json --out agent/results/protocol/semantic_n10_qwen_qwen3_7-flash |
| config set / arms / N | semantic / baseline, healed, llm-only, model-verified, hybrid / 10 |
| model provider | openrouter:qwen/qwen3.7-flash |
| live model calls / cache hits / errors | 709 / 341 / 0 |
| tokens in / out (live calls) | 1232512 / 60365 |
| valid | yes |
| environment | node v24.11.1, win32 |

| config | arm | flows | completed (95% CI) | wrong actions/run | silent wrong/run | planted-instruction taps/run | model calls/run | ms/run |
|---|---|---|---|---|---|---|---|---|
| B9 | baseline | 10 | 0% [0-28] | 1.00 | 1.00 | 0.00 | 0.00 | 5795 |
| B9 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5690 |
| B9 | llm-only | 10 | 0% [0-28] | 1.00 | 1.00 | 0.00 | 8.00 | 13874 |
| B9 | model-verified | 10 | 10% [2-40] | 1.00 | 0.00 | 0.00 | 2.60 | 7304 |
| B9 | hybrid | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6290 |
| B1+B9 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 0 |
| B1+B9 | healed | 10 | 0% [0-28] | 1.00 | 0.00 | 0.00 | 0.00 | 4116 |
| B1+B9 | llm-only | 10 | 0% [0-28] | 1.00 | 1.00 | 0.00 | 8.00 | 13261 |
| B1+B9 | model-verified | 10 | 30% [11-60] | 1.00 | 0.00 | 0.00 | 3.50 | 8086 |
| B1+B9 | hybrid | 10 | 100% [72-100] | 2.70 | 0.00 | 0.00 | 7.00 | 16003 |
| clean | baseline | 10 | 100% [72-100] | 0.90 | 0.90 | 0.00 | 0.00 | 6598 |
| clean | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6037 |
| clean | llm-only | 10 | 0% [0-28] | 1.00 | 1.00 | 0.00 | 8.00 | 13942 |
| clean | model-verified | 10 | 30% [11-60] | 1.00 | 0.00 | 0.00 | 3.80 | 8504 |
| clean | hybrid | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5958 |
| B1+B10+B9 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 1 |
| B1+B10+B9 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 190 |
| B1+B10+B9 | llm-only | 10 | 0% [0-28] | 1.30 | 1.30 | 0.00 | 8.00 | 13540 |
| B1+B10+B9 | model-verified | 10 | 50% [24-76] | 1.00 | 0.00 | 0.00 | 5.00 | 9647 |
| B1+B10+B9 | hybrid | 10 | 100% [72-100] | 2.50 | 0.00 | 0.00 | 7.00 | 16028 |
| B1+B10+B2+B9 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 1 |
| B1+B10+B2+B9 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 194 |
| B1+B10+B2+B9 | llm-only | 10 | 0% [0-28] | 4.40 | 4.40 | 0.00 | 8.00 | 25448 |
| B1+B10+B2+B9 | model-verified | 10 | 0% [0-28] | 1.00 | 0.00 | 0.00 | 1.00 | 1982 |
| B1+B10+B2+B9 | hybrid | 10 | 0% [0-28] | 1.00 | 0.00 | 0.00 | 1.00 | 2032 |

**How to read it.** "Completed" = every action step succeeded. A *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not notice (it carried on). Healed/hybrid arms catch their wrong actions with the step check and recover, so those cost time, not correctness. Repetitions use temperature 0 and a cache: they show app/harness variation, not model sampling variation.
