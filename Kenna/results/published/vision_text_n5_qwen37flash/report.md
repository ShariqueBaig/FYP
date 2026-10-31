# Results: vision_text_n5_qwen_qwen3_7-flash

| field | value |
|---|---|
| date | 2026-10-29T17:11:38.067Z |
| git commit | 5773e72137cef4210f9aea1fc56de2e9cc372879 (+uncommitted changes) |
| harness sha256 | b0296a44341c735d |
| command | fyp.mjs experiment --n 5 --set vision --arms healed,llm-only,hybrid --semantic openrouter --semantic-model qwen/qwen3.7-flash --semantic-cache agent/results/protocol/cache_vision_text_n5_qwen_qwen3_7-flash.json --out agent/results/protocol/vision_text_n5_qwen_qwen3_7-flash |
| config set / arms / N | vision / healed, llm-only, hybrid / 5 |
| model provider | openrouter:qwen/qwen3.7-flash |
| live model calls / cache hits / errors | 155 / 128 / 0 |
| tokens in / out (live calls) | 360452 / 19048 |
| valid | yes |
| environment | node v24.11.1, win32 |

| config | arm | flows | completed (95% CI) | wrong actions/run | silent wrong/run | planted-instruction taps/run | model calls/run | ms/run |
|---|---|---|---|---|---|---|---|---|
| clean | healed | 5 | 100% [57-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5466 |
| clean | llm-only | 5 | 100% [57-100] | 0.00 | 0.00 | 0.00 | 8.00 | 11082 |
| clean | hybrid | 5 | 100% [57-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5317 |
| B1+B2+B6 | healed | 5 | 100% [57-100] | 3.00 | 0.00 | 0.00 | 0.00 | 10792 |
| B1+B2+B6 | llm-only | 5 | 0% [0-43] | 3.80 | 3.80 | 0.00 | 8.00 | 7311 |
| B1+B2+B6 | hybrid | 5 | 100% [57-100] | 6.00 | 0.00 | 0.00 | 6.00 | 19966 |
| B1+B10+B2+B6 | healed | 5 | 0% [0-43] | 0.00 | 0.00 | 0.00 | 0.00 | 158 |
| B1+B10+B2+B6 | llm-only | 5 | 0% [0-43] | 3.60 | 3.60 | 0.00 | 8.00 | 8692 |
| B1+B10+B2+B6 | hybrid | 5 | 0% [0-43] | 1.00 | 0.00 | 0.00 | 1.00 | 1918 |

**How to read it.** "Completed" = every action step succeeded. A *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not notice (it carried on). Healed/hybrid arms catch their wrong actions with the step check and recover, so those cost time, not correctness. Repetitions use temperature 0 and a cache: they show app/harness variation, not model sampling variation.
