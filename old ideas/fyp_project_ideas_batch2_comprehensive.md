# Comprehensive Evaluation of All FYP Ideas (Batch 2)

This document evaluates every single idea from your provided list. To make it readable, I have categorized them based on their relevance to your CV (Agentic AI, Hardware/Robotics, Systems/OS, Cryptography). 

For each idea, I have provided a **Rating (1-10)** based on how well it fits your skills and a 3-person FYP scope in 2026-2027, along with the Problem, Solution, and Viability.

---

## Category 1: Agentic AI & LLM Security (Top Matches)
*These perfectly align with your Agentic Pentesting framework experience.*

**1. Multi-Agent Red-Team Harness with Self-Improving Strategies**
* **Rating:** 10/10
* **Problem:** Manual red-teaming of autonomous AI agents is slow and unscalable.
* **Solution:** A modular multi-agent system that autonomously attacks other agents in a sandbox, self-improving its strategies (prompt injection, tool chaining) without catastrophic forgetting.
* **Viability:** Very High. Pure software, highly scalable.

**2. Malicious MCP Server Honeypot + Intelligence Collector**
* **Rating:** 9.5/10
* **Problem:** Traditional honeypots cannot detect or analyze malicious Agentic AI traffic.
* **Solution:** Deploy fake MCP servers that log attacker interactions, using a small agent to cluster attack patterns and generate threat intel.
* **Viability:** High. Extremely novel for 2026, leveraging the new MCP standard.

**3. Exploiting Mobile LLM Agents as Confused Deputies via Non-App-Controlled Channels**
* **Rating:** 9/10
* **Problem:** Mobile LLM agents can be manipulated via side channels (audio, notifications) outside app control.
* **Solution:** Demonstrate/build defenses against confused deputy attacks on mobile environments, creating a secure middleware for mobile agents.
* **Viability:** High. Great blend of mobile security and LLMs.

**4. Privilege Escalation & Scope-Creep Detector for Agents**
* **Rating:** 9/10
* **Problem:** Agents accumulate permissions over time, leading to silent privilege escalation.
* **Solution:** A runtime monitor that tracks effective permissions over time and flags anomalies.
* **Viability:** High. Excellent Zero-Trust/IAM software project.

**5. MCP Tool Poisoning Guard with Adaptive / Nested Defences**
* **Rating:** 8.5/10
* **Problem:** Attackers can poison the schema of MCP tools to inject malicious payloads.
* **Solution:** Static + runtime guard that learns from tool poisoning attacks and adapts.
* **Viability:** High. Very focused and achievable.

**6. Agent Memory Poisoning + Unlearning**
* **Rating:** 8.5/10
* **Problem:** Federated/nested agents can have their memory poisoned with bad data.
* **Solution:** A system to detect poisoned writes, track provenance, and explicitly "unlearn" them.
* **Viability:** Medium/High. Machine unlearning is mathematically complex but very hot.

**7. Forensic Agent that Reconstructs and Can Unlearn**
* **Rating:** 8/10
* **Problem:** Multi-agent system logs are messy and hard to audit post-incident.
* **Solution:** An agent that pieces together tool calls and memory into a causal timeline for incident response.
* **Viability:** High. Excellent for GRC/audit portfolios.

**8. OffSec-Reasoner: An Offensive-Security Specialist SLM**
* **Rating:** 9/10
* **Problem:** Generalized LLMs are bad at offensive security reasoning.
* **Solution:** Fine-tune a Small Language Model (SLM) specifically for offensive security reasoning.
* **Viability:** Medium. Training requires high-quality datasets and compute.

**9. Continuous Discovery of Vulnerabilities in LLM Serving Systems with Fuzzing**
* **Rating:** 8/10
* **Problem:** LLM backend infrastructures are vulnerable to traditional memory/logic bugs.
* **Solution:** A fuzzer designed specifically for LLM serving architectures.
* **Viability:** High. Combines traditional fuzzing with AI infra.

**10. Exploring Model-Driven Environmental Discovery, Exploitation, and Escape**
* **Rating:** 8.5/10
* **Problem:** Agents breaking out of sandboxes.
* **Solution:** Evaluate and build robust sandboxing mechanisms specifically for AI agents.
* **Viability:** High. Perfect for a pentesting background.

**11. Breaking and Defending LLM-Powered Social Media Bot Detection Systems**
* **Rating:** 7/10
* **Problem:** Attackers can easily bypass LLM bot detectors.
* **Solution:** Adversarial evaluation and defense framework for LLM social bots.
* **Viability:** High. 

**12. Inference Attacks and Defenses on LLM-Powered Email Phishing Detection Systems**
* **Rating:** 7/10
* **Problem:** Phishing detectors leak information about their training data.
* **Solution:** A framework to attack and defend the privacy of LLM phishing detectors.
* **Viability:** High.

**13. ShadowBench-MCP: Measuring Shadow Invocations in MCP-Style Tool Routing**
* **Rating:** 7.5/10
* **Problem:** Unauthorized "shadow" tool invocations occur in complex MCP routings.
* **Solution:** A benchmark/detection tool for shadow tool invocations.
* **Viability:** High. 

**14. Weighted Dual-Vector Scoring with HNSW Cascade Architecture for Prompt Injection Detection**
* **Rating:** 8/10
* **Problem:** Prompt injection remains hard to detect with low latency.
* **Solution:** A highly optimized, vector-based detection architecture.
* **Viability:** High. Solid algorithms/math project.

**15. AdvPIIBench - The Adversarial Collapse of PII Detection in LLM Interactions**
* **Rating:** 7/10
* **Problem:** PII redaction fails against adversarial prompts.
* **Solution:** A benchmarking and defensive suite for PII detection in LLMs.
* **Viability:** High.

**16. Where Do LLM Agents Fail in Binary Exploitation?**
* **Rating:** 9/10 (Great fit for xv6/C skills)
* **Problem:** LLMs struggle with actual memory/binary exploitation.
* **Solution:** Build a system that bridges the gap, helping LLMs understand memory layouts for automated binary exploitation.
* **Viability:** Medium/High. Very difficult but highly rewarding.

**17. Can LLMs Prove It? Automated Security Test Generation for Supply Chain Vulnerabilities**
* **Rating:** 8/10
* **Problem:** Supply chain vulnerabilities are hard to test automatically.
* **Solution:** Use LLMs to generate reproducible security tests.
* **Viability:** High.

**18. SemAnchor: Enhancing Extraction Accuracy of Multi-bit LLM Text Watermarking**
* **Rating:** 6.5/10
* **Problem:** Watermarks in AI text are fragile.
* **Solution:** Semantic-guided watermarking.
* **Viability:** Medium. Heavy NLP math.

**19. Detecting and Explaining Malicious Network Traffic with Large Language Models**
* **Rating:** 7/10
* **Problem:** Network traffic alerts lack context.
* **Solution:** LLM-based IDS that explains *why* traffic is malicious.
* **Viability:** High.

---

## Category 2: Hardware, IoT, & Physical Security (Top Matches)
*These align with your Arduino, ESP32, PID, and Robotics experience.*

**20. Autonomous LLM-Orchestrated De-obfuscation of Fully Unrolled AES via Zero-State DPA**
* **Rating:** 9.5/10
* **Problem:** Hardware Differential Power Analysis (DPA) is a manual, expert-only task.
* **Solution:** Use an LLM to orchestrate the oscilloscope and analyze power traces autonomously.
* **Viability:** Medium. Requires physical hardware, but an incredible project.

**21. Target Switch Attacks on Gimbal-Stabilized Visual Tracking Systems via Acoustic Injection**
* **Rating:** 8.5/10
* **Problem:** Drones/trackers can be disrupted physically.
* **Solution:** Inject acoustic frequencies to destabilize physical gimbal gyroscopes, and build a hardware filter defense.
* **Viability:** High. Fits your Line Following/Drone experience perfectly.

**22. TEE.fail: Breaking Trusted Execution Environments via DDR5 Memory Bus Interposition**
* **Rating:** 7.5/10
* **Problem:** TEEs are vulnerable to physical memory bus attacks.
* **Solution:** Hardware attack/defense on DDR5.
* **Viability:** Low. Interposing DDR5 requires extremely expensive hardware.

**23. Physically Hijacking Waypoints in Modular Vision-Language-Model-Based Autonomous Driving**
* **Rating:** 8/10
* **Problem:** Vision models in cars can be hijacked via physical world objects.
* **Solution:** Adversarial physical patches that hijack waypoints, and robust VLM defenses.
* **Viability:** Medium/High. Needs a small robot car (which you have built).

**24. Hardware Root of Trust Reconsidered: Reconfigurable DRAM-PUFs via Timing Violations**
* **Rating:** 8/10
* **Problem:** Hardware PUFs (Physical Unclonable Functions) are rigid.
* **Solution:** Use DRAM timing violations to create reconfigurable physical keys.
* **Viability:** Medium. Hardcore hardware engineering.

**25. Systematic Analysis of Hardware-Based Spectre Countermeasures**
* **Rating:** 7/10
* **Problem:** Are hardware Spectre patches actually working?
* **Solution:** A test suite for CPU side-channels.
* **Viability:** Medium. 

**26. EyeSpy: Inferring Eye Gaze via Side-Channel Attacks Against Foveated Rendering**
* **Rating:** 7/10
* **Problem:** VR headsets leak gaze data through rendering performance side-channels.
* **Solution:** Build the attack and propose rendering countermeasures.
* **Viability:** Medium. Requires a VR headset.

**27. Proactive In-Sensor Feature Extraction for Acoustic Front-Ends Against Ultrasonic Injection**
* **Rating:** 8/10
* **Problem:** Voice assistants are vulnerable to silent ultrasonic commands.
* **Solution:** Modify the microphone sensor hardware to filter/extract features *before* the OS.
* **Viability:** High. Great embedded systems project.

**28. When Secure OTA Is Not Enough: Post-Deployment Revocation for IoT OTA Software Update Security**
* **Rating:** 8/10
* **Problem:** Compromised IoT updates are hard to revoke securely.
* **Solution:** A cryptographic revocation mechanism for IoT (ESP32) fleets.
* **Viability:** High. Excellent embedded software project.

**29. Mapping the Evidence: A Taxonomy for Satellite Digital Forensics**
* **Rating:** 6/10
* **Problem:** Satellite forensics lack structure.
* **Solution:** A framework for satellite forensics.
* **Viability:** Low (Hard to get satellite hardware data).

---

## Category 3: Systems, eBPF & Binary Analysis (Strong Matches)
*These align with your xv6, QEMU, C/C++ background.*

**30. Preventing Unauthorized File Deletion via eBPF**
* **Rating:** 9/10
* **Problem:** Ransomware/wipers destroy files before they are caught.
* **Solution:** Use eBPF kernel probes to intercept and block unauthorized file deletions at runtime.
* **Viability:** High. Very relevant modern OS security.

**31. RICe: Runtime Integrity for Containers leveraging eBPF and IMA Appraisal**
* **Rating:** 8.5/10
* **Problem:** Container internals are modified at runtime by attackers.
* **Solution:** Combine eBPF with Linux IMA to ensure container integrity.
* **Viability:** High. Great DevOps/Cloud Security project.

**32. Addresses Are Not Tokens: Grounding Numeric Operands in Learned Binary Analysis**
* **Rating:** 8/10
* **Problem:** ML models fail at reverse engineering binaries because they treat memory addresses as text.
* **Solution:** A new model architecture that grounds numeric operands properly for reverse engineering.
* **Viability:** Medium/High. Good ML + Binary analysis crossover.

**33. CauSec: Unboxing the Causal Drivers of Static Vulnerability Analysis Performance**
* **Rating:** 7/10
* **Problem:** SAST tools have high false positives.
* **Solution:** Causal analysis engine to improve SAST.
* **Viability:** Medium. 

**34. Bridging Simulation and Emulation for Autonomous Cyber Agent Training**
* **Rating:** 8/10
* **Problem:** Agents trained in simulation fail in real networks.
* **Solution:** A hybrid QEMU (emulation) + Simulation environment for training cyber agents.
* **Viability:** High. You already know QEMU well.

**35. A Shadow Verification Method for Hot-patch**
* **Rating:** 7.5/10
* **Problem:** Hot-patching live systems causes crashes.
* **Solution:** A "shadow" environment to verify memory hot-patches before applying them.
* **Viability:** Medium. Deep C/OS knowledge required.

**36. Death Is Not the End: Impact of Automatic Updates on Container Vulnerability Lifespans**
* **Rating:** 6/10
* **Problem:** Containers stay vulnerable even with auto-updates.
* **Solution:** Measurement study.
* **Viability:** High, but more of a data-analytics project.

**37. What Makes Fuzzers Struggle? Toward Breaking Coverage Plateaus**
* **Rating:** 7/10
* **Problem:** Fuzzers hit walls in code coverage.
* **Solution:** Multi-instance profiling for fuzzers.
* **Viability:** Medium. 

**38. Attested Transition Execution for DAZE-Style Simulator Backdoors**
* **Rating:** 7/10
* **Problem:** Hardware simulators have backdoors.
* **Solution:** Attested transition execution to prevent it.
* **Viability:** Medium. Very niche.

**39. How Close Are We? Measuring the Gap Between Dynamically and Statically Identified Indirect-Call Targets**
* **Rating:** 6/10 (Pure academic measurement).

---

## Category 4: Cryptography, Federated Learning & Privacy
*These align with your math, data, and GRC experience.*

**40. Decentralized Trustless Query-Based Collaborative Learning under Adversarial Heterogeneity**
* **Rating:** 8/10
* **Problem:** Collaborative learning without trusting a central server or sharing models.
* **Solution:** A purely query-based trustless learning framework.
* **Viability:** High. Good theoretical ML project.

**41. From Pre-trained to Private: A Compatible and Efficient Framework for Leveled Homomorphic Inference**
* **Rating:** 8.5/10
* **Problem:** Running inference on encrypted data is too slow.
* **Solution:** A framework to convert pre-trained models to run efficiently via Leveled Homomorphic Encryption.
* **Viability:** Medium. Heavy math and optimization.

**42. Registration-Based Encryption: Scalable and From Standard Lattice Assumptions**
* **Rating:** 7.5/10
* **Problem:** Key escrow in encryption.
* **Solution:** Lattice-based (Post-Quantum) Registration-Based Encryption.
* **Viability:** Medium. Very theoretical cryptography.

**43. TensorUnlearn: Efficient Approximate Machine Unlearning with Kronecker-Factored Tensor Networks**
* **Rating:** 7/10
* **Problem:** Unlearning data from ML models is computationally expensive.
* **Solution:** A highly optimized unlearning algorithm.
* **Viability:** Medium. Pure ML/Math.

**44. Off-Key: Inconsistent MAC Keys Cause Selective-Failure Attacks in SPDZ-Family MPC**
* **Rating:** 7/10
* **Problem:** Flaws in Multi-Party Computation (MPC).
* **Solution:** Exploit the protocol and fix it.
* **Viability:** Medium. Theoretical crypto.

**45. ReLAES: A First Look at Reinforcement Learning based Cryptanalysis of AES**
* **Rating:** 8/10
* **Problem:** Breaking AES is hard.
* **Solution:** Use RL to find weaknesses in reduced-round AES.
* **Viability:** High. Great AI + Crypto project.

**46. Secure Privacy-Budget Configuration for LLM-Powered Edge AI Systems**
* **Rating:** 7.5/10
* **Problem:** Differential privacy budgets are hard to configure on the edge.
* **Solution:** Automated DP budget management for edge LLMs.
* **Viability:** High.

**47. Gridmeta: Breaking Data Silos with Differentially Private Feeder Metadata**
* **Rating:** 6/10 (Smart Grid focus, slightly off CV).

**48. Zero-Knowledge Cloud Analytics**
* **Rating:** 7.5/10
* **Problem:** Querying cloud data leaks privacy.
* **Solution:** ZK-proofs for analytics queries.
* **Viability:** Medium. ZK math is complex.

**49. Scalable Private Top-k Retrieval via Rank-Based Selection**
* **Rating:** 6.5/10 (Algorithm optimization).

**50. From TOR to ORB28: Towards Formal Anonymity Guarantees**
* **Rating:** 7/10 (Network anonymity research).

**51. DTrack: Location Privacy Leakage in 5G Non-Terrestrial Networks**
* **Rating:** 7/10 (5G/Satellite privacy).

**52. STAMP: Stylometric Text Anonymization with Memory-guided Policy Optimization**
* **Rating:** 6/10 (NLP privacy).

---

## Category 5: Policy, HCI, Social Science, & Analytics (Avoid for FYP)
*These do not leverage your core technical skills. They are measurement studies or social sciences.*

* **53. Understanding Synthetic Politics on Reddit** (Rating: 2/10)
* **54. Measuring Behavioral Variation in Health-Focused Apps Globally** (Rating: 3/10)
* **55. Do Users’ Cookie Consent Choices Align With Privacy Preferences?** (Rating: 2/10)
* **56. Rethinking Email Verification for Identity, Trust, and Privacy** (Rating: 4/10)
* **57. Measuring Surveillance Exposure Without Touching It** (Rating: 5/10)
* **58. We are quite bad at this!** (Rating: 4/10)
* **59. Lessons from the Adoption and Deprecation of the Privacy Sandbox Web APIs** (Rating: 4/10)
* **60. A Privacy-by-Design Framework for Secure Telehealth Service in Advanced EHR Ecosystems** (Rating: 5/10 - GRC focus)
* **61. Portsmaxxing: Insights from Five Years of Port-Agnostic Honeynets** (Rating: 5/10 - Data analysis)
* **62. Learning the Wrong Lessons? Upskilling Strategies vs. Industry Expectations** (Rating: 2/10 - HR/Policy)
* **63. Toward Usable AI Transparency Signals** (Rating: 3/10 - UX/HCI)
* **64. The Visual Media Forensic Techniques are Ready. Is the vocabulary?** (Rating: 2/10 - Communication)
* **65. Information Flow Control in Public Vulnerability Disclosures** (Rating: 4/10)
* **66. CASTELLAN: Continuous Cybersecurity Governance Maturity Assessment** (Rating: 5/10 - GRC framework)
* **67. Operationalizing Welcoming in Cybersecurity Communities** (Rating: 1/10 - Sociology)
* **68. How Many Queries Does It Take to Break a Deepfake Detector?** (Rating: 6/10 - Audit)
* **69. Advances and Open Problems in Web Tracking** (Rating: 4/10 - Survey)
* **70. Rethinking the Evaluation of Secure Code Generation** (Rating: 5/10)
* **71. An In-Depth Analysis of the CodeQL Ecosystem** (Rating: 5/10 - Ecosystem analysis)
* **72. Measuring the Risk of Exposed Configurations in Serverless Environment** (Rating: 5/10 - Measurement)
* **73. Disentangling Cuts on Surveillance Graphs** (Rating: 3/10)
* **74. SynEval: A Multidimensional Framework for Evaluating Synthetic Data** (Rating: 5/10)
* **75. Understanding Risks of Semi-Drive-By Splash Ads** (Rating: 3/10)
* **76. Exploring the Limits of Audio-Based Detection of Turkish Phone Call Scams** (Rating: 4/10)
* **77. Ownership and Gatekeeping vs. Safeguarding and Consent (Migrant Parents Data)** (Rating: 1/10)
* **78. Seeing Is Believing? Trust, Authenticity... Synthetic Materials in Higher Education** (Rating: 1/10)
* **79. GHOSTCITE: A Large-Scale Analysis of Citation Validity...** (Rating: 3/10)
* **80. PreScam: A Benchmark for Predicting Scam Progression...** (Rating: 4/10)
* **81. Towards Automated Vulnerability Assessment of Public Models at Scale and Speed** (Rating: 6/10 - Work in progress review)
* **82. Lost in Translation: Text Message Spoofing via Email** (Rating: 4/10)
* **83. Beyond STRIDE: A Unified Multi-Attribute Framework for Trustworthy AI** (Rating: 5/10 - Framework)
* **84. DMI-RAG: Dual Mutual Information Optimization for Robust Graph-based RAG** (Rating: 6/10)
* **85. Beyond a Single Panel... LLM-Generated Attack Scenarios** (Rating: 5/10)
* **86. Attesting Model Lineage by Consisted Knowledge Evolution with Fine-Tuning Trajectory** (Rating: 6/10)
* **87. Every Fine-Tune Leaves a Mark: Measuring Behavioral Drift in Foundation Models** (Rating: 6/10)
* **88. Invisible Attack Surfaces in Ambient Invisible Intelligence** (Rating: 5/10)
* **89. A2ASecBench: A Protocol-Aware Security Benchmark for Agent-to-Agent Multi-Agent Systems** (Rating: 6/10)
* **90. Verification of Machine Learning Programs via Bitwise-Reproducible Operators** (Rating: 6/10)
* **91. Critical Evaluation of Quantum Machine Learning for Adversarial Robustness** (Rating: 6/10)
* **92. Just-in-Time Identity + Federated / Hierarchical Authorisation** (Rating: 7/10 - Strong IAM architecture, but more of an engineering task than a deep research FYP)

---
### Final Conclusion

For an FYP that will impress top-tier tech companies in 2027, you should absolutely select a project from **Category 1 (Agentic AI Security)** or **Category 3 (Systems/eBPF)**. 

Projects like **#1 (Red-Team Harness)**, **#2 (MCP Honeypot)**, **#16 (LLMs in Binary Exploitation)**, or **#30 (eBPF Ransomware Blocker)** perfectly bridge your existing CV skills into the highest-paying, most demanded sectors of 2026/2027 tech.
