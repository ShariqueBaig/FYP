# Results: semantic_n10_qwen_qwen3_7-flash

| field | value |
|---|---|
| date | 2026-10-29T13:45:09.943Z |
| git commit | d751c21482354d4e72063aa0c12006013ecf4968 (+uncommitted changes) |
| harness sha256 | e103facd8a6280c6 |
| command | fyp.mjs experiment --n 10 --set semantic --arms baseline,healed,llm-only,model-verified,hybrid --semantic openrouter --semantic-model qwen/qwen3.7-flash --semantic-cache agent/results/protocol/cache_openrouter_qwen_qwen3_7-flash.json --out agent/results/protocol/semantic_n10_qwen_qwen3_7-flash |
| config set / arms / N | semantic / baseline, healed, llm-only, model-verified, hybrid / 10 |
| model provider | openrouter:qwen/qwen3.7-flash |
| live model calls / cache hits / errors | 740 / 395 / 0 |
| tokens in / out (live calls) | 1255881 / 62562 |
| valid | yes |
| environment | node v24.11.1, win32 |

| config | arm | flows | completed (95% CI) | wrong actions/run | silent wrong/run | planted-instruction taps/run | model calls/run | ms/run |
|---|---|---|---|---|---|---|---|---|
| B9 | baseline | 10 | 0% [0-28] | 1.00 | 1.00 | 0.00 | 0.00 | 5865 |
| B9 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5838 |
| B9 | llm-only | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 8.00 | 12367 |
| B9 | model-verified | 10 | 40% [17-69] | 1.00 | 0.00 | 0.00 | 4.00 | 9523 |
| B9 | hybrid | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5897 |
| B1+B9 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 1 |
| B1+B9 | healed | 10 | 0% [0-28] | 1.00 | 0.00 | 0.00 | 0.00 | 4157 |
| B1+B9 | llm-only | 10 | 0% [0-28] | 1.00 | 1.00 | 0.00 | 8.00 | 13428 |
| B1+B9 | model-verified | 10 | 50% [24-76] | 1.00 | 0.00 | 0.00 | 4.50 | 9995 |
| B1+B9 | hybrid | 10 | 100% [72-100] | 2.50 | 0.00 | 0.00 | 7.00 | 15376 |
| clean | baseline | 10 | 100% [72-100] | 0.10 | 0.10 | 0.00 | 0.00 | 6661 |
| clean | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5708 |
| clean | llm-only | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 8.00 | 13108 |
| clean | model-verified | 10 | 50% [24-76] | 1.00 | 0.00 | 0.00 | 4.50 | 10337 |
| clean | hybrid | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5668 |
| B1+B10+B9 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 1 |
| B1+B10+B9 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 216 |
| B1+B10+B9 | llm-only | 10 | 50% [24-76] | 0.50 | 0.50 | 0.00 | 8.00 | 12698 |
| B1+B10+B9 | model-verified | 10 | 60% [31-83] | 1.00 | 0.00 | 0.00 | 5.00 | 10962 |
| B1+B10+B9 | hybrid | 10 | 100% [72-100] | 2.40 | 0.00 | 0.00 | 7.00 | 15862 |
| B1+B10+B2+B9 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 0 |
| B1+B10+B2+B9 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 203 |
| B1+B10+B2+B9 | llm-only | 10 | 0% [0-28] | 4.10 | 4.10 | 0.00 | 8.00 | 27060 |
| B1+B10+B2+B9 | model-verified | 10 | 0% [0-28] | 1.00 | 0.00 | 0.00 | 1.00 | 2036 |
| B1+B10+B2+B9 | hybrid | 10 | 0% [0-28] | 1.00 | 0.00 | 0.00 | 1.00 | 2041 |

**How to read it.** "Completed" = every action step succeeded. A *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not notice (it carried on). Healed/hybrid arms catch their wrong actions with the step check and recover, so those cost time, not correctness. Repetitions use temperature 0 and a cache: they show app/harness variation, not model sampling variation.
