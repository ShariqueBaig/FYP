# Android results

## Android Settings suite (6 intents; 'stale' drift is SIMULATED on the intent side)

- model: **offline-lexical STUB**   sessions: 3   valid: yes
- **The model is the offline word-overlap STUB, not a language model. Do not quote these as a model result.**

| arm | flows ok (95% CI) | wasted taps | silent wrong | model calls |
|---|---|---|---|---|
| exact | 18/18 = 100% [82-100] | 0 | 0 | 0 |
| stale | 0/18 = 0% [0-18] | 0 | 0 | 0 |
| hybrid | 12/18 = 67% [44-84] | 9 | 0 | 24 |
| llm-only | 12/18 = 67% [44-84] | 3 | 3 | 24 |

## Android Settings REAL drift (system language / font scale; success judged by page identity, not words)

- model: **offline-lexical STUB (English only)**   sessions: 2   valid: yes
- **The model is the offline word-overlap STUB, not a language model. Do not quote these as a model result.**

| condition | arm | intents ok (95% CI) | wasted taps | silent wrong | model calls |
|---|---|---|---|---|---|
| en | rules | 10/10 = 100% [72-100] | 0 | 0 | 0 |
| en | hybrid | 10/10 = 100% [72-100] | 0 | 0 | 0 |
| en | llm-only | 6/10 = 60% [31-83] | 4 | 4 | 10 |
| fr | rules | 2/10 = 20% [6-51] | 0 | 0 | 0 |
| fr | hybrid | 6/10 = 60% [31-83] | 0 | 0 | 8 |
| fr | llm-only | 6/10 = 60% [31-83] | 0 | 0 | 10 |
| font | rules | 8/10 = 80% [49-94] | 0 | 0 | 0 |
| font | hybrid | 8/10 = 80% [49-94] | 4 | 0 | 2 |
| font | llm-only | 4/10 = 40% [17-69] | 6 | 6 | 10 |

Units are single intents (one tap-level task) over sessions, not whole flows; sessions are repeated on one emulator image, so they show device/app variation only.
