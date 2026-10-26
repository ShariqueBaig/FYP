# FYP Master Evaluation: Batches 1 and 2

**Prepared for:** Sharique Baig and a three-person BSCS team  
**Planning horizon:** 2026-2027  
**Validated:** 26 August 2026

## Executive conclusion

Your strongest intersection is **application security + agentic AI + systems + embedded hardware**. Your FYP should contain a working artifact, a precise threat model, a benchmark/dataset, and rigorous baselines. Avoid a generic chatbot, classifier, dashboard, survey, or framework-only thesis.

## Final shortlist across both batches

1. **Runtime Security and Red-Team Platform for Tool-Using Agents**: merge Batch 2 ideas 1, 4, 5, 13, 89, and 92.
2. **Urdu Multimodal Scam-Call Intelligence with Progression Prediction**: merge the earlier Urdu idea with idea 80.
3. **SentinelEdge plus Secure OTA Revocation**: merge the earlier IoT gateway with idea 28.
4. **eBPF Causal Attribution and Safe Containment**: refine the earlier eBPF idea and idea 30.
5. **Hybrid Simulation-Emulation Cyber Range**: idea 34, exploiting your QEMU and agent-security strengths.
6. **BinaryAgentBench**: idea 16, limited to CTF binaries and evidence-grounded tooling.
7. **Hardware path**: hardware-attested ground rovers, or idea 27's ultrasonic-injection-resistant sensor front end.

## Previously retained ideas

### Urdu Multimodal Scam-Call Intelligence
- **Score:** 9.6/10
- **Difficulty:** High
- **Fit:** ML/NLP, audio and real-time platform experience, plus strong Pakistan relevance.
- **Refinement:** Detect scam progression early, not only classify the complete call.
- **Collaborators:** PTA for domain/policy validation; National CERT CIE as a government-industry-academia bridge; telecom operators; JazzCash/Easypaisa fraud teams; NCAI speech/NLP researchers.
- **What to request:** expert taxonomy, privacy/deployment review, and introductions. Do not assume access to private recordings.

### SentinelEdge Secure IoT Gateway
- **Score:** 9.3/10
- **Difficulty:** High
- **Fit:** ESP32, robotics, ML and security.
- **Refinement:** Fuse identity, firmware state, network behavior and physical-process plausibility; add bad-version/key revocation and rollback-safe OTA recovery.
- **Collaborators:** NCCS IoT labs, UET Peshawar secure IoT lab, LUMS CHASE, National CERT.

### Agentic AI Pentesting and Attack-Chain Reasoning
- **Score:** 9.2/10
- **Difficulty:** High
- **Fit:** Direct continuation of your appsec and agentic pentesting experience.
- **Condition:** Independent implementation, authorized targets, and written IP approval before using employer assets or findings.

### eBPF Destructive-Operation Attribution
- **Score:** 9.2/10
- **Difficulty:** High
- **Refinement:** Cover unlink, rename, truncation and overwrite; preserve a causal evidence graph and add safe containment.
- **Collaborators:** National CERT IR, NCCS, Linux/eBPF community and cloud teams.

### Hardware-Attested Robot Coordination
- **Score:** 8.7/10
- **Difficulty:** High
- **Fit:** robotics, ESP32, path planning, multi-agent coordination and security.
- **Scope rule:** use ground rovers and simple navigation so security remains the thesis.

### Runtime Security for AI Agents
- **Score:** 9.1/10
- **Difficulty:** High
- **Refinement:** protocol-aware delegated identity, provenance, transitive authorization and causal enforcement, rather than a generic policy proxy.

### Federated IDE Malware Detection
- **Score:** 7.8/10
- **Difficulty:** High
- **Refinement:** poisoning resistance, secure aggregation, drift and developer-time evidence. “Federated malware detection” alone is no longer enough novelty.

## Batch 2 decision matrix

### Tier S: strongest candidates to retain or merge

1. **Multi-Agent Red-Team Harness**: 9.4/10, High. Bound self-improvement to versioned strategies and regression tests. Merge into the runtime platform. Collaborators: National CERT CIE, NCCS cyber range, authorized appsec teams.
2. **Malicious MCP Honeypot**: 9.2/10, Medium-High. Use an isolated ecosystem and synthetic secrets; contribute an attack taxonomy and provenance-preserving traces.
4. **Agent Privilege/Scope-Creep Detector**: 9.3/10, Medium-High. Track requested, granted, inherited and exercised capabilities; enforce just-in-time authorization.
5. **MCP Tool-Poisoning Guard**: 9.1/10, Medium. Combine manifest integrity, semantic drift, call-graph policy and user-visible approval.
16. **Where Agents Fail in Binary Exploitation**: 9.0/10, Very High. Use CTF-only binaries and build a numeric/memory-grounded tool interface.
28. **Post-Deployment Revocation for IoT OTA**: 9.0/10, High. Excellent ESP32 project addressing bad-but-valid firmware, compromised keys and rollback protection.
30. **Unauthorized File Deletion via eBPF**: 9.2/10, High. Merge with causal attribution; blocking one syscall is insufficient.
34. **Simulation-Emulation Cyber-Agent Training**: 8.9/10, High. Strong QEMU fit; measure the transfer gap.
80. **PreScam Progression Benchmark**: 8.5/10, High. Merge with Urdu scam intelligence to predict intervention timing.
89. **A2ASecBench**: 8.7/10, High. Define protocol invariants, adversarial peers, delegated identity and causal scoring.
92. **Just-in-Time Hierarchical Authorization**: 8.8/10, High. Merge with idea 4 using purpose-bound, expiring, revocable delegated capabilities.

### Tier A: strong standalone or secondary candidates

3. Mobile agents as confused deputies: 8.8, High. Android capability firewall for notifications, clipboard, links and retrieved content.
6. Agent memory poisoning/unlearning: 8.2, Very High. Narrow to provenance-aware quarantine and selective rollback.
7. Forensic causal agent: 8.8, High. Make evidence-backed reconstruction primary; unlearning optional.
9. Fuzzing LLM-serving systems: 8.6, High. Target parsers, APIs, schedulers and state machines, not jailbreak prompts.
13. ShadowBench-MCP: 8.2, Medium. Benchmark indirect, transitive and unapproved invocations.
17. Supply-chain security-test generation: 8.6, High. Generate reproducible tests from advisory/SBOM evidence on vulnerable packages.
20. LLM-orchestrated side-channel analysis: 8.5, Very High. Use a legal training board and measure trace efficiency and reproducibility.
21. Acoustic target-switch attacks on gimbals: 8.0, High. Safe tabletop testbed plus sensor-fusion/filtering defence.
23. Physical waypoint hijacking of VLM rover: 8.2, High. Closed course, route consistency and sensor-fusion defence.
27. In-sensor ultrasonic-injection defence: 8.6, High. Strong hardware project measuring security, audio quality, power and latency.
31. RICe container integrity: 8.3, Very High, but low novelty as stated because recent work already uses eBPF and IMA. Differentiate with recovery, remote evidence, multi-tenancy or policy usability.
32. Numeric-grounded binary analysis: 8.1, Very High. Narrow to indirect-call recovery or function similarity.
33. Causal SAST analysis: 7.7, Very High. Use controlled code interventions, not correlations.
35. Shadow hot-patch verification: 7.5, Very High. Restrict to user-space C or xv6/QEMU.
37. Fuzzer coverage plateaus: 7.8, Very High. Choose one target family and a state-aware contribution.
40. Trustless query-based collaborative learning: 7.4, Very High. Define trust/adversary/privacy assumptions first.
41. Leveled homomorphic inference: 7.2, Extreme. Restrict to one small model and optimize depth, latency and accuracy.
45. RL cryptanalysis: 7.0, Very High. Only reduced-round or toy ciphers with strong classical baselines.
46. Edge-AI privacy budgets: 7.8, High. Tie adaptive budgets to measured attacks and formal accounting.
68. Query-bounded deepfake detector attacks: 7.0, High. Pair attack with defence and realistic black-box limits.
70. Secure-code-generation evaluation: 7.2, High. Use exploitability-backed, multi-file repair tests.
74. SynEval: 6.2, High. Only compelling when specialized to a security dataset and privacy leakage.
81. Public-model vulnerability assessment: 7.7, High. Authorized artifacts only; define vulnerability classes precisely.
86. Model-lineage attestation: 7.0, Very High. Narrow to adapters/fine-tunes under merging and quantization.
87. Fine-tuning behavioral drift: 6.7, High. Connect drift to security-policy regression.

### Tier B: viable but weaker for your CV or dependent on access

8 OffSec SLM; 10 sandbox escape evaluation; 11 social-bot detectors; 12 inference attacks on phishing detectors; 14 vector prompt-injection detector; 15 adversarial PII benchmark; 19 LLM network explanations; 24 DRAM PUF; 25 Spectre countermeasure study; 26 EyeSpy XR side channel; 29 satellite forensics; 36 container-update measurement; 39 static/dynamic indirect calls; 47 private grid metadata; 48 zero-knowledge analytics; 50 anonymity protocol; 51 5G non-terrestrial location leakage; 52 stylometric anonymization; 56 email verification; 60 telehealth privacy; 61 port-agnostic honeynets; 65 vulnerability-disclosure information flow; 66 continuous governance maturity; 71 CodeQL ecosystem; 72 serverless configuration exposure; 75 splash-ad risks; 79 citation validity; 82 text spoofing via email; 83 trustworthy-AI framework; 84 robust Graph-RAG; 85 generated attack scenarios; 88 ambient-intelligence attack surfaces; 90 bitwise-reproducible ML.

These can work, but each needs either specialist supervision, a confirmed dataset/testbed, or merger into a stronger system. Framework-only, measurement-only and “LLM explains alerts” versions are not enough.

### Tier C: reject unless specialist supervision changes the constraints

18 text watermarking; 22 DDR5 TEE interposition; 38 simulator-backdoor attestation; 42 new lattice encryption; 43 TensorUnlearn; 44 SPDZ selective-failure research; 49 private top-k theory; 57 vague surveillance measurement; 73 surveillance-graph cuts; 91 quantum ML robustness.

The main reasons are extreme mathematical/hardware dependency, unclear problem definition, or a poor fallback if the proposed novelty fails.

### Tier D: avoid as your primary FYP

53 synthetic politics; 54 health-app behavioral variation; 55 cookie preferences; 58 “We are quite bad at this!” without a defined question; 59 Privacy Sandbox retrospective; 62 upskilling versus industry; 63 transparency signals standalone; 64 forensic vocabulary; 67 welcoming in communities; 69 web-tracking survey; 76 Turkish scam calls instead of Urdu; 77 migrant-parent data; 78 trust in synthetic education.

These may be worthwhile research topics, but they underuse your strongest technical experience or introduce significant ethics/data dependency without a strong engineering artifact.

## Detailed design 1: Runtime Security and Red-Team Platform

**Research question:** Does protocol-aware, provenance-aware enforcement reduce indirect injection and unauthorized tool effects while preserving legitimate task completion better than prompt filtering alone?

**Build:** isolated MCP/multi-agent range, bounded attack-strategy library, signed/versioned tool registry, delegated capability tokens, call-graph policy, memory provenance, causal timeline and replayable benchmark.

**Team split:** red-team harness; runtime identity/policy guard; provenance/forensics/evaluation.

**Metrics:** attack success, legitimate completion, unauthorized side effects, detection time, latency, unseen-tool transfer and ablations.

## Detailed design 2: Urdu Scam Progression Intelligence

**Research question:** Does audio-text-temporal fusion improve early warning over text-only and end-of-call baselines for consented Urdu, Roman-Urdu and Urdu-English conversations?

**Build:** ethics-approved dataset protocol, staged scam taxonomy, audio/text branches, temporal model and calibrated warning interface.

**Metrics:** lead time, stage-wise F1, calibration, noisy-call robustness, speaker/script generalization, false alarms and modality ablations.

## Detailed design 3: SentinelEdge plus OTA Revocation

**Research question:** Can identity, firmware state, network behavior and physical evidence support accurate quarantine and safe fleet recovery?

**Build:** ESP32/Raspberry Pi fleet, cryptographic identity, firmware measurements, gateway trust model, bad-version/key revocation, rollback protection and recovery.

**Metrics:** unseen-device performance, detection delay, false quarantine, replay/cloning resistance, intermittent update success and overhead.

## Detailed design 4: eBPF Causal Attribution

**Research question:** Can process ancestry, file semantics and policy context stop destructive operations with fewer false blocks than syscall thresholds?

**Build:** BPF-LSM/tracepoint collector, file/process causal graph, policy engine, protected evidence channel and replayable workloads.

**Metrics:** unlink/rename/truncate/overwrite coverage, benign workload impact, overhead, evasion resistance and evidence completeness.

## Collaborator strategy

- **National CERT CIE:** government-industry-academia bridge. Ask for a reviewer, taxonomy, controlled demo or introduction, not operational data.
- **NCCS:** route for cyber-range, forensics, IoT, crypto and systems laboratories.
- **NCAI:** speech/NLP, robotics, edge AI and evaluation.
- **PTA:** telecom-domain/privacy/deployment validation, not assumed access to subscriber data or recordings.
- **LUMS CHASE:** hardware, FPGA, edge AI and cryptographic-acceleration mentorship.
- **Securiti/Veeam:** appsec validation only with written authorization and clean IP separation.

Send a one-page brief with the problem, one measurable question, an architecture diagram, one limited request, partner benefit, and ethics/IP boundaries.

## One-year execution model

1. Literature matrix, threat model, baseline reproduction, ethics/IP review and outreach.
2. Minimum artifact plus deterministic test harness.
3. Novel mechanism and ablations.
4. Unseen conditions, realistic benign workloads and expert/user feedback.
5. Paper-style thesis, reproducibility appendix and sanitized public demo.

Every project needs a partner-independent fallback: consented role-play for scam calls, simulation for telecom, trace-driven hardware tests and deliberately vulnerable targets for appsec.

## Evidence checked

- [NIST AI agent red-teaming competition](https://www.nist.gov/blogs/caisi-research-blog/insights-ai-agent-security-large-scale-red-teaming-competition) discusses indirect prompt injection/agent hijacking and the need for evolving evaluation.
- [MCP security overview](https://securityboulevard.com/2026/01/mcp-security-how-to-prevent-prompt-injection-and-tool-poisoning-attacks/) describes prompt injection, tool poisoning and layered controls.
- [RICe poster](https://www.ieee-security.org/TC/SP2026/downloads/posters/sp2026posters-final35.pdf) already uses eBPF plus IMA for container runtime integrity.
- [Hybrid eBPF container detection](https://cdn.techscience.press/files/cmc/2026/TSP_CMC-86-3/TSP_CMC_74871/TSP_CMC_74871.pdf) shows current eBPF network/system-call ML work.
- [NCCS](https://nccs.pk/) describes Pakistani labs in forensics, critical infrastructure, IoT and applied cryptography.
- [NCAI core labs](https://ncai.pk/core-labs/) lists Pakistani deep-learning, field-robotics, smart-city and intelligent-systems labs.
- [LUMS CHASE](https://pk.linkedin.com/company/chase-lab-pk) profiles secure hardware, FPGA intrusion detection, edge AI, IoT and post-quantum acceleration work.
- [PTA cybersecurity](https://www.pta.gov.pk/category/cyber-security) describes the telecom cybersecurity remit and collaboration priorities.
- [National CERT CIE](https://pkcert.gov.pk/cie) describes an initiative connecting government, private organizations, academia and innovators.

## Safety and claim limits

All offensive work must be limited to assets you own or are explicitly authorized to test, isolated cyber ranges, CTF binaries, controlled hardware and synthetic or consented data. Organizations listed are plausible outreach targets based on their published remit, not confirmed partners. No data, funding, endorsement or publication is guaranteed.
