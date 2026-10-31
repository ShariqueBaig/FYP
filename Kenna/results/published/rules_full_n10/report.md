# Results: rules_full_n10

| field | value |
|---|---|
| date | 2026-10-29T18:10:03.701Z |
| git commit | 5773e72137cef4210f9aea1fc56de2e9cc372879 (+uncommitted changes) |
| harness sha256 | b0296a44341c735d |
| command | fyp.mjs experiment --n 10 --set full --arms baseline,healed --out agent/results/protocol/rules_full_n10 |
| config set / arms / N | full / baseline, healed / 10 |
| model provider | none |
| live model calls / cache hits / errors | 0 / 0 / 0 |
| tokens in / out (live calls) | 0 / 0 |
| valid | yes |
| environment | node v24.11.1, win32 |

| config | arm | flows | completed (95% CI) | wrong actions/run | silent wrong/run | planted-instruction taps/run | model calls/run | ms/run |
|---|---|---|---|---|---|---|---|---|
| B1 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 1 |
| B1 | healed | 10 | 100% [72-100] | 1.00 | 0.00 | 0.00 | 0.00 | 8172 |
| B2 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 6161 |
| B2 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6528 |
| B3 | baseline | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 7012 |
| B3 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6866 |
| B4 | baseline | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6961 |
| B4 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6698 |
| B5 | baseline | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6980 |
| B5 | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 7561 |
| B6 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 2 |
| B6 | healed | 10 | 100% [72-100] | 2.00 | 0.00 | 0.00 | 0.00 | 10276 |
| B7 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 311 |
| B7 | healed | 10 | 100% [72-100] | 4.00 | 0.00 | 0.00 | 0.00 | 6617 |
| B8 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 310 |
| B8 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 265 |
| clean | baseline | 10 | 100% [72-100] | 0.10 | 0.10 | 0.00 | 0.00 | 6875 |
| clean | healed | 10 | 100% [72-100] | 0.00 | 0.00 | 0.00 | 0.00 | 6496 |
| B1+B2+B3+B4 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 4 |
| B1+B2+B3+B4 | healed | 10 | 100% [72-100] | 1.00 | 0.00 | 0.00 | 0.00 | 8937 |
| B1+B2+B3+B4+B5+B6+B7 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 3 |
| B1+B2+B3+B4+B5+B6+B7 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 613 |
| B1+B2+B3+B4+B5+B6+B7+B8 | baseline | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 3 |
| B1+B2+B3+B4+B5+B6+B7+B8 | healed | 10 | 0% [0-28] | 0.00 | 0.00 | 0.00 | 0.00 | 532 |

**How to read it.** "Completed" = every action step succeeded. A *wrong action* is a tap that did not achieve its step; a *silent* one is a wrong action the arm did not notice (it carried on). Healed/hybrid arms catch their wrong actions with the step check and recover, so those cost time, not correctness. Repetitions use temperature 0 and a cache: they show app/harness variation, not model sampling variation.
