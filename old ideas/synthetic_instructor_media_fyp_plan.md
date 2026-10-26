# Seeing Is Believing? A Full FYP Continuation Plan for Trust, Authenticity, and Security of Synthetic Instructor Media

**Project type:** Final Year Project / undergraduate human-centred security research  
**Primary domains:** Human-computer interaction, usable security, educational technology, synthetic media, misinformation, media provenance, behavioral research  
**Recommended scope:** Replication, controlled experiment, safeguard evaluation, and governance prototype  
**Potential local context:** Higher education in Pakistan, with English and Urdu instructional media, if ethically and operationally feasible

---

## 1. Executive verdict

### Is this a good FYP topic?

**Yes, if it is redesigned as a sufficiently powered experiment that tests safeguards, not merely repeated with a few more participants.** The poster is explicitly an in-progress pilot study. It examines whether a synthetic lecturer identity and formal lecture presentation can make accurate, partly inaccurate, or inaccurate material appear legitimate. Its preliminary observation is that responses remained broadly stable across three accuracy conditions and that participants often relied on instructor identity, delivery, and lecture format.

The topic is academically strong because it sits at the intersection of:

- human-centred cybersecurity;
- deepfake and synthetic-media risk;
- trust in automation;
- misinformation and epistemic security;
- educational technology;
- experimental psychology;
- content provenance and authentication;
- university governance.

However, the original study has only 13 participants, including 11 students and 2 academic staff members. That is suitable for an exploratory pilot but too small for strong statistical conclusions, subgroup comparisons, or broad claims about students and academics. Its design also combines several factors that should be separated, especially synthetic identity, instructor familiarity, content accuracy, subject knowledge, disclosure, provenance, and distribution channel.

### Recommended FYP direction

The strongest continuation is:

> **A larger, pre-registered human-centred security experiment that separates instructor identity from media authenticity and content accuracy, then tests whether disclosure labels, provenance indicators, source verification, and media-literacy interventions reduce acceptance of misleading synthetic lectures without creating excessive distrust in genuine academic media.**

This is stronger than asking only whether participants can detect a deepfake. The practical security problem is not simply “Is this video synthetic?” It is:

1. Is the claimed instructor really the source?
2. Has the institution authorized the media?
3. Is the content academically correct?
4. Can learners verify origin and revisions?
5. Which safeguard helps without causing blanket distrust?

---

## 2. What was the research purpose?

The poster studies a high-trust academic threat: a synthetic video appears to show a legitimate professor delivering a lecture, while the content may be accurate, partly inaccurate, or false.

Its purpose was to investigate three related questions:

1. **Perceived authenticity:** Are synthetic instructor videos accepted as legitimate academic media?
2. **Acceptance of misinformation:** Does instructor impersonation increase acceptance of inaccurate instructional content, and can users distinguish different levels of accuracy?
3. **Security consequences:** What risks arise when trusted instructor identity, institutional presentation, and synthetic media are combined?

The study's wider concern is that publicly available faculty images, recordings, and voices may be reused to create persuasive instructional misinformation, fraudulent requests, or identity-based deception. It also recognizes a non-malicious route: an institution may lawfully generate synthetic teaching media but release inaccurate content because governance and review are weak.

This distinction is important. The threat is not only an attacker producing a fake lecture. It also includes an authorized workflow producing misleading media without adequate validation.

---

## 3. What did they do?

## 3.1 Study design

The researchers used a **within-subjects pilot design**. Every participant viewed three synthetic lecture-style videos:

- **Accurate (A):** fully correct content;
- **Partially Accurate (pA):** minor, plausible inaccuracies;
- **Inaccurate (I):** more visible errors while remaining fluent.

The order was randomized.

## 3.2 Participants

The study recruited 13 participants:

- 11 university students;
- 2 academic staff members.

This allowed an initial observation of learners and domain experts, but not a statistically credible comparison between those groups.

## 3.3 Stimulus creation

Two professors consented to use of:

- publicly available profile images;
- short voice recordings;
- a slide from normal teaching material;
- about one minute of spoken explanation.

Three synthetic lecture videos were generated using HeyGen's Deepfake Maker. The videos were standardized for length, pace, layout, and structure. The intended manipulated feature was content accuracy.

## 3.4 Procedure

Participants were told that they would evaluate AI-generated lecture videos, but they were not told that some videos contained inaccuracies. This limited withholding was intended to reduce demand characteristics.

After each video, participants completed questionnaires on:

- perceived trustworthiness;
- perceived accuracy;
- confidence in their judgment;
- affective response.

After all videos, participants completed a semi-structured interview on:

- evaluation strategies;
- cues used;
- suspicion;
- likely real-world response.

The intended quantitative analysis was repeated-measures comparison. Interview data were to undergo thematic analysis.

## 3.5 Preliminary findings

The poster reports broadly stable responses across conditions. Participants appeared to rely more on the portrayed instructor's professional identity, delivery style, and lecture format than on careful content verification. Some subtle inaccuracies were reportedly overlooked by students and academic staff. The authors therefore argue for content checking, review procedures, provenance, disclosure, and source authentication.

These findings should be treated as **preliminary observations**, not population estimates or proof of causal effects.

---

## 4. Main research domains

## 4.1 Human-centred security and usable security

The central question is how humans make security and authenticity judgments in a trusted interface. The user, not only the generator or detector, is part of the security system.

## 4.2 Human-computer interaction

The project studies how interface cues, labels, presentation style, source indicators, and verification controls affect perception and behavior.

## 4.3 Educational technology

Synthetic instructors may support scalable, multilingual, accessible, and reusable teaching, but quality assurance and authorization become essential.

## 4.4 Misinformation and epistemic security

The attack targets how learners decide what is true. Instructor identity and institutional context can function as credibility shortcuts.

## 4.5 Synthetic media and deepfake security

The media reproduces the face, voice, and presentation style of a known person. Relevant risks include impersonation, consent failure, fraud, and unauthorized distribution.

## 4.6 Behavioral and experimental research

The design requires randomization, validated measures, power analysis, manipulation checks, mixed-effects analysis, and careful treatment of repeated measures.

## 4.7 Content provenance and media authentication

Provenance systems can record origin and editing history. C2PA describes Content Credentials as an open technical standard for establishing digital content origin and edits [1]. However, provenance is not equivalent to factual correctness. A valid credential can identify who issued a video without proving that the lecture content is true. An independent 2026 analysis further argues that C2PA should not be treated as sufficient for high-stakes authenticity claims [2].

## 4.8 Privacy, ethics, and governance

Faculty likeness and voice are personal and professional assets. The study therefore involves consent, withdrawal, secure storage, controlled deception, debriefing, reputation protection, and institutional authorization.

---

## 5. Why the research matters

A review of deepfakes in higher education identified detection, malicious applications, and beneficial uses as major themes, and called for a cross-cultural research agenda in tertiary education [3]. A later mixed-methods review described both instructional opportunities and risks involving impersonation, privacy, integrity, and governance, and proposed transparency, data governance, integrity/detection, and ethical oversight as governance pillars [4].

Human judgment is also not a reliable standalone defense. A systematic review of human deepfake detection found wide variation across studies, inconsistent measures, and effects from person-level and stimulus-level factors such as analytical thinking, fake quality, and familiarity with the portrayed person. It also found mixed results for interventions [5].

The FYP should therefore move from merely documenting vulnerability toward comparing concrete defenses.

---

## 6. Limitations of the current study

## 6.1 Very small sample

Thirteen participants are insufficient for robust hypothesis testing, stable effect estimates, or generalization. The staff subgroup contains only two participants, so any apparent staff/student difference is anecdotal.

### Opportunity

Conduct an a priori power analysis based on the final design and recruit a sufficiently large sample. Do not choose a target merely because it is convenient.

## 6.2 An in-progress results section

The study says questionnaire data “will be analysed” while also presenting broad findings. The available poster does not provide full descriptive statistics, inferential tests, uncertainty intervals, scale reliability, effect sizes, exclusions, or interview coding detail.

### Opportunity

Pre-register hypotheses, exclusions, primary outcomes, models, and confirmatory analyses. Report effect sizes and confidence intervals even when results are not statistically significant.

## 6.3 No authentic-human video control

All participants apparently evaluated synthetic videos. Therefore, the study cannot fully separate:

- trust caused by the instructor identity;
- trust caused by lecture format;
- trust caused by synthetic realism;
- trust that would also exist for an authentic recording.

### Opportunity

Add genuine instructor recordings with the same content conditions, subject to ethics approval. A factorial design can test **media origin × content accuracy**.

## 6.4 Participants were told videos were AI-generated

This disclosure may reduce ecological validity and alter suspicion, trust, or attention. Yet an undisclosed design raises greater ethical concerns.

### Opportunity

Test transparent disclosure as an experimental factor with ethics-approved wording and debriefing. Compare:

- explicit “AI-generated instructor video” disclosure;
- institutionally authorized synthetic-media label;
- provenance/source panel;
- ordinary course-page presentation.

Do not use covert deepfake exposure without formal ethics approval and a clear debriefing plan.

## 6.5 Content accuracy may be confounded with error salience

The partially inaccurate condition contains subtle plausible inaccuracies, while the inaccurate condition contains more salient errors. This changes not only accuracy but also obviousness, semantic severity, and possibly fluency.

### Opportunity

Create a validated error taxonomy:

- minor factual error;
- conceptual misconception;
- incorrect procedure;
- fabricated citation;
- unsafe instruction, only where ethically appropriate and non-harmful;
- administrative misinformation;
- fraudulent request, in a separate simulated scenario.

Pilot-test each item for difficulty and salience using independent subject-matter experts.

## 6.6 Only three short videos

With three videos, content topic, professor identity, slide design, accuracy condition, and video instance may become entangled.

### Opportunity

Use multiple topics, instructors, and items per condition. Counterbalance assignment so that the same base content appears in different conditions across participants rather than permanently assigning one topic to one accuracy level.

## 6.7 Instructor familiarity is not controlled

A familiar professor may inspire trust, but familiarity can also make synthetic defects easier to notice. The study does not clearly separate familiar and unfamiliar identities.

### Opportunity

Measure familiarity and experimentally compare:

- own instructor;
- same-university unfamiliar instructor;
- unfamiliar instructor from another institution;
- neutral synthetic presenter without a real person's identity.

## 6.8 Domain knowledge is weakly measured

Participants can detect academic errors only if they know the topic. Two academic staff members are not necessarily experts in the exact lecture subjects.

### Opportunity

Administer a pre-test or independent domain-knowledge measure. Model knowledge as a moderator and recruit subject-matter experts for a defined subset.

## 6.9 Trust, authenticity, and correctness may be conflated

A video can be:

- genuinely issued by an institution but contain an error;
- synthetic but accurately authorized;
- visually authentic but maliciously edited;
- factually accurate but falsely attributed.

### Opportunity

Measure distinct constructs:

1. perceived media authenticity;
2. perceived source authorization;
3. perceived content correctness;
4. trust in instructor;
5. trust in institution;
6. willingness to act or share;
7. verification intention;
8. confidence calibration.

## 6.10 Self-report does not equal behavior

A participant may say they would verify a video but not actually do so.

### Opportunity

Include behavioral outcomes:

- whether the participant opens a source-verification panel;
- whether they check course materials;
- whether they flag an error;
- whether they share or save the video;
- time spent before accepting an answer;
- whether they follow a simulated low-risk request.

Do not include real financial, credential, or reputational consequences.

## 6.11 No safeguard comparison

The study recommends provenance, disclosure, review, and verification but does not test which safeguard works.

### Opportunity

Make safeguard evaluation the central FYP contribution.

## 6.12 Single tool and likely limited synthetic variation

One generation platform and a small number of instructor videos cannot represent the range of synthetic-media quality.

### Opportunity

Use several generation-quality levels or production workflows, while keeping identity use consented. Analyze whether realism moderates trust and error detection.

## 6.13 Limited cultural and institutional diversity

Trust in lecturers and institutional authority can vary across cultures, disciplines, teaching modes, and universities.

### Opportunity

A Pakistan-based replication can be valuable if framed as a context-specific study rather than a universal claim. Compare English, Urdu, or bilingual instructional content only if translation quality and subject difficulty are controlled.

## 6.14 Interview analysis lacks reported rigor

The poster says interviews will be analyzed thematically but does not present the coding framework, researcher reflexivity, saturation rationale, double coding, or disagreement procedure.

### Opportunity

Publish a codebook, double-code a substantial sample, resolve differences transparently, and link qualitative themes to quantitative behavior.

## 6.15 No longitudinal measurement

The study measures immediate reactions. It does not show whether participants remember incorrect claims or whether later correction works.

### Opportunity

Add delayed tests for misinformation retention, source memory, and correction effectiveness.

## 6.16 Provenance may be misunderstood as truth verification

C2PA-style credentials can provide information on origin and edits [1], but provenance does not prove academic correctness. The 2026 independent critique emphasizes a distinction between file provenance and truthful representation [2].

### Opportunity

Test whether participants over-trust a valid institutional credential. This is a novel and important FYP question:

> Does a verified source badge increase trust in authorized but inaccurate synthetic content?

---

## 7. Recommended FYP research direction

### Recommended title

**Verified but Wrong? Evaluating Disclosure, Provenance, and Media Literacy Against Misleading Synthetic Instructor Videos**

### Alternative title

**Trusting the Synthetic Lecturer: A Controlled Study of Identity, Content Accuracy, Source Verification, and Academic Misinformation**

### Pakistan-context option

**Trust and Verification of Synthetic Instructor Media in Pakistani Higher Education: A Human-Centred Security Study**

Use the Pakistan-specific title only if the participant sample and institutional setting genuinely support it.

### Novelty statement

> Unlike prior pilot work that compares accuracy levels only within synthetic lecture videos, this project separates media origin, instructor familiarity, content correctness, and authorization, then evaluates which safeguards improve correct judgment without causing indiscriminate distrust of genuine educational media.

---

## 8. Recommended aim

> To determine how synthetic instructor identity, content accuracy, instructor familiarity, and institutional source signals affect learners' trust and verification behavior, and to evaluate whether disclosure, provenance, and media-literacy safeguards reduce acceptance of inaccurate educational content without undermining justified trust in authentic media.

---

## 9. Recommended research questions

### RQ1: Authenticity and correctness

How accurately can students distinguish media origin and content correctness, and are these judgments correlated or independent?

### RQ2: Identity and familiarity

Does a familiar or institutionally affiliated instructor identity increase acceptance of inaccurate content?

### RQ3: Disclosure

Does clear synthetic-media disclosure improve judgment, and does it also reduce trust in accurate synthetic education?

### RQ4: Provenance

Does a source-verification interface improve detection of unauthorized media, and does it create over-trust in authorized but inaccurate media?

### RQ5: Literacy intervention

Can a short verification intervention improve discrimination while preserving trust in accurate media?

### RQ6: Expertise

How do domain knowledge, AI literacy, analytical thinking, and instructor familiarity moderate decisions?

### RQ7: Behavior

Do participants actually verify, flag, or avoid sharing questionable content, rather than merely report that they would?

### RQ8: Retention

Are inaccuracies retained after delay, and which correction method reduces false memory?

---

## 10. Hypotheses

- **H1:** Instructor familiarity will increase perceived source legitimacy, including when content is inaccurate.
- **H2:** Content knowledge will improve correctness detection more strongly than visual deepfake-detection confidence.
- **H3:** Disclosure will improve recognition that media is synthetic but will not by itself guarantee detection of factual errors.
- **H4:** Provenance will improve source-authentication decisions but may increase acceptance of inaccurate content when the source is valid.
- **H5:** A combined intervention explaining source verification and content verification will outperform a synthetic-media label alone.
- **H6:** An intervention may create over-skepticism toward authentic or accurate media, so both false acceptance and false rejection must be measured.
- **H7:** Behavioral verification will be less frequent than self-reported verification intention.
- **H8:** Participants exposed to uncorrected inaccuracies will retain more false claims at delayed testing than those receiving immediate evidence-based correction.

These are proposed hypotheses and should be finalized before data collection.

---

## 11. Recommended experimental design

A full factorial design can become too large. Use a focused core design and optional extensions.

## 11.1 Core factors

### Factor A: Media origin

- authentic human recording;
- authorized synthetic instructor recording.

### Factor B: Content accuracy

- accurate;
- partially inaccurate;
- inaccurate.

### Factor C: Safeguard

- ordinary presentation;
- synthetic-media disclosure;
- source/provenance verification interface;
- combined disclosure + verification guidance.

This is a **2 × 3 × 4** conceptual design. It does not require every participant to see all 24 combinations. Use a balanced mixed design to control fatigue.

## 11.2 Optional factor: identity familiarity

- familiar instructor;
- unfamiliar instructor;
- neutral avatar.

Add this only if recruitment and stimulus preparation can support it without confounding instructor with topic.

## 11.3 Mixed design recommendation

A practical structure is:

- **between subjects:** safeguard condition;
- **within subjects:** media origin and content accuracy;
- **random effects:** participant, instructor, topic, and video item.

This avoids making participants repeatedly see every safeguard and infer the study's purpose.

## 11.4 Counterbalancing

- randomize presentation order;
- rotate which topic receives each accuracy condition;
- rotate authentic/synthetic versions across participants;
- avoid showing the same participant both versions of identical text unless that is a deliberate matched test;
- keep length, slide visual, audio level, pace, and resolution controlled;
- record item IDs and generation settings.

---

## 12. Stimulus-development plan

## 12.1 Content selection

Choose several low-risk academic topics for which correctness can be independently established. Avoid medical, legal, financial, or dangerous procedural content unless specialist oversight and stronger ethics approval exist.

## 12.2 Ground truth

For every script:

1. cite authoritative course sources;
2. obtain review from at least two subject-matter experts;
3. label every manipulated claim;
4. classify error severity and plausibility;
5. preserve a version history;
6. pilot-test difficulty using participants who will not join the main study.

## 12.3 Error taxonomy

- terminology substitution;
- wrong causal relationship;
- incorrect formula interpretation;
- swapped step/order;
- false statistical claim;
- fabricated source;
- outdated fact presented as current;
- incorrect administrative instruction.

Do not place harmful instructions into a realistic release environment.

## 12.4 Synthetic media production

Use only instructors who give documented consent covering:

- face and voice use;
- synthetic transformation;
- exact study context;
- storage period;
- who can view the stimuli;
- publication screenshots;
- withdrawal conditions;
- destruction or retention of generated assets.

## 12.5 Realism manipulation

Optional levels:

- low realism;
- medium realism;
- high realism.

Have an independent pilot group rate realism before the main experiment. Do not infer quality solely from the generation tool used.

## 12.6 Institutional channel simulation

A controlled interface can simulate:

- official learning-management-system page;
- ordinary video link;
- unverified message attachment.

The study must clearly avoid real impersonation or public distribution. Use a contained research interface and debrief participants.

---

## 13. Safeguards to evaluate

## 13.1 Disclosure label

Example concept:

```text
This video uses an AI-generated representation of the instructor.
The script was reviewed and authorized by the course team.
```

Test wording through a pilot. Avoid implying correctness merely because a review occurred.

## 13.2 Provenance/source panel

Show information such as:

- issuing institution;
- course;
- named approving role;
- creation or revision identifier;
- synthetic-media status;
- link to authoritative transcript/slides;
- verification result.

C2PA presents Content Credentials as a mechanism for establishing origin and edits [1]. In your prototype, distinguish a **verified source** from **verified correctness**. Do not claim that a credential proves academic truth.

## 13.3 Dual verification

Use two independent indicators:

1. **Source verified:** the institution authorized the asset.
2. **Content reviewed:** a named course process approved this version.

Then test whether users understand the difference.

## 13.4 Media-literacy intervention

A brief intervention can teach participants to:

- verify the course source;
- inspect the official transcript/slides;
- distinguish identity authenticity from factual correctness;
- check suspicious claims against authoritative materials;
- report discrepancies.

Digital-literacy studies have found that interventions can improve deepfake discernment, but other research warns that interventions can also increase distrust in genuine media [6][7]. Therefore, evaluate both benefits and over-skepticism.

## 13.5 Reporting workflow

Provide a low-friction button:

```text
Report possible content or source problem
```

Measure whether participants use it and what evidence they provide.

---

## 14. Participant plan

## 14.1 Population

Potential groups:

- undergraduate students;
- postgraduate students;
- teaching staff;
- instructional designers or administrators, if accessible.

Do not present staff/student comparisons unless each group is adequately sampled.

## 14.2 Sample size

Conduct an a priori power analysis after fixing:

- primary outcome;
- repeated-measures structure;
- expected minimum effect of interest;
- number of conditions;
- planned mixed-effects model;
- attrition/exclusion assumptions.

Do not copy the original sample size. The goal is a defensible estimate, not simply “more than 13.”

## 14.3 Recruitment and sampling

- recruit across more than one class if possible;
- avoid recruiting only students of participating instructors;
- record discipline and study level;
- document convenience-sampling limits;
- provide equivalent compensation where applicable;
- avoid any perception that course grades depend on participation.

## 14.4 Individual-difference measures

Possible moderators:

- topic knowledge;
- instructor familiarity;
- AI literacy;
- prior exposure to synthetic media;
- general trust in institution;
- cognitive reflection or analytical thinking;
- frequency of online lecture use.

Use only validated or clearly justified instruments, and limit survey length.

---

## 15. Outcome measures

## 15.1 Primary outcomes

Choose one or two before data collection:

- content-correctness discrimination;
- unauthorized-source detection;
- behavioral verification rate;
- acceptance/action based on inaccurate content.

## 15.2 Secondary outcomes

- perceived authenticity;
- trustworthiness;
- perceived correctness;
- confidence;
- willingness to share;
- willingness to use in assessment preparation;
- reporting behavior;
- response time;
- memory for source;
- delayed misinformation retention.

## 15.3 Signal-detection outcomes

Treat judgment as more than percent correct. Compute:

- hit rate;
- false-alarm rate;
- sensitivity/discrimination;
- response bias;
- calibration between confidence and correctness.

This detects whether a safeguard improves discrimination or merely makes everyone suspicious.

## 15.4 Qualitative outcomes

Interview themes may include:

- authority cues;
- visual/audio cues;
- content reasoning;
- institutional trust;
- verification barriers;
- reactions to disclosure;
- understanding of provenance;
- correction preferences;
- perceived responsibility.

---

## 16. Analysis plan

## 16.1 Quantitative analysis

Recommended methods:

- mixed-effects logistic regression for correct/incorrect decisions;
- ordinal or linear mixed models for rating scales, depending on scale properties;
- random intercepts for participant and item;
- random effects for instructor/topic when justified;
- planned contrasts for safeguard comparisons;
- interaction tests for media origin × accuracy × safeguard;
- moderation by knowledge and familiarity;
- reliability analysis for multi-item scales;
- effect sizes and 95% confidence intervals.

Repeated-measures ANOVA may be a simple baseline, but mixed models better support crossed participants and stimuli and incomplete observations.

## 16.2 Multiple comparisons

Define primary contrasts in advance. Correct exploratory comparisons or label them clearly as exploratory.

## 16.3 Missing data and exclusions

Pre-register:

- failed attention checks;
- incomplete sessions;
- technical playback failure;
- prior knowledge of stimuli;
- impossible response times;
- missing delayed-test data.

Report participant flow and reasons for exclusion.

## 16.4 Qualitative analysis

- create a codebook;
- double-code a meaningful subset;
- report disagreement resolution;
- document reflexivity;
- preserve anonymized evidence excerpts where consent permits;
- integrate themes with observed behavior.

## 16.5 Mixed-method integration

Use a joint display connecting:

```text
quantitative behavior | interview explanation | design implication
```

For example, a participant may rate content as doubtful but still not open the verification panel. That discrepancy is a useful finding.

---

## 17. Critical experiments

## Experiment 1: Authentic versus synthetic

Use matched authentic and authorized synthetic recordings to establish whether synthetic origin itself changes trust or error detection.

## Experiment 2: Familiarity

Compare familiar and unfamiliar instructor identities while controlling topic and production quality.

## Experiment 3: Disclosure label

Test whether disclosure improves source understanding and whether it lowers justified trust in accurate synthetic media.

## Experiment 4: Provenance versus correctness

Create four conceptual cases:

1. verified source + accurate content;
2. verified source + inaccurate content;
3. unverified source + accurate content;
4. unverified source + inaccurate content.

This directly tests whether users incorrectly interpret provenance as proof of truth.

## Experiment 5: Media-literacy intervention

Compare no intervention, label explanation, and verification training. Measure both false acceptance and false rejection.

## Experiment 6: Behavioral verification

Provide optional authoritative sources and observe whether participants inspect them before deciding.

## Experiment 7: Delayed memory and correction

Measure claim recall and source memory after a delay. Compare immediate correction, delayed correction, and no correction, if ethics approval permits.

## Experiment 8: Language and code-switching

If conducted in Pakistan, compare carefully matched English, Urdu, or bilingual content. Treat this as an extension because translation and language proficiency can become confounds.

## Experiment 9: Distribution channel

Compare an official simulated course page with an unverified link or message. Test whether channel cues overpower content checking.

## Experiment 10: Authorized workflow failure

Present an institutionally authorized synthetic video with a subtle error. This models insufficient quality assurance rather than malicious impersonation.

---

## 18. Evaluation framework

## 18.1 Scientific quality

- pre-registration completion;
- statistical power;
- manipulation-check success;
- scale reliability;
- item and participant coverage;
- confidence-interval width;
- reproducibility of analysis;
- consistency between confirmatory and exploratory results.

## 18.2 Security effectiveness

- reduction in false acceptance of inaccurate content;
- improvement in unauthorized-source detection;
- verification behavior rate;
- reporting rate;
- time to identify a problem;
- persistence of protection at delayed testing.

## 18.3 Cost of safeguards

- false rejection of authentic or accurate media;
- reduction in justified institutional trust;
- additional decision time;
- label fatigue;
- verification-interface abandonment;
- misunderstanding of provenance;
- accessibility burden.

## 18.4 Usability

- perceived clarity;
- ability to distinguish “source verified” and “content reviewed”;
- task completion;
- interface errors;
- qualitative usability barriers.

## 18.5 Governance readiness

- traceability of approval;
- ability to revoke or update content;
- version identification;
- documented consent;
- reporting and correction workflow;
- accountability assignment.

---

## 19. Prototype opportunity

A strong FYP can include a research prototype called, for example, **Verified Lecture**.

### Prototype functions

- play authentic or synthetic lecture media;
- display synthetic-media disclosure;
- show source and revision information;
- distinguish source verification from content review;
- link to authoritative slides/transcript;
- allow discrepancy reporting;
- log verification interactions for the experiment;
- show corrected versions and change history.

### Example interface

```text
Instructor representation: AI-generated with consent
Source authorization: Verified by the university
Content review: Reviewed for course release
Version: 1.2
Last revision: [research-controlled value]

[View source record] [Compare transcript] [Report a problem]
```

The prototype should not claim that a technical provenance check proves factual accuracy.

---

## 20. Ethics and safety plan

## 20.1 Instructor protection

- obtain explicit written consent;
- define exact permitted scripts and outputs;
- prohibit reuse outside the study;
- watermark research copies where appropriate;
- restrict download and public links;
- store face and voice material securely;
- agree a deletion/retention schedule;
- allow withdrawal subject to documented research constraints;
- avoid statements that could damage the instructor's reputation.

## 20.2 Participant protection

- obtain informed consent;
- disclose synthetic-media exposure at the ethically required level;
- use only IRB/ethics-approved withholding;
- provide a full debrief;
- correct every false academic claim before participants leave or at the approved stage;
- collect only necessary personal data;
- allow withdrawal without academic penalty;
- avoid recruitment power imbalances.

## 20.3 Misinformation containment

- use a closed research platform;
- do not post deceptive videos publicly;
- use non-harmful subject matter;
- embed study identifiers;
- maintain an asset inventory;
- revoke access after data collection;
- ensure participants receive correct reference material.

## 20.4 Data management

Separate:

- identifiable consent records;
- response data;
- interview recordings;
- synthetic media assets;
- participant contact details;
- code and anonymized results.

Use role-based access and a documented retention schedule.

## 20.5 Responsible claims

Do not state that:

- participants “believed deepfakes” merely because trust scores were high;
- provenance proves truth;
- one university represents all higher education;
- staff are immune or uniquely vulnerable;
- synthetic lectures are inherently harmful;
- a label solves the security problem.

---

## 21. Timeline

### Weeks 1–4: literature and research framing

- review human deepfake detection, trust in automation, educational misinformation, provenance, and correction;
- define threat model;
- select core factors;
- identify safe topics and instructors;
- draft ethics and data-management plan.

### Weeks 5–8: instrument and stimulus design

- create script templates and error taxonomy;
- obtain instructor consent;
- produce authentic and synthetic versions;
- select validated measures;
- build research interface.

### Weeks 9–11: expert validation and pilot

- subject-matter expert review;
- realism and error-salience pilot;
- usability test of labels and source panel;
- revise material;
- finalize pre-registration and power analysis.

### Weeks 12–19: main data collection

- recruit participants;
- randomize conditions;
- monitor technical failures without inspecting outcomes opportunistically;
- conduct post-task interviews;
- maintain participant-flow records.

### Weeks 20–23: delayed follow-up and data preparation

- run delayed memory/correction measure if included;
- anonymize data;
- freeze analysis dataset;
- document exclusions.

### Weeks 24–28: analysis

- fit confirmatory mixed-effects models;
- calculate confidence intervals, calibration, and signal-detection measures;
- conduct thematic analysis;
- integrate quantitative and qualitative findings.

### Weeks 29–32: safeguard prototype and recommendations

- refine source/content verification design;
- create governance workflow;
- run final usability checks;
- produce policy checklist.

### Weeks 33–36: thesis and defense

- write final thesis;
- document null and negative findings;
- prepare poster and demonstration;
- produce reproducibility package where ethics permits.

---

## 22. Scope options

## Minimum acceptable FYP

- ethics-approved replication with a larger, power-justified student sample;
- authentic versus synthetic media;
- accurate versus inaccurate content;
- one safeguard, such as disclosure;
- domain-knowledge measure;
- behavioral verification outcome;
- mixed-effects analysis;
- interview component;
- controlled research interface.

## Strong FYP

Add:

- partially inaccurate condition;
- provenance/source panel;
- multiple instructors and topics;
- familiarity measure;
- delayed memory test;
- signal-detection and calibration analysis;
- pre-registration;
- content-review workflow prototype.

## Publication-oriented FYP

Add:

- multi-university recruitment;
- students and adequately sampled staff;
- source verification × content accuracy experiment;
- cross-cultural or bilingual study;
- multiple synthetic quality levels;
- longitudinal correction evaluation;
- open anonymized stimuli where consent permits;
- instrument validation;
- institutional governance framework.

---

## 23. Expected contributions

1. **A clearer model of academic-media trust** separating synthetic origin, identity, authorization, and factual correctness.
2. **A controlled replication** of the original pilot with power-justified sampling and item-level variation.
3. **Empirical evaluation of safeguards** rather than recommendations alone.
4. **Evidence on provenance over-trust**, especially whether verified origin is mistaken for verified truth.
5. **Behavioral evidence** on source checking, reporting, and sharing, not only self-report.
6. **A consent-sensitive stimulus-development workflow** for synthetic instructor research.
7. **A prototype academic-media verification interface** distinguishing source and content review.
8. **A practical governance checklist** for universities producing or receiving synthetic lecture media.

---

## 24. Research risks and mitigations

### Risk: recruitment is too small

**Mitigation:** simplify the factorial design, choose one primary safeguard, perform power analysis, and avoid underpowered subgroup claims.

### Risk: participants infer the manipulation

**Mitigation:** use balanced fillers, randomized items, credible cover wording approved by ethics, and a post-study suspicion probe.

### Risk: content difficulty is confounded with accuracy

**Mitigation:** expert review, independent pilot ratings, multiple items per condition, and item random effects.

### Risk: instructor identity is confounded with topic

**Mitigation:** cross instructors and topics or rotate script assignments.

### Risk: harmful misinformation persists

**Mitigation:** use low-risk topics, immediate or approved staged correction, delayed follow-up only with safeguards, and authoritative debrief material.

### Risk: synthetic assets leak

**Mitigation:** closed platform, access controls, watermarking/study identifiers, no public link, asset log, and deletion plan.

### Risk: provenance badge creates unjustified trust

**Mitigation:** explicitly label what is verified, separate source from content review, and test user comprehension.

### Risk: intervention creates generalized distrust

**Mitigation:** include authentic and accurate controls and measure false rejection as well as false acceptance.

### Risk: tool quality changes

**Mitigation:** archive study assets and generation metadata, treat the generator as a stimulus-production tool rather than a stable benchmark, and avoid claims about all synthetic media.

---

## 25. Recommended deliverables

1. FYP proposal and systematic literature matrix;
2. threat model;
3. ethics and data-management documents;
4. instructor consent and synthetic-media asset protocol;
5. validated script/error bank;
6. authentic and synthetic study stimuli;
7. pre-registration and power analysis;
8. experimental web prototype;
9. anonymized survey dataset where permitted;
10. interview codebook;
11. analysis scripts;
12. safeguard and governance evaluation;
13. final thesis;
14. conference-style poster;
15. demonstration and optional paper submission.

---

## 26. Suggested thesis structure

1. Introduction
2. Synthetic instructor media and academic threat model
3. Background: trust, authenticity, correctness, and provenance
4. Related work
5. Critique of the pilot study
6. Research questions and hypotheses
7. Ethics and consent design
8. Stimulus validation
9. Experimental methodology
10. Quantitative analysis
11. Qualitative analysis
12. Safeguard prototype
13. Results
14. Security and educational implications
15. Limitations and responsible claims
16. Governance recommendations
17. Conclusion and future work

---

## 27. Final assessment

### Academic value

**High.** The topic addresses a real gap between synthetic-media generation and the human/institutional processes that decide whether educational content should be trusted.

### Feasibility

**Moderate.** The technical prototype is manageable, but ethics approval, participant recruitment, stimulus validation, and statistical design are the demanding parts.

### Novelty

- **Low:** repeat the three-video study with a few more students.
- **Moderate:** add authentic controls, more participants, and knowledge measures.
- **Strong:** experimentally separate source, synthetic identity, and content truth; evaluate disclosure and provenance; measure behavior and over-skepticism.
- **Publication-oriented:** test source verification × content correctness across multiple instructors, topics, institutions, or languages with delayed correction outcomes.

### Recommended final research question

> **Which combination of disclosure, provenance, and verification support helps university learners reject unauthorized or inaccurate synthetic instructor media while preserving justified trust in authentic and accurately authorized educational content?**

This question is clearer, more actionable, and more research-worthy than simply asking whether students can spot an AI-generated lecturer.

---

## 28. References and starting resources

1. Coalition for Content Provenance and Authenticity, “C2PA: Verifying Media Content Sources.” [C2PA official site](https://c2pa.org/)
2. E. Golaszewski et al., “Verifying Provenance of Digital Media: Why the C2PA Specifications Fall Short,” 2026. [Independent C2PA security analysis](https://arxiv.org/html/2604.24890v1)
3. J. Roe, M. Perkins, and L. Furze, “Deepfakes and Higher Education: A Research Agenda and Scoping Review of Synthetic Media,” 2024. [Research agenda and scoping review](https://arxiv.org/abs/2404.15601)
4. H. Sharif, A. Atif, and A. A. Nagra, “Deepfake-Style AI Tutors in Higher Education: A Mixed-Methods Review and Governance Framework for Sustainable Digital Education,” 2025. [Review and governance framework](https://www.mdpi.com/2071-1050/17/21/9793)
5. K. Somoray, D. J. Miller, and M. H. James, “Human Performance in Deepfake Detection: A Systematic Review,” 2025. [Human deepfake-detection review](https://onlinelibrary.wiley.com/doi/epdf/10.1155/hbe2/1833228)
6. D. Geissler, C. Robertson, and S. Feuerriegel, “Designing Effective Digital Literacy Interventions for Boosting Deepfake Discernment,” 2026. [Digital-literacy intervention study](https://arxiv.org/pdf/2507.23492v2)
7. M. J. Dupuis, H. Sung, and S. Long, “AI and Deepfakes: An Examination of Educational Interventions in Combating Deepfake-Based Disinformation.” [Intervention and over-skepticism study](https://faculty.washington.edu/marcjd/articles/AIDeepfakes.pdf)
8. UNESCO, “Deepfakes and the Crisis of Knowing,” 2025. [UNESCO perspective on epistemic and AI literacy](https://www.unesco.org/en/articles/deepfakes-and-crisis-knowing)
9. M. Cheung et al., “Poster: Seeing Is Believing? A Study on Trust, Authenticity, and Security When Using Synthetic Materials in Higher Education,” IEEE Symposium on Security and Privacy 2026 poster collection. [Original poster](https://sp2026.ieee-security.org/downloads/posters/sp2026posters-final110.pdf)

---

## 29. Immediate starting checklist

- [ ] Decide whether the FYP studies malicious impersonation, authorized workflow error, or both.
- [ ] Choose one primary outcome: correctness discrimination, source authentication, or behavioral verification.
- [ ] Separate authentic/synthetic origin from accurate/inaccurate content.
- [ ] Select one primary safeguard for the minimum FYP.
- [ ] Obtain ethics approval before generating or showing synthetic instructor media.
- [ ] Obtain explicit professor face/voice consent.
- [ ] Create multiple validated topics and error items.
- [ ] Run power analysis and pre-register the design.
- [ ] Build a closed research interface, not a public distribution channel.
- [ ] Measure both false acceptance and false rejection.
- [ ] Distinguish source provenance from factual correctness in every label.
- [ ] Debrief and correct all misleading claims.
