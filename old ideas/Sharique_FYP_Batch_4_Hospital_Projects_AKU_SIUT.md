# Batch 4 Addendum: Hospital-Focused FYP Ideas for AKU and SIUT, Karachi

**Prepared for:** Sharique Baig and a three-person BSCS FYP team  
**Planning horizon:** 2026-2027  
**Scope:** Non-diagnostic, clinician-supervised systems for patient safety, operations, education and kidney-care workflows

## Grounding
AKU publicly highlighted ethical, context-aware AI and digital-intelligence research in LMIC settings, including cough analysis for tuberculosis, maternal/child health, cancer diagnostics, radiotherapy digital twins, respiratory diagnosis, dementia, public-health hotlines and nursing education. SIUT publicly lists nephrology, urology, transplantation, hemodialysis, critical care, pharmacy, diagnostics, biomedical engineering, medical education and research laboratories. These published domains make the projects below plausible collaboration proposals, but no partnership or data access is assumed.

## Ranking
1. Dialysis Safety and Infection-Prevention Copilot: 9.3/10
2. Privacy-Preserving Hospital Device and Workflow Anomaly Detection: 9.1/10
3. Offline Clinical Skills Simulation and Assessment Platform: 8.9/10
4. Transplant Follow-up and Medication Safety Navigator: 8.7/10
5. Hospital Equipment Traceability and Predictive Maintenance: 8.6/10
6. Urdu Patient Instruction and Comprehension System: 8.4/10
7. Emergency/OPD Patient-Flow Digital Twin: 8.2/10
8. Secure Research Data De-identification and Access Gateway: 8.8/10

# 1. Dialysis Safety and Infection-Prevention Copilot

## Best fit
SIUT, because its public service list includes hemodialysis, nephrology, transplantation, infectious diseases, nursing, pharmacy and biomedical engineering.

## Problem
Dialysis workflows involve repeated access to the bloodstream and require strong infection-prevention practice. Existing guidance includes audit tools and checklists for catheter care, fistula/graft procedures, station disinfection, injection safety and hand hygiene. Pakistan's national HAI guidance includes priority surveillance, dashboards, response, privacy and capacity building.

## Refined solution
A tablet/mobile system that guides a nurse or technician through institution-approved checklists, time-stamps completion, supports offline entry, flags incomplete steps before closure, and produces de-identified quality-improvement summaries. Optional low-cost QR/NFC identification can bind the checklist to the correct station, machine or consumable batch. It must not recommend treatment.

## Research contribution
- Human-factors design for high-throughput dialysis settings
- Offline-first workflow and synchronization
- Explainable process-compliance detection rather than disease prediction
- Privacy-preserving quality dashboards
- Study of checklist completion, documentation burden and near-miss capture

## Team split
1. Workflow/mobile/offline platform
2. Security, audit trail, QR/NFC and integration simulator
3. Analytics, usability study and evaluation

## Evaluation
Checklist completion, documentation time, omitted-step detection, false alerts, usability, offline recovery, audit integrity and simulated workflow errors. Clinical claims require hospital-led study and ethics approval.

## What to ask SIUT
A dialysis nurse/technologist and infection-control reviewer, sanitized workflow documents, simulation-lab access, and evaluation of prototype usability. Do not initially request patient records.

# 2. Privacy-Preserving Hospital Device and Workflow Anomaly Detection

## Best fit
AKU or SIUT biomedical engineering, IT/security, clinical engineering or patient-safety teams.

## Problem
Connected medical and support devices, workstations and embedded systems create operational and cybersecurity risk, but raw telemetry can be sensitive and device downtime is unacceptable.

## Refined solution
A passive, laboratory-only monitoring gateway that learns device/network behavior, inventories approved assets, detects unusual communication or configuration change, and produces evidence-backed alerts. Use simulated devices or an isolated biomedical test bench, never active scanning of clinical networks without written authorization.

## Novelty
Fuse cybersecurity telemetry with operational context and use federated or local learning so raw traces stay within each simulated ward/site. This aligns strongly with Sharique's appsec, federated learning, IoT and agentic security experience.

## Evaluation
Detection on controlled scenarios, false alarms, latency, encrypted-traffic metadata usefulness, device diversity, concept drift and privacy leakage. No claims about safety improvements without hospital validation.

# 3. Offline Clinical Skills Simulation and Assessment Platform

## Best fit
AKU's Centre for Innovation in Medical Education or SIUT's Skills Lab, nursing and medical-technology programmes.

## Problem
Clinical skills education needs repeatable practice, structured feedback and low-cost simulation. AKU has publicly showcased AI-supported nursing learning, while SIUT publicly lists a Skills Lab and medical education programmes.

## Refined solution
A low-cost sensorized training station for one bounded task such as hand-hygiene sequence, sterile field setup, dialysis station preparation or equipment setup. Sensors record task order/timing; a rules engine gives immediate feedback using an institution-approved rubric. Do not attempt autonomous grading of professional competence.

## Hardware
ESP32, RFID/QR, load/contact/proximity sensors and a local tablet/PC dashboard. Video should be optional and privacy-minimized.

## Evaluation
Sensor accuracy, rubric agreement with instructors, setup time, learner usability, repeatability and equipment cost. Any student study needs approval and consent.

# 4. Transplant Follow-up and Medication Safety Navigator

## Best fit
SIUT transplant, nephrology, pharmacy, nutrition and medical-social-services teams.

## Problem
Long-term follow-up involves appointments, tests, medication routines and patient education. The system should support adherence and communication, not diagnose rejection or change treatment.

## Refined solution
An Urdu/Sindhi/English patient navigator delivering hospital-authored reminders, teach-back questions, missed-follow-up escalation to staff and a simple medication schedule. It should operate through a low-bandwidth app or approved messaging channel and avoid storing more clinical data than necessary.

## Research angle
Comprehension-aware reminders, offline/low-connectivity design, caregiver mode, privacy, accessibility and intervention timing.

## Evaluation
Comprehension, task completion in a simulated study, reminder usability, accessibility, privacy threat model and message-delivery reliability. Real adherence/outcome studies require clinician ownership and ethics approval.

# 5. Hospital Equipment Traceability and Predictive Maintenance

## Best fit
SIUT biomedical engineering; AKU clinical engineering, operations or facilities.

## Problem
Hospitals need equipment availability, maintenance history and rapid fault reporting. A student FYP should not control life-critical equipment.

## Refined solution
QR/NFC-based asset identity, maintenance logs, fault triage, spare-part tracking and optional non-invasive current/vibration/temperature sensing on safe laboratory devices. Predict maintenance priority from service history and sensor trends, with engineers making final decisions.

## Research contribution
Low-cost retrofit design, intermittent connectivity, tamper-evident records, explainable prioritization and total-cost analysis.

## Evaluation
Asset-location accuracy in a test area, logging completeness, fault-classification accuracy on seeded faults, false alarms, maintenance time and sensor reliability.

# 6. Urdu Patient Instruction and Comprehension System

## Best fit
AKU patient education/public-health teams or SIUT nephrology, transplant, nutrition and medical-social-services teams.

## Problem
Discharge and procedure instructions can be misunderstood, especially when language, literacy and medical terminology differ.

## Refined solution
Convert hospital-approved instructions into Urdu/Sindhi audio, illustrated steps and teach-back questions. Retrieval must be restricted to approved material, and any uncertain query must route back to staff rather than generate medical advice.

## Novelty
Evaluate comprehension and safety for Urdu, Roman Urdu and code-switching, with provenance and constrained generation.

## Evaluation
Factual faithfulness to approved content, comprehension, reading level, accessibility, hallucination rate, escalation correctness and usability. Clinicians must approve all content.

# 7. Emergency or OPD Patient-Flow Digital Twin

## Best fit
AKU hospital operations or SIUT OPD/dialysis operations.

## Problem
Queueing, room use, diagnostic turnaround and staffing interact, but a student system should not make autonomous clinical-priority decisions.

## Refined solution
A discrete-event simulation using synthetic or de-identified operational timestamps. Test appointment spacing, counter allocation, transport routes or dialysis-chair scheduling. Keep clinical triage outside the optimization unless hospital clinicians define and supervise it.

## Research contribution
Robust optimization under uncertain arrivals, fairness constraints, explainable scenario comparison and validation against historical aggregate patterns.

## Evaluation
Wait time, throughput, utilization, overtime, robustness and fairness across simulated scenarios. This needs operational data or a credible synthetic model.

# 8. Secure Research Data De-identification and Access Gateway

## Best fit
AKU research/ethics/clinical-trials teams or SIUT SIMS/research laboratories/biomedical ethics.

## Problem
Research datasets can contain identifiers in structured fields, free text and filenames; naïve redaction can either leak information or destroy utility.

## Refined solution
A secure ingestion pipeline that discovers identifiers, applies configurable de-identification, records provenance, tests re-identification risk and enforces purpose-bound access. Start with synthetic data and hospital-approved schemas.

## CV fit
Excellent match for Sharique's GRC, privacy-preserving ML, security reporting and secure software development.

## Evaluation
PII recall/precision, utility preservation, adversarial obfuscation, access-policy correctness, audit integrity and human-review workload.

# Projects to avoid
- Autonomous diagnosis or treatment recommendation
- Unvalidated patient deterioration prediction
- Robot medication delivery in live wards
- Active scanning or penetration testing of clinical networks
- Face recognition for patients or staff
- Recording consultations without explicit consent and governance
- A generic hospital chatbot

# Collaboration route

## AKU
Approach the Research Office, relevant clinical department, Centre for Innovation in Medical Education, nursing education, clinical engineering or hospital operations depending on the chosen project. AKU publicly emphasizes research governance, ethics and contextually relevant AI in LMIC settings, so lead with a bounded research question, ethics plan, synthetic-data fallback and human oversight.

## SIUT
For kidney/dialysis projects, approach SIMS/medical education and the relevant nephrology, dialysis, infection-control, pharmacy, biomedical-engineering or research group. SIUT publicly lists medical education, a Skills Lab, research laboratories, hemodialysis, transplant and biomedical engineering, giving several plausible routes.

## What to request first
- One clinical champion
- One workflow walkthrough using no patient identifiers
- Institution-approved checklist/rubric or synthetic schema
- Simulation-lab or test-bench access
- Review of evaluation metrics

## What the hospital receives
- Controlled prototype
- Usability and technical findings
- De-identified quality-improvement dashboard or teaching module
- Documentation and deployment requirements
- No claim of clinical benefit unless the hospital leads a suitable study

# Final recommendation
For SIUT, the best proposal is the **Dialysis Safety and Infection-Prevention Copilot**, followed by the **Transplant Follow-up Navigator** and **Equipment Traceability**. For AKU, the strongest are the **Offline Clinical Skills Platform**, **Secure Research Data Gateway**, and **Privacy-Preserving Device/Workflow Anomaly Detection**.

The single best fit with Sharique's complete CV is the privacy-preserving device/workflow security project. The clearest hospital-specific, socially valuable project is the dialysis safety copilot. The easiest route to a safe pilot is the clinical skills simulation platform because it can be evaluated away from live patient care.

# Sources
- AKU AI research showcase: https://www.aku.edu/news/pages/News_Details.aspx?nid=NEWS-003848
- AKU research governance and infrastructure: https://www.aku.edu/research/Pages/home.aspx
- SIUT services and education: https://siut.org/
- SIMS/SIUT medical education: https://sims.siut.edu.pk/
- SIUT research laboratories: https://siut.org/diagnostic-services/research-laboratories/
- Pakistan National HAI Guidelines: https://www.nih.org.pk/wp-content/uploads/2025/12/National%20HAI%20Surveillance%20and%20Response%20Implementation%20Guidelines%202025%20%281%29.pdf
- CDC dialysis safety tools: https://www.cdc.gov/dialysis-safety/hcp/tools/index.html
