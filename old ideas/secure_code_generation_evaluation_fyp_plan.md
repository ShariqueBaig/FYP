# Rethinking Secure Code Generation Evaluation: A Full FYP Continuation Plan

**Project type:** Final Year Project / undergraduate research in software engineering and AI security  
**Primary domains:** Secure software engineering, LLM code generation, program analysis, software testing, benchmark design, empirical software engineering, application security  
**Recommended scope:** Reproduce a focused subset, improve ground truth and combined metrics, add dynamic validation, and release a reproducible evaluation harness  
**Source study:** *Rethinking the Evaluation of Secure Code Generation*, accepted at ICSE 2026

---

## 1. Executive verdict

### Is this a good FYP topic?

**Yes, provided the project does not merely rerun the original benchmark with different models.** The source study already performs a broad comparison of four secure-generation techniques, seven code models, three static analyzers, and two LLM-based vulnerability judges. It also introduces a combined security-functionality metric and reports that many security methods damage functional correctness. The paper is an ICSE 2026 study rather than an unfinished poster idea, so a continuation needs a narrower but clearly new methodological contribution [1][2].

A strong FYP should address what remains unresolved:

> **How can secure code generation be evaluated with reliable vulnerability ground truth, executable security tests, partial-functionality measurement, cost awareness, and robustness to benchmark, scanner, prompt, and model changes?**

### Recommended continuation

Build a **ground-truth-driven, dynamic and multi-signal evaluation framework** for secure code generation. The framework should:

1. run functional unit tests and security-specific executable tests on the same generated program;
2. use static analyzers as evidence, not unquestioned ground truth;
3. manually validate a statistically justified sample of findings and misses;
4. separate insecure, nonfunctional, instruction-violating, uncompilable, and irrelevant outputs;
5. compare combined metrics, including Secure-Pass@k, the source paper's SAFE@k, and transparent alternatives;
6. evaluate robustness across seeds, prompts, languages, vulnerability classes, and model versions;
7. publish an evaluation harness, item cards, and an error-analysis taxonomy.

This transforms the project from “which model scores highest?” into a study of **whether the evaluation itself is trustworthy**.

---

## 2. What was the research purpose?

The source paper argues that secure code generation must satisfy two requirements simultaneously:

- **Functionality:** the generated code implements the requested behavior.
- **Security:** the generated code does not contain the target vulnerability.

The authors identify two problems in earlier evaluation practice:

1. Functionality and security are often measured on different datasets, then reported separately.
2. Security is often judged using a single static analyzer, especially CodeQL, whose rules do not cover every weakness or every instance of a weakness.

Their purpose was therefore to determine whether claimed security improvements remain useful when security and functionality are evaluated on the **same generated code**, and whether scanner choice changes the security conclusion. The arXiv abstract explicitly says that prior work commonly separates security-related datasets from general functionality datasets and relies mainly on CodeQL, which limits security evaluation [1].

---

## 3. What did the researchers do?

## 3.1 Secure-generation techniques

They evaluated four methods described in the poster:

- **SVEN:** fine-tuning-based security hardening;
- **SafeCoder:** instruction tuning/fine-tuning for secure generation;
- **CodeGuard+:** constrained decoding at inference;
- **PromSec:** iterative prompt optimization.

These represent three broad intervention families:

1. change the model;
2. change decoding;
3. change the prompt.

## 3.2 Code-generation models

The experiment included five open models and two commercial APIs, as stated in the poster:

- CodeLlama-7B;
- Qwen2.5-Coder-7B;
- DeepSeek-Coder-V2 Lite;
- Mistral-7B;
- StarCoder-1B;
- GPT-3.5-Turbo;
- GPT-4o.

## 3.3 Datasets

They used:

- **BigCodeBench**, which includes functionality tests;
- **SecCodePLT**, a security-focused benchmark that the study says lacked functionality tests for their use case.

To enable combined evaluation on SecCodePLT, the researchers generated unit tests using Qwen2.5-Coder-32B and the provided reference implementations.

Related benchmark work has since described SeCodePLT as a framework with more than 5.9k samples, 44 CWE-based categories, three security capabilities, manually validated seeds, targeted mutations, patched/vulnerable code, tests, and proof-of-concept artifacts [3][4]. That broader benchmark evolution creates an opportunity to replace or validate LLM-generated tests with first-class benchmark artifacts where available.

## 3.4 Vulnerability assessment

They used three static analyzers:

- CodeQL;
- Bearer;
- Bandit.

They also used two large LLMs as vulnerability detectors:

- Qwen2.5-72B;
- Llama3.3-70B.

The source abstract confirms the use of three static analyzers and two LLMs to identify potential vulnerabilities [1].

## 3.5 Combined metrics

The study considered Secure-Pass@k, which counts generations that are both fully functional and secure. It then proposed **SAFE@k**, which combines:

- a binary security indicator;
- partial unit-test pass rate;
- an exponential calibration that penalizes very low functionality.

The rationale is that code failing one edge case can still be useful, while Secure-Pass@k gives it zero credit.

## 3.6 Main findings

The paper reports:

- scanner results were inconsistent and sometimes contradictory;
- no single scanner covered every vulnerability type;
- LLM vulnerability judges generated many false positives;
- secure-generation methods sometimes improved security but reduced functionality;
- some methods removed vulnerability-related code without preserving behavior or produced irrelevant output;
- security effects were non-monotonic, meaning a method could turn secure base output into insecure output;
- many methods reduced combined performance by more than 50% relative to the base model [1][2].

The correct conclusion is not that secure-generation methods never help. It is that their value can be overstated when security and functionality are measured independently or when one scanner is treated as ground truth.

---

## 4. Main research domains

## 4.1 Secure software engineering

The project studies whether generated programs meet security requirements while remaining useful.

## 4.2 AI-assisted programming

The object of evaluation is code produced by LLMs and secure-coding interventions.

## 4.3 Program analysis

Static analysis, taint analysis, syntax analysis, and vulnerability rules are used to inspect code without relying only on execution.

## 4.4 Software testing

Functional tests and security-specific tests provide executable evidence about program behavior.

## 4.5 Application security

Tasks map to vulnerability classes such as CWE categories, secure API use, input validation, injection prevention, and memory safety.

## 4.6 Benchmark and metric design

The project asks whether tasks, labels, tests, scanners, and aggregate metrics measure the intended property.

## 4.7 Empirical software engineering

A credible study needs controlled sampling, repeated trials, effect sizes, confidence intervals, artifact documentation, and reproducibility.

## 4.8 LLM evaluation and reliability

Model sampling, prompt sensitivity, version drift, refusal, invalid output, and nondeterminism all influence results.

## 4.9 Human validation

Expert review remains necessary to estimate scanner false positives and false negatives and to classify ambiguous output.

---

## 5. Why this research matters

A secure-code method can obtain a better security score by deleting dangerous behavior, returning a constant, refusing the task, or producing non-executable code. Such output may contain no scanner-detected vulnerability while failing the user's request. Separate evaluation makes this failure easier to miss.

Likewise, a scanner label is not perfect ground truth. Different tools have different language, framework, rule, and analysis coverage. The source study found contradictory judgments across scanners and missed vulnerabilities in CodeQL [1][2]. New benchmarking work such as SeCodePLT emphasizes dynamic metrics and bundles prompts, vulnerable and patched code, tests, and proofs of concept, specifically because static rules and LLM judgments can produce false positives and false negatives [3][4].

The research therefore concerns **measurement validity**. If the benchmark is unreliable, improvements to model training or prompting may be optimized toward the wrong target.

---

## 6. Limitations of the source study and continuation opportunities

## 6.1 Scanner agreement is not ground truth

Using several scanners is better than using one, but majority vote can still be wrong. Tools may share blind spots, duplicate rules, or detect different properties.

### FYP opportunity

Create a manually adjudicated gold subset. For each sampled generation:

1. inspect scanner findings;
2. execute security tests or proofs of concept where safe;
3. compare with the task's intended CWE;
4. obtain a second reviewer;
5. record disagreement and final rationale.

Estimate precision and recall for each scanner on this subset rather than only reporting overlap.

## 6.2 LLM judges are not reliable security oracles

The source study reports substantial false positives from LLM vulnerability detection [2]. LLM judges may also be sensitive to prompt wording, code formatting, model version, and context length.

### FYP opportunity

Treat LLM judgment as a separate noisy signal. Test:

- blind versus CWE-informed prompts;
- one-pass versus structured evidence prompts;
- agreement across repeated runs;
- confidence calibration;
- whether the judge cites an executable data flow or merely labels a suspicious API.

Never let an LLM judge alone define the final security label.

## 6.3 LLM-generated unit tests may be incomplete

The study generated tests for SecCodePLT using another code LLM. Those tests may miss requirements, encode assumptions from the reference code, or accept incorrect alternatives.

### FYP opportunity

Audit generated tests through:

- mutation testing;
- branch coverage;
- differential testing against multiple correct implementations;
- adversarial incorrect solutions;
- expert review;
- benchmark-provided security/functionality artifacts where available.

The newer SeCodePLT description explicitly includes test cases and ground-truth proof-of-concept artifacts, offering a stronger basis for dynamic validation [3][4].

## 6.4 Unit-test pass rate is not a perfect measure of usefulness

Passing 80% of tests does not always mean “80% functional.” Tests differ in importance and redundancy. A missing security-critical case may be more important than several easy cases.

### FYP opportunity

Compare:

- raw case pass rate;
- requirement-weighted pass rate;
- branch/behavior coverage;
- mutation score;
- critical-case pass rate;
- edit effort or repair distance, if measured reproducibly.

## 6.5 SAFE@k contains design choices that need validation

SAFE@k multiplies a binary security label by an exponentially calibrated test-pass score. This is understandable, but the chosen transformation embeds a value judgment about how partial functionality should be rewarded.

### FYP opportunity

Perform metric-sensitivity analysis:

- vary the exponent/calibration parameter;
- compare rankings under Secure-Pass@k, SAFE@k, harmonic mean, Pareto frontier, and constrained functionality/security metrics;
- test whether conclusions change;
- ask developers to rank code usefulness and compare metric correlation with human judgment.

Do not invent a new metric only because it looks mathematically elegant. Validate what it predicts.

## 6.6 Binary security labels hide severity and exploitability

“All secure” versus “vulnerable” treats every finding equally and may ignore reachability, preconditions, data-flow feasibility, and impact.

### FYP opportunity

Add structured security outcomes:

- target CWE present/absent;
- any additional CWE introduced;
- executable exploit/security-test success;
- reachability;
- severity category;
- exploit preconditions;
- scanner confidence/evidence.

Keep the main score simple, but publish the dimensions separately.

## 6.7 Static analysis is limited for runtime behavior

Static tools can miss environment-dependent behavior and produce findings that are not reachable at runtime. A later benchmark, SafeGenBench, combines SAST and LLM judging, while SeCodePLT emphasizes dynamic artifacts and executable assessment [3][5].

### FYP opportunity

Use sandboxed dynamic security tests for a focused set of CWEs. Examples should be selected for safe, deterministic local execution, such as input-validation failures in toy programs. Do not test against external systems.

## 6.8 Limited language/framework realism

Snippet benchmarks do not fully represent repository-level code, dependencies, configuration, authentication, or framework usage.

### FYP opportunity

Choose one controlled extension:

- Python web handlers;
- Java services;
- C memory-safety tasks;
- repository-level patch generation;
- dependency-aware tasks.

Do not attempt all languages within one FYP.

## 6.9 Prompt and sampling sensitivity

Secure-code generation can change with temperature, top-p, system prompt, security wording, and random seed.

### FYP opportunity

Run repeated samples under a registered generation protocol. Report variance across seeds and prompts, not only one aggregate score.

## 6.10 Model and API drift

Commercial APIs and hosted models can change. A result tied to one model snapshot may not reproduce later.

### FYP opportunity

Record:

- exact model identifier;
- access date;
- decoding settings;
- prompt template hash;
- response metadata available from the provider;
- rerun subset for temporal stability if feasible.

Prefer at least one locally reproducible model.

## 6.11 Technique compatibility is uneven

Fine-tuning, constrained decoding, and prompt optimization have different model-access requirements. Comparing them on every model may be impossible or unfair.

### FYP opportunity

Define compatibility strata:

- open-weight methods;
- inference-control methods;
- black-box API methods.

Compare techniques only where their assumptions are satisfied, and report compute/API cost.

## 6.12 Base-model degradation needs causal analysis

The paper identifies secure-to-insecure and functional-to-nonfunctional changes, but a continuation can investigate why individual transformations fail.

### FYP opportunity

Build a transition taxonomy:

```text
functional + secure     -> functional + secure
functional + vulnerable -> functional + secure
functional + secure     -> nonfunctional + secure
functional + secure     -> functional + vulnerable
functional + vulnerable -> irrelevant/refusal
```

Then inspect which prompt, decoding, or fine-tuning behaviors produce each transition.

## 6.13 Instruction following is a third axis

Code can compile and pass tests yet ignore explicit nonfunctional requirements, API constraints, or requested implementation strategy.

### FYP opportunity

Add **instruction adherence** as a separate dimension. Distinguish:

- syntax/compilation;
- task relevance;
- functionality;
- security;
- instruction compliance.

## 6.14 Security can be achieved by refusal or over-restriction

A model may refuse safe tasks or remove required capability. This resembles safe-but-useless degeneration.

### FYP opportunity

Measure:

- refusal rate;
- not-following-instruction rate;
- irrelevant-output rate;
- over-restriction rate;
- repairability.

## 6.15 Benchmark contamination is insufficiently resolved

Code models may have seen benchmark prompts, reference implementations, or tests during training.

### FYP opportunity

Use newly authored or mutated holdout tasks and compare performance with established tasks. SeCodePLT's mutation framework is relevant because it expands manually validated seeds into diverse unseen instances [3][4]. Apply strict train/evaluation separation if any fine-tuning is performed.

## 6.16 Cost and latency are omitted from quality metrics

An iterative method can improve security but require many model calls, long latency, or high compute.

### FYP opportunity

Report quality alongside:

- generated tokens;
- inference calls;
- latency;
- GPU time;
- API cost where available;
- scanner runtime;
- human adjudication effort.

## 6.17 Inter-rater reliability is needed for manual labels

Manual validation itself can vary by reviewer expertise.

### FYP opportunity

Use two independent reviewers on a meaningful subset, an adjudication protocol, and agreement statistics by label type.

---

## 7. Recommended FYP direction

### Primary title

**Beyond Scanner Scores: Dynamic, Ground-Truth-Driven Evaluation of Secure LLM Code Generation**

### Alternative title

**Secure and Useful? Validating Joint Security-Functionality Metrics for LLM-Generated Code**

### Metric-focused title

**When Secure Code Scores Disagree: A Reliability Study of Scanners, Tests, and Combined Metrics**

### Recommended novelty statement

> Unlike evaluations that infer security from one scanner or combine incomplete functionality and vulnerability scores, this project constructs a manually validated and dynamically tested subset, quantifies oracle error, and tests whether secure-generation rankings remain stable across scanners, prompts, metrics, and vulnerability classes.

---

## 8. Recommended aim

> To design and validate a reproducible evaluation framework that jointly measures functionality, instruction adherence, and security of LLM-generated code using executable tests, multiple static analyzers, calibrated human adjudication, and metric-sensitivity analysis.

---

## 9. Research questions

### RQ1: Oracle reliability

How accurately do static analyzers and LLM judges identify vulnerabilities in generated code relative to manually adjudicated and dynamically tested ground truth?

### RQ2: Test adequacy

How well do generated or benchmark-provided unit tests distinguish correct implementations from plausible but incorrect code?

### RQ3: Metric validity

Do SAFE@k, Secure-Pass@k, and alternative joint metrics agree on model and mitigation rankings?

### RQ4: Security-functionality transitions

Which secure-generation methods convert vulnerable code into secure functional code, and which instead produce nonfunctional, irrelevant, refused, or newly vulnerable output?

### RQ5: Robustness

Are conclusions stable across random seeds, prompt formulations, vulnerability types, model families, and analyzer combinations?

### RQ6: Dynamic validation

How often do static findings correspond to executable security-test failures, and how often do dynamic tests expose missed issues?

### RQ7: Practicality

What quality, compute, latency, and review costs are required by each mitigation and evaluation method?

---

## 10. Hypotheses

- **H1:** No individual scanner or LLM judge will achieve sufficiently high precision and recall across all selected CWE classes.
- **H2:** Scanner-union labeling will improve recall but reduce precision relative to manually validated ground truth.
- **H3:** Dynamic security tests will resolve a meaningful subset of disagreements among static analyzers.
- **H4:** Some secure-generation methods will improve vulnerability rate while reducing functional correctness or instruction adherence.
- **H5:** Model/technique rankings will change under different combined metrics and security oracles.
- **H6:** Security improvements will be larger on benchmark-visible weakness patterns than on newly authored or mutated holdout tasks.
- **H7:** Iterative prompting will incur greater time/token cost than one-pass baselines, so quality-only rankings will differ from cost-aware rankings.

These hypotheses are proposals and should be finalized before running the main study.

---

## 11. Minimum viable study design

A manageable FYP should narrow the original study.

### Recommended choices

- **Language:** Python, because Bandit and multiple test frameworks are readily usable.
- **CWE scope:** 4–8 weakness classes with deterministic local evaluation.
- **Models:** 2 open models plus 1 API model if budget permits.
- **Mitigations:** baseline prompting, one secure prompt method, and one additional method compatible with your models.
- **Samples:** determine through compute budget and statistical precision; generate repeated outputs per task.
- **Security evidence:** CodeQL, Bandit, one additional analyzer where language-compatible, plus dynamic tests and manual adjudication.
- **Functionality:** benchmark tests plus mutation testing on the test suite.

This is stronger than superficially covering seven models and many methods without reliable ground truth.

---

## 12. Dataset and task plan

## 12.1 Dataset sources

Use a focused subset from:

- SeCodePLT/SecCodePLT, where licensing and task artifacts permit;
- CodeGuard+ tasks, which its repository describes as 91 prompts covering 34 CWEs with accompanying unit tests [6];
- BigCodeBench for broader functionality tasks;
- a small new holdout set authored and reviewed for the FYP.

## 12.2 Task inclusion criteria

Include only tasks with:

- explicit functional specification;
- explicit security policy;
- deterministic local execution;
- safe sandboxing;
- known vulnerable and patched exemplars;
- executable functionality tests;
- executable security tests or a clear manual rule;
- no network or real credential requirement.

## 12.3 Item cards

For each task, document:

```text
item_id
language
framework
CWE
functional requirements
security property
reference vulnerable code
reference patched code
functionality tests
security tests / proof of concept
allowed dependencies
resource limits
known oracle limitations
review status
```

## 12.4 Holdout generation

Create variants by changing names, data types, control flow, framework context, and non-security requirements while preserving the same security property. Every variant must be revalidated.

## 12.5 Leakage controls

- keep authored holdout prompts private until evaluation is frozen;
- do not use evaluation tasks for fine-tuning;
- hash dataset versions;
- document any prompt overlap found;
- separate development and test items;
- avoid iterative manual tuning on the final test set.

---

## 13. Ground-truth construction

## 13.1 Label dimensions

Each output should receive separate labels:

1. parse/compile success;
2. instruction relevance;
3. functional test result;
4. critical-case result;
5. target CWE status;
6. additional vulnerability status;
7. dynamic security-test result;
8. static-tool findings;
9. refusal/garbage status;
10. adjudication confidence.

## 13.2 Human adjudication

For a stratified sample:

- include scanner agreements and disagreements;
- include pass and fail cases;
- include every selected CWE;
- include every model/mitigation family;
- use two reviewers;
- provide blinded identifiers where feasible;
- adjudicate disagreements;
- report agreement.

## 13.3 Dynamic evidence

Run generated code only in a restricted sandbox with:

- no external network;
- no user secrets;
- bounded CPU, memory, process count, and time;
- read-only base image;
- disposable file system;
- captured stdout/stderr and exit status.

The project is defensive evaluation. Security tests should target synthetic local programs, not real systems.

---

## 14. Evaluation pipeline

```text
Task specification
       |
       v
Model + generation method
       |
       v
Generated candidate
       |
       +--> syntax / compilation
       |
       +--> instruction-adherence checks
       |
       +--> functional unit tests
       |
       +--> mutation adequacy / critical cases
       |
       +--> static analyzers
       |
       +--> sandboxed dynamic security tests
       |
       +--> sampled human adjudication
       |
       v
Per-candidate evidence record
       |
       v
Joint metrics + transition analysis + cost report
```

Never collapse raw evidence into one score before saving the per-dimension results.

---

## 15. Metrics

## 15.1 Functionality

- compile/parse rate;
- full test-pass rate;
- case pass rate;
- critical-case pass rate;
- mutation score of the test suite;
- instruction-adherence rate;
- irrelevant-output rate;
- refusal rate.

## 15.2 Security

- target-CWE absence rate;
- dynamic security-test pass rate;
- introduced-vulnerability rate;
- scanner precision and recall on adjudicated subset;
- false-positive and false-negative rate;
- finding agreement by CWE;
- secure-to-insecure transition rate;
- vulnerable-to-secure transition rate.

## 15.3 Joint metrics

Report at least:

- Secure-Pass@1 and @k;
- source-study SAFE@1 and @k, implemented exactly from the paper;
- a transparent two-dimensional Pareto plot;
- a constrained metric such as maximum security subject to a minimum functionality threshold;
- optional harmonic mean of normalized security and functionality, clearly labeled as an alternative.

Do not present one aggregate metric without component scores.

## 15.4 Calibration and stability

- rank correlation across metrics;
- rank correlation across scanners;
- bootstrap confidence intervals;
- variance across seeds;
- prompt sensitivity;
- model-version sensitivity where repeatable.

## 15.5 Cost

- model calls;
- input/output tokens;
- wall-clock latency;
- GPU time;
- API cost if applicable;
- analyzer runtime;
- dynamic-test runtime;
- human review time.

---

## 16. Critical experiments

## Experiment 1: Reproduce a focused slice

Reproduce one dataset, two or three models, and a limited set of techniques. Verify that the original security-functionality trade-off appears under your environment.

## Experiment 2: Scanner reliability

Compare CodeQL, Bandit, and another compatible analyzer against adjudicated labels. Report precision/recall per CWE, not only overall agreement.

## Experiment 3: Dynamic versus static evidence

For selected CWEs, compare scanner findings with sandboxed security tests. Analyze static-only, dynamic-only, both, and neither cases.

## Experiment 4: Test-suite adequacy

Introduce controlled mutants into reference solutions. Measure how often functionality tests kill the mutants. Improve tests, then measure whether model rankings change.

## Experiment 5: Metric sensitivity

Recalculate rankings under Secure-Pass@k, SAFE@k calibration variants, Pareto analysis, and functionality thresholds.

## Experiment 6: Transition analysis

Pair each base generation with its security-enhanced counterpart where the method permits. Classify beneficial and harmful transitions.

## Experiment 7: Prompt robustness

Use several semantically equivalent task prompts and security instructions. Measure variance and whether a method overfits one wording.

## Experiment 8: Holdout generalization

Evaluate on newly authored or validated mutated tasks not used for method tuning.

## Experiment 9: LLM-judge reliability

Compare blind, CWE-informed, and evidence-required LLM judging with static/dynamic/manual ground truth. Repeat judge calls to estimate instability.

## Experiment 10: Cost-aware evaluation

Plot joint quality against tokens, latency, and compute. Identify dominated methods that cost more while performing no better.

## Experiment 11: Newly introduced vulnerabilities

Analyze cases where a mitigation changes secure base code into vulnerable output. Group root causes by insecure API substitution, missing validation, broken sanitization, control-flow damage, or fabricated code.

## Experiment 12: Partial usefulness study

Optionally ask experienced developers to estimate whether partially functional outputs are repairable and compare their ratings with case-pass rate and SAFE@k. This requires a separate human-subjects protocol if personal data is collected.

---

## 17. Statistical analysis plan

- pre-register primary models, tasks, metrics, and comparisons;
- use task-level paired comparisons where base and mitigation outputs share prompts;
- bootstrap confidence intervals over tasks, not only generations;
- report median and dispersion for cost/latency;
- use paired tests appropriate to binary outcomes for security/functionality transitions;
- report effect sizes;
- correct or clearly label multiple exploratory comparisons;
- use mixed-effects models if analyzing many generations nested within tasks and models;
- perform rank-stability analysis under alternate metrics and oracles;
- publish exact denominators and missing/invalid-output handling.

Do not treat repeated samples from one task as independent benchmark tasks.

---

## 18. Baselines

### Generation baselines

- base model with original prompt;
- base model with a concise secure-coding instruction;
- one established prompt-optimization technique;
- one model/decoding intervention if feasible.

### Security-oracle baselines

- CodeQL alone;
- language-specific scanner alone;
- union of scanners;
- intersection of scanners;
- LLM judge;
- dynamic test;
- adjudicated ground truth subset.

### Functionality-oracle baselines

- original tests;
- strengthened tests;
- critical-case tests;
- mutation-tested suite.

### Metric baselines

- security-only;
- functionality-only;
- Secure-Pass@k;
- SAFE@k;
- two-dimensional Pareto reporting.

---

## 19. Engineering architecture

### Suggested components

1. **Task registry:** versioned task specifications and artifacts.
2. **Generation runner:** standardized prompts, decoding, retries, and response capture.
3. **Code normalizer:** extracts candidate code without silently repairing it.
4. **Sandbox executor:** runs tests with strict resource isolation.
5. **Scanner adapters:** normalize CodeQL/Bandit/other output into a common schema.
6. **Evidence store:** preserves raw findings, logs, outputs, and hashes.
7. **Adjudication interface:** supports blind review and rationale.
8. **Metrics engine:** calculates component and joint measures.
9. **Report generator:** creates reproducible tables, plots, transition matrices, and item-level error reports.

### Common result schema

```text
run_id
task_id
model_id
model_version
method_id
seed
prompt_hash
generation_settings
raw_response_hash
parse_status
instruction_status
tests_passed
tests_total
critical_tests_passed
static_findings
dynamic_security_result
target_cwe_label
additional_cwe_labels
reviewer_labels
final_adjudication
latency
tokens
cost
```

---

## 20. Safety and responsible execution

This project is defensive, but generated code may be unsafe to execute.

### Required safeguards

- run all generated code in disposable containers or VMs;
- disable external networking;
- use synthetic inputs and temporary files;
- cap CPU, memory, execution time, file size, and process count;
- do not use real credentials or production services;
- avoid evaluating malware, destructive payloads, or operational exploit deployment;
- inspect dependencies before installation;
- preserve environment manifests;
- reset the sandbox after each candidate;
- make the released harness safe by default.

### Responsible claims

Do not claim that:

- passing scanners means the code is secure;
- passing unit tests means it is correct;
- one benchmark predicts production security;
- an LLM judge replaces expert review;
- one combined number captures every trade-off;
- open and commercial models were compared fairly unless method compatibility and model versions are controlled.

---

## 21. Timeline

### Weeks 1–4: literature and scope

- study the ICSE paper and related benchmarks;
- choose language, CWE subset, models, and methods;
- define threat and oracle model;
- freeze primary questions;
- prepare compute and safety plan.

### Weeks 5–8: evaluation harness

- build task registry;
- implement generation capture;
- create locked-down sandbox;
- integrate functional tests;
- integrate first scanner;
- define result schema.

### Weeks 9–12: focused reproduction

- reproduce a subset of the source study;
- validate metric implementation;
- compare with reported qualitative trends;
- document deviations.

### Weeks 13–17: ground truth and dynamic tests

- add selected dynamic security tests;
- create adjudication protocol;
- review stratified sample;
- calculate reviewer agreement;
- estimate scanner error.

### Weeks 18–21: test adequacy

- run mutation testing;
- strengthen weak test suites;
- validate holdout items;
- freeze final benchmark version.

### Weeks 22–27: main experiments

- run models and methods;
- perform scanner, dynamic, and joint evaluation;
- collect cost/latency data;
- monitor failures without changing the test set.

### Weeks 28–31: analysis

- compute confidence intervals;
- perform transition and rank-stability analysis;
- inspect newly introduced vulnerabilities;
- complete qualitative root-cause taxonomy.

### Weeks 32–36: artifact and thesis

- finalize reproducibility package;
- write limitations and responsible-use guidance;
- prepare thesis, poster, and demonstration;
- optionally prepare a workshop or conference submission.

---

## 22. Scope levels

## Minimum acceptable FYP

- Python only;
- 4–6 CWE classes;
- two open models;
- baseline and one secure-generation intervention;
- CodeQL/Bandit plus dynamic tests for selected categories;
- manually adjudicated subset;
- functionality, security, Secure-Pass@k, and SAFE@k;
- transition analysis;
- reproducible containerized harness.

## Strong FYP

Add:

- third model or API;
- second mitigation family;
- mutation analysis of unit tests;
- newly authored holdout tasks;
- metric-sensitivity study;
- LLM-judge calibration;
- cost-aware ranking;
- two-reviewer agreement analysis.

## Publication-oriented FYP

Add:

- two programming languages;
- repository-level tasks;
- expanded dynamic security oracle;
- developer usefulness validation;
- model-version drift study;
- large adjudicated gold set;
- public benchmark leaderboard with evidence cards;
- independently reproduced results on a second infrastructure environment.

---

## 23. Expected contributions

1. **A reproducible joint evaluation harness** preserving raw evidence from tests, scanners, dynamic checks, and model runs.
2. **A manually adjudicated gold subset** for estimating scanner and LLM-judge error.
3. **A test-adequacy analysis** showing whether unit tests meaningfully distinguish correct from plausible incorrect code.
4. **A metric-validity study** comparing SAFE@k with strict and multi-objective alternatives.
5. **A security-functionality transition taxonomy** explaining successful hardening and safe-but-useless degeneration.
6. **A robustness study** across prompts, seeds, CWE classes, and holdout variants.
7. **A cost-aware evaluation** of quality versus tokens, latency, and compute.
8. **Practical recommendations** for researchers evaluating secure code generation.

A valuable negative result would be that model rankings are unstable across reasonable security oracles or metrics. That would directly support better evaluation practice.

---

## 24. Risks and mitigations

### Risk: project becomes too broad

**Mitigation:** choose Python, 4–6 CWEs, two models, and one intervention for the minimum scope.

### Risk: ground truth is expensive

**Mitigation:** use stratified adjudication, dynamic tests on selected CWEs, and report uncertainty instead of pretending every label is perfect.

### Risk: scanner setup is fragile

**Mitigation:** containerize versions, store configuration, validate each scanner on known vulnerable/patched examples, and record failures.

### Risk: generated tests are weak

**Mitigation:** mutation test them, add adversarial incorrect implementations, and use benchmark-provided artifacts where possible.

### Risk: API cost or model access changes

**Mitigation:** prioritize open models, cache immutable raw responses, and define an API model as optional.

### Risk: unsafe code execution

**Mitigation:** disable network, use disposable sandboxes, strict resource limits, synthetic data, and automatic reset.

### Risk: metric innovation without validation

**Mitigation:** treat new metrics as hypotheses, compare rankings, correlate with evidence or developer judgment, and always publish components.

### Risk: benchmark contamination

**Mitigation:** create private holdout variants and freeze them before the main evaluation.

### Risk: non-reproducible model outputs

**Mitigation:** record seeds/settings, use repeated generations, retain response hashes, and report variance.

---

## 25. Recommended deliverables

1. FYP proposal and literature review;
2. research questions and pre-registration;
3. threat and oracle model;
4. task/item cards;
5. containerized generation/evaluation harness;
6. scanner adapters;
7. dynamic security tests;
8. strengthened functionality tests;
9. adjudication guide and agreement report;
10. anonymized evidence dataset where licensing permits;
11. metric implementation and sensitivity notebook;
12. transition/error taxonomy;
13. benchmark and cost report;
14. final thesis;
15. conference-style poster;
16. reproducibility documentation and demo.

---

## 26. Suggested thesis structure

1. Introduction
2. Background: LLM code generation and software security
3. Secure-generation methods
4. Program-analysis and testing oracles
5. Related benchmarks and metrics
6. Critique of existing evaluation
7. Research questions and methodology
8. Dataset and task construction
9. Ground-truth and adjudication protocol
10. Evaluation framework implementation
11. Scanner and test reliability results
12. Joint metric and transition results
13. Robustness and cost analysis
14. Threats to validity
15. Responsible use and reproducibility
16. Conclusion and future work

---

## 27. Final assessment

### Academic value

**Very high.** This is a measurement-validity problem at the intersection of AI, security, and software engineering.

### Feasibility

**Moderate to high difficulty.** A focused Python study is feasible. Reproducing all seven models, four techniques, and multiple languages would be too large for most FYPs.

### Novelty

- **Low:** rerun the paper on one newer model.
- **Moderate:** reproduce a subset and add another scanner.
- **Strong:** validate scanner/test ground truth dynamically, compare metrics, and publish transition-level analysis.
- **Publication-oriented:** release a robust, contamination-aware, cost-aware, multi-oracle benchmark with an adjudicated gold set.

### Recommended final research question

> **How reliably do current scanners, executable tests, and combined metrics measure whether LLM-generated code is both secure and functionally useful, and do secure-generation technique rankings remain stable when those evaluation choices change?**

This is a defensible continuation of the ICSE 2026 work and gives your FYP a clear contribution beyond model comparison.

---

## 28. References and starting resources

1. S.-C. Dai, J. Xu, and G. Tao, “Rethinking the Evaluation of Secure Code Generation,” arXiv:2503.15554, revised November 12, 2025; accepted at ICSE 2026. [Read the paper abstract](https://arxiv.org/abs/2503.15554)
2. S.-C. Dai, J. Xu, and G. Tao, “Poster: Rethinking the Evaluation of Secure Code Generation,” IEEE Security and Privacy 2026 poster collection. [View the poster](https://sp2026.ieee-security.org/downloads/posters/sp2026posters-final6.pdf)
3. Y. Nie et al., “SeCodePLT: A Unified Platform for Evaluating the Security of Code GenAI,” accepted to the NeurIPS 2025 Datasets and Benchmarks track. [Read the benchmark paper](https://arxiv.org/abs/2410.11096)
4. SeCodePLT project repository and benchmark artifacts. [View the SeCodePLT repository](https://github.com/ucsb-mlsec/SeCodePLT)
5. X. Li et al., “SafeGenBench: A Benchmark Framework for Security Vulnerability Detection in LLM-Generated Code,” 2025. [Read the SafeGenBench abstract](https://arxiv.org/abs/2506.05692)
6. CodeGuard+ project, constrained decoding and a benchmark with unit tests for security-focused prompts. [View the CodeGuard+ repository](https://github.com/CodeGuardPlus/CodeGuardPlus)
7. CodeLMSec benchmark project, an earlier CodeQL-based security benchmark for black-box code models. [View CodeLMSec](https://codelmsec.github.io/)
8. Alibaba SecCodeBench, a benchmark suite aimed at security evaluation of AI-generated code and agentic coding tools. [View SecCodeBench](https://github.com/alibaba/sec-code-bench)

---

## 29. Immediate starting checklist

- [ ] Select one language and 4–6 CWE classes.
- [ ] Choose one primary combined metric and define component metrics.
- [ ] Select two reproducible open models.
- [ ] Select baseline plus one compatible secure-generation intervention.
- [ ] Build a no-network sandbox before executing generated code.
- [ ] Validate scanners on known vulnerable and patched examples.
- [ ] Add dynamic tests for selected CWEs.
- [ ] Mutation-test functionality suites.
- [ ] Create and freeze holdout variants.
- [ ] Write the adjudication guide before reading main results.
- [ ] Record model, prompt, scanner, and dataset versions.
- [ ] Report raw security and functionality components beside every joint score.
