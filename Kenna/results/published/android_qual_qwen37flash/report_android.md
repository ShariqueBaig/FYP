# Android results

## Android Settings suite (6 intents; 'stale' drift is SIMULATED on the intent side)

- model: **openrouter:qwen/qwen3.7-flash**   sessions: 1   valid: yes

| arm | flows ok (95% CI) | wasted taps | silent wrong | model calls |
|---|---|---|---|---|
| exact | 6/6 = 100% [61-100] | 0 | 0 | 0 |
| stale | 0/6 = 0% [0-39] | 0 | 0 | 0 |
| hybrid | 6/6 = 100% [61-100] | 0 | 0 | 8 |
| llm-only | 6/6 = 100% [61-100] | 0 | 0 | 8 |

## Android Settings REAL drift (system language / font scale; success judged by page identity, not words)

- model: **openrouter:qwen/qwen3.7-flash**   sessions: 2   valid: yes

| condition | arm | intents ok (95% CI) | wasted taps | silent wrong | model calls |
|---|---|---|---|---|---|
| en | rules | 10/10 = 100% [72-100] | 0 | 0 | 0 |
| en | hybrid | 10/10 = 100% [72-100] | 0 | 0 | 0 |
| en | llm-only | 10/10 = 100% [72-100] | 0 | 0 | 10 |
| fr | rules | 2/10 = 20% [6-51] | 0 | 0 | 0 |
| fr | hybrid | 10/10 = 100% [72-100] | 0 | 0 | 8 |
| fr | llm-only | 10/10 = 100% [72-100] | 0 | 0 | 10 |
| font | rules | 8/10 = 80% [49-94] | 0 | 0 | 0 |
| font | hybrid | 8/10 = 80% [49-94] | 0 | 0 | 2 |
| font | llm-only | 8/10 = 80% [49-94] | 0 | 0 | 10 |

Units are single intents (one tap-level task) over sessions, not whole flows; sessions are repeated on one emulator image, so they show device/app variation only.
