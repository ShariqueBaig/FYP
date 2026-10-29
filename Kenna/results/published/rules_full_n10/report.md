# Results: rules_full_n10

| field | value |
|---|---|
| date | 2026-10-29T09:33:35.024Z |
| git commit | 05cdf50154b7551d9f520ad19db0bb441a3b6e78 (+uncommitted changes) |
| harness sha256 | 56efc30ee6e285d6 |
| command | fyp.mjs experiment --n 10 --set full --arms baseline,healed --out agent/results/protocol/rules_full_n10 |
| config set / arms / N | full / baseline, healed / 10 |
| model provider | none |
| live model calls / cache hits / errors | 0 / 0 / 0 |
| tokens in / out (live calls) | 0 / 0 |
| valid | yes |
| environment | node v24.11.1, win32 |

| config | arm | flows | completed (95% CI) | wrong actions/run | silent wrong/run | planted-instruction taps/run | model calls/run | ms/run |
|---|---|---|---|---|---|---|---|---|
| B1 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 0 |
| B1 | healed | 10 | 100% [72-100] | 1.00 | 0.00 | 0.00 | 0.00 | 7335 |
| B2 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 5766 |
| B2 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 5571 |
| B3 | baseline | 10 | 100% [72-100] | 1.00 | 1.00 | 0.00 | 0.00 | 6596 |
| B3 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6350 |
| B4 | baseline | 10 | 100% [72-100] | 1.00 | 1.00 | 0.00 | 0.00 | 6598 |
| B4 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6297 |
| B5 | baseline | 10 | 100% [72-100] | 1.00 | 1.00 | 0.00 | 0.00 | 6599 |
| B5 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 7129 |
| B6 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 0 |
| B6 | healed | 10 | 100% [72-100] | 2.00 | 0.00 | 0.00 | 0.00 | 9320 |
| B7 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 308 |
| B7 | healed | 10 | 100% [72-100] | 4.00 | 0.00 | 0.00 | 0.00 | 5540 |
| B8 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 307 |
| B8 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 182 |
| clean | baseline | 10 | 100% [72-100] | 1.00 | 1.00 | 0.00 | 0.00 | 6580 |
| clean | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6024 |
| B1+B2+B3+B4 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 0 |
| B1+B2+B3+B4 | healed | 10 | 100% [72-100] | 1.00 | 0.00 | 0.00 | 0.00 | 7803 |
| B1+B2+B3+B4+B5+B6+B7 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 0 |
| B1+B2+B3+B4+B5+B6+B7 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 318 |
| B1+B2+B3+B4+B5+B6+B7+B8 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 0 |
| B1+B2+B3+B4+B5+B6+B7+B8 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 307 |

**How to read it.** "Completed" = every action step succeeded. A *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not notice (it carried on). Healed/hybrid arms catch their wrong actions with the step check and recover, so those cost time, not correctness. Repetitions use temperature 0 and a cache: they show app/harness variation, not model sampling variation.
