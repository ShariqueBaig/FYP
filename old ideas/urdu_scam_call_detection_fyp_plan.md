# Beyond Transcripts: An FYP Plan for Explainable Urdu Scam-Call Detection

## A true audio-text fusion system for Urdu, Roman Urdu, and Urdu-English code-switching

**Project type:** Final Year Project / undergraduate research  
**Primary domain:** Multimodal machine learning, speech processing, NLP, cybersecurity  
**Target language:** Pakistani Urdu, including Urdu script, Roman Urdu, and Urdu-English code-switching  
**Recommended duration:** 8–10 months

---

## 1. Executive summary

The proposed project will continue prior Turkish scam-call research but redesign it for the realities of Urdu-speaking users in Pakistan. The earlier work correctly observes that a transcript can lose stress, intonation, urgency, aggression, pauses, and other vocal information. However, it compares raw audio against text rather than constructing a system that integrates both.

This FYP should build a **true Urdu audio-text fusion system**. A dedicated automatic speech-recognition (ASR) model will produce the transcript, while a separate audio branch will extract acoustic and prosodic information. A fusion classifier will combine both streams to predict whether a call is fraudulent.

The project should cover:

- Urdu written in Perso-Arabic script;
- Roman Urdu;
- Urdu-English code-switching;
- Pakistani banking and mobile-wallet terminology;
- authentic telephone compression, noise, interruptions, and overlapping speech;
- linguistic indicators of deception and manipulation;
- vocal indicators such as urgency, loudness, pitch variation, pacing, pauses, and dominance.

The key contribution will not simply be a higher F1-score. It will be a controlled answer to this question:

> **Does combining a dedicated Urdu ASR transcript with separately extracted prosodic audio information improve scam-call detection over transcript-only, audio-only, and raw-audio multimodal LLM approaches?**

---

## 2. Recommended title

### Primary title

**Beyond Transcripts: Explainable Audio-Text Fusion for Urdu Scam-Call Detection Using Linguistic and Prosodic Signals**

### Alternative, more research-oriented title

**Do Prosodic Cues Improve Urdu Phone-Scam Detection? A Controlled Evaluation of Text, Audio, and Multimodal Fusion Models**

The second title is academically safer because it does not assume in advance that prosody will improve detection.

---

## 3. Problem statement

Most scam-call detection systems focus on words extracted from calls. This is useful, but a transcript may discard how those words were spoken. Scam callers can manipulate victims through urgency, confidence, authority, interruption, aggression, hesitation control, and changes in pacing or loudness. At the same time, vocal stress alone cannot prove fraud because legitimate emergency, banking, debt-collection, or customer-service calls can also be intense.

The issue is especially difficult for Urdu because real Pakistani calls often contain:

- Urdu-English code-switching;
- Roman Urdu terminology in supporting text and annotations;
- product and organization names in English;
- banking words such as *OTP*, *account*, *verification*, *block*, and *transaction*;
- local names and abbreviations;
- regional accents;
- informal grammar and pronunciation;
- low-quality telephone audio;
- multiple speakers and interruptions.

Public Urdu resources exist, but many are read or scripted speech rather than natural fraud conversations. A Common Voice Urdu corpus is publicly mirrored for ASR use, while commercial collections advertise hundreds of hours of scripted or desktop Urdu speech. Those resources can support ASR adaptation, but they are not substitutes for real Pakistani telephone conversations. citeturn7search75turn7search76turn7search79

---

## 4. Central research gap

A polished research-gap statement for the proposal is:

> Existing scam-call studies compare raw audio with transcript-based LLM classification but do not establish whether audio-capable models actually use prosodic information. Audio and text are commonly evaluated as competing inputs rather than complementary evidence, making it difficult to determine whether weak audio performance is caused by speech-recognition errors, safety-filter refusals, acoustic noise, or the limited predictive value of prosody. This project addresses that gap for Urdu by combining dedicated ASR with separately extracted acoustic representations and by conducting controlled ablation, perturbation, robustness, and early-detection experiments.

### One-sentence novelty claim

> **Unlike approaches that treat audio and transcripts as alternatives, this project treats them as complementary sources and directly measures the additional value of prosody for Urdu scam-call detection.**

---

## 5. What the previous research is missing

### 5.1 It does not truly fuse audio and text

The previous approach evaluates raw audio, an unchecked transcript, and a checked transcript separately. A multimodal dataset does not automatically produce a multimodal detector. Your system should provide both linguistic and acoustic evidence to one final classifier.

A large telecom-fraud dataset, TeleAntiFraud-28k, similarly emphasizes the need for paired audio-text data and contains 28,511 speech-text pairs for fraud detection, scenario classification, and fraud-type classification. Its scale and privacy-preserving synthetic strategy make it a useful reference, but it does not remove the need for a culturally grounded Urdu benchmark. citeturn7search86turn7search88

### 5.2 It assumes raw-audio LLMs use prosody

No experiment proves that a raw-audio LLM detected stress, intonation, or urgency. It may have internally recognized the words and relied primarily on lexical content. Your project must isolate prosody through ablation and controlled manipulation.

### 5.3 The comparison gives the raw-audio system a harder task

A general-purpose audio LLM must recognize Urdu speech, handle noise, infer emotion, understand the conversation, follow safety policies, and classify fraud. A transcript classifier receives a simpler input. The project should therefore evaluate ASR, text classification, audio classification, and fusion as separate components.

### 5.4 The dataset is too small

A balanced dataset of 100 calls is useful for a pilot, but not for strong generalization claims. With few positive examples, a small number of decisions can sharply change recall and F1. Fine-tuning large models also creates a high overfitting risk.

### 5.5 Source artifacts may leak labels

A model may learn uploader, channel, intro music, recording quality, speaker identity, subtitles, or editing patterns rather than scam behaviour. Segments from the same original call, speaker, uploader, or campaign must never appear in different splits.

### 5.6 Scam labels are not sufficiently operationalized

A native speaker can verify language and apparent meaning, but fraud labelling needs a written protocol. The project must distinguish confirmed scam, probable scam, suspicious/uncertain, aggressive-but-legitimate, and benign calls.

### 5.7 It lacks hard negatives

Urgency, authority, anger, and payment discussion can occur in legitimate calls. The dataset needs difficult benign examples so the model does not learn the shortcut “stress plus money equals scam.”

### 5.8 It does not address Urdu-specific representation

Urdu speech may be transcribed in Urdu script, transliterated into Roman Urdu, or mixed with English. The project must determine whether classification works best with:

1. Urdu-script transcripts;
2. Romanized transcripts;
3. normalized Urdu-English mixed transcripts;
4. original ASR output without normalization;
5. multiple parallel transcript representations.

Prior Pakistani text-fraud work has studied Roman Urdu SMS, and recent projects also target Roman Urdu and English code-mixed fintech messages. These resources are text-only and cannot replace a call-audio dataset, but they can inform vocabulary, scam taxonomies, and text baselines. citeturn7search80turn7search84

### 5.9 It lacks real-time and explanation evaluation

A useful warning system should detect risk before the call ends and explain the evidence. It must report detection time, false warnings, latency, confidence, and refusal rate—not only final-call F1.

---

## 6. Proposed system

```text
                                  +-------------------------+
                                  | Dedicated Urdu ASR      |
                                  | Whisper / XLS-R / API   |
                                  +------------+------------+
                                               |
                                               v
                                      Transcript branch
                              Urdu / Roman Urdu / code-mixed
                                               |
Phone-call audio ------------------------------+-------------------+
          |                                                        |
          v                                                        |
+--------------------------+                                      |
| Audio/prosody branch     |                                      |
| WavLM / XLS-R / wav2vec2 |                                      |
| + openSMILE features     |                                      |
+------------+-------------+                                      |
             |                                                    |
             v                                                    |
        Audio features                                             |
             +--------------------------+-------------------------+
                                        |
                                        v
                                  Fusion model
                                        |
                                        v
                     Scam probability + type + evidence timeline
```

### Why this is stronger

- Dedicated ASR focuses on recognizing the spoken content.
- The text branch detects linguistic scam indicators.
- The audio branch retains information lost in transcription.
- The fusion layer determines how much each modality contributes.
- ASR confidence and noise estimates can help the model decide when to trust audio or text.

---

## 7. Aim and objectives

### Aim

To design and evaluate an explainable Urdu scam-call detection system that combines automatic transcripts with acoustic and prosodic speech features, and to determine whether fusion improves generalization, robustness, and early detection compared with transcript-only and raw-audio approaches.

### Objectives

1. Build an ethically sourced Urdu scam-call dataset with aligned audio and transcripts.
2. Include Urdu script, Roman Urdu metadata, and Urdu-English code-switching.
3. Develop strong text-only and audio-only baselines.
4. Build late-fusion, feature-fusion, and prosody-aware models.
5. Measure the contribution of prosody through controlled experiments.
6. Evaluate unseen speakers, sources, scam categories, and noise conditions.
7. measure early detection at multiple call durations.
8. Develop a prototype that presents calibrated risk and evidence rather than making an unsupported accusation.

---

## 8. Research questions

### RQ1 — Main question

Does audio-text fusion significantly outperform transcript-only detection on unseen Urdu scam calls?

### RQ2 — Prosody

Which acoustic cues—pitch variation, energy, speaking rate, pauses, interruption, overlap, or vocal intensity—provide useful information beyond the transcript?

### RQ3 — Urdu ASR

How sensitive is fraud detection to ASR errors in colloquial, code-switched, noisy Pakistani Urdu?

### RQ4 — Script and code-switching

How do Urdu-script, Roman Urdu, normalized, and code-mixed transcript representations affect detection?

### RQ5 — Robustness

Does fusion generalize to unseen speakers, uploaders, devices, accents, scam categories, and recording conditions?

### RQ6 — Early detection

How quickly can the system identify risk while maintaining an acceptable false-warning rate?

---

## 9. Hypotheses

- **H1:** Audio-text fusion will outperform transcript-only classification on a source-independent test set.
- **H2:** Prosodic information will help most when linguistic scam intent is indirect or when ASR confidence is low.
- **H3:** Human correction will provide little practical improvement over a strong dedicated Urdu ASR pipeline.
- **H4:** A specialized fusion pipeline will be more reliable than prompting a general-purpose multimodal LLM with raw audio.
- **H5:** Fusion may improve scam recall but increase false positives on emotionally intense benign calls.
- **H6:** Code-switch-aware transcript handling will outperform aggressive translation into only English or only standardized Urdu.

---

## 10. Dataset strategy

### 10.1 Scope targets

#### Minimum viable FYP

- 300 calls;
- 150 scam and 150 benign;
- at least 40 unique speakers;
- at least six scam categories;
- 15–25 hours of total call audio.

#### Recommended target

- 600–1,000 calls;
- at least 100 speakers;
- 40–80 hours;
- multiple devices, accents, noise conditions, and sources.

#### Publication-oriented target

- 1,500+ calls;
- a separate external test set;
- real and consent-based staged calls;
- longitudinal evaluation on newly collected scam tactics.

### 10.2 Data sources

#### A. Legally usable public examples

Use public scam-awareness recordings only after reviewing copyright, platform terms, privacy, and redistribution rights. Do not assume that public availability means permission to republish raw voices.

#### B. Consent-based reenactments

Record staged calls with informed adult volunteers. Create paired scam and benign scripts and vary tone, speaker, accent, device, noise, and delivery. Mark every staged item in metadata.

#### C. Urdu ASR corpora

Use general Urdu speech corpora for ASR adaptation or pretraining, not as scam-call evidence. Public and commercial resources include Common Voice Urdu, a telephone conversational collection advertised as 169.39 hours of recordings with about 51 hours of speech, and larger scripted/desktop corpora. Availability and licence conditions must be verified before use. citeturn7search74turn7search75turn7search76turn7search79

#### D. Synthetic conversations

Use synthetic scripts and text-to-speech only as training augmentation. Keep a real or human-performed test set. Otherwise, the model may learn TTS artifacts. TeleAntiFraud-28k provides a relevant hybrid reference using ASR-derived text, TTS regeneration, LLM augmentation, and adversarial synthesis for privacy and scenario coverage. citeturn7search86turn7search87turn7search88

### 10.3 Urdu/Pakistan scam taxonomy

Include categories such as:

1. bank account or card fraud;
2. OTP/PIN/credential theft;
3. mobile-wallet impersonation;
4. SIM or telecom verification scam;
5. police, FIA, court, tax, or government impersonation;
6. prize, lottery, or game-show scam;
7. family emergency or kidnapped-relative impersonation;
8. job, visa, or recruitment scam;
9. utility bill or service-disconnection scam;
10. investment, loan, charity, or payment scam;
11. technical-support or remote-access scam;
12. ecommerce/delivery or parcel scam.

Do not use specific organization names as automatic evidence of fraud; legitimate calls may mention the same names.

### 10.4 Manipulation labels

Annotate whether a call contains:

- request for payment;
- request for OTP, PIN, password, CNIC, card, or account details;
- claim of institutional authority;
- threat or intimidation;
- artificial urgency;
- secrecy request;
- discouragement of independent verification;
- unrealistic reward;
- repeated pressure;
- remote-access request;
- instruction to move the conversation to another channel.

### 10.5 Prosody labels

For selected segments, ask annotators to rate:

- urgency, 1–5;
- aggression, 1–5;
- dominance/authority, 1–5;
- emotional intensity, 1–5;
- perceived pressure, 1–5;
- vocal stress, 1–5;
- shouting, yes/no;
- rapid speech, yes/no;
- unusual pause, yes/no;
- interruption, yes/no;
- overlapping speech, yes/no.

Use at least two native Urdu annotators and a third adjudicator. Report Cohen’s kappa, Fleiss’ kappa, Krippendorff’s alpha, or intraclass correlation as appropriate.

### 10.6 Suggested schema

```text
call_id
source_id
speaker_group_ids
source_type
real_staged_or_tts
fraud_label
label_confidence
fraud_category
manipulation_tactics
audio_path
duration_seconds
transcript_asr_urdu
transcript_verified_urdu
transcript_roman_urdu
english_gloss_optional
asr_model
asr_confidence
word_error_rate
code_switch_ratio
number_of_speakers
noise_level
overlap_ratio
urgency_score
aggression_score
dominance_score
payment_request
credential_request
secrecy_request
annotator_ids
data_split
```

---

## 11. Annotation protocol

### Label levels

- **Confirmed scam:** reliable source evidence or clearly documented fraudulent intent.
- **Probable scam:** strong deceptive indicators but no independent confirmation.
- **Suspicious/uncertain:** insufficient evidence for binary assignment.
- **Aggressive but legitimate:** intense delivery without deceptive intent.
- **Benign:** ordinary legitimate conversation.

For the main binary task, exclude uncertain cases from training initially and use them later as a challenge set.

### Annotation process

1. Remove or mask identifying information.
2. Have two annotators independently review the call and transcript.
3. Record label, confidence, category, tactics, and evidence spans.
4. Resolve disagreement through an adjudicator.
5. Calculate agreement before final model training.
6. Revise unclear annotation rules and re-annotate a sample.

---

## 12. Preventing data leakage

1. Split by original source—not random audio chunks.
2. Keep all segments from one call in one split.
3. Keep each speaker in one split where feasible.
4. Keep each uploader/channel in one split.
5. Keep repeated scripts or campaign variants together.
6. Detect near-duplicate audio and transcript pairs.
7. Split before augmentation.
8. Fit feature normalization only on training data.
9. Tune models only on validation data.
10. Open the final test set once, after model selection.

### Recommended split

```text
Training:   70%
Validation: 15%
Test:       15%
```

Also report grouped five-fold cross-validation if the dataset is small. Group by source, speaker, or campaign—not by individual segment.

---

## 13. Baselines

### Baseline 1 — Rules and keywords

Create transparent Urdu, Roman Urdu, and English patterns for payment, OTP, account blocking, prize claims, threats, urgency, and verification avoidance.

### Baseline 2 — Classical text model

Use TF-IDF with logistic regression or a linear SVM. Test word and character n-grams because character features can be robust to Roman Urdu spelling variation.

### Baseline 3 — Transformer text model

Compare a multilingual or Urdu-capable encoder on:

- raw ASR Urdu;
- normalized Urdu;
- Roman Urdu;
- code-mixed text;
- parallel representations, if resources permit.

### Baseline 4 — Handcrafted acoustic model

Extract MFCCs, pitch, pitch range, energy, speech rate, pause duration, jitter, shimmer, spectral features, and harmonic-to-noise ratio. Train logistic regression, SVM, random forest, or gradient boosting.

### Baseline 5 — Pretrained audio encoder

Use wav2vec 2.0, XLS-R, WavLM, or HuBERT embeddings with a classification head. Small open Urdu ASR experiments and repositories demonstrate that XLSR/wav2vec-style adaptation is feasible, though their results must not be assumed to transfer to scam-call audio. citeturn7search77turn7search78

### Baseline 6 — Raw-audio multimodal LLM

Reproduce the original approach. Record prediction, refusal, invalid output, latency, explanation, and cost. Report refusal rate separately rather than silently merging all failures into one metric.

---

## 14. Proposed fusion models

### Model A — Late fusion

```text
P_text  = transcript-model scam probability
P_audio = audio-model scam probability
P_final = w * P_text + (1 - w) * P_audio
```

Learn `w` only from validation data. This is the safest minimum FYP contribution.

### Model B — Feature fusion

```text
text_embedding  = text_encoder(transcript)
audio_embedding = audio_encoder(audio)
combined        = concatenate(text_embedding, audio_embedding)
prediction      = MLP(combined)
```

Freeze encoders initially and train the fusion head. Unfreeze only the final layers if the dataset is large enough.

### Model C — Gated fusion

```text
gate = sigmoid(W[text_embedding; audio_embedding; ASR_confidence; noise_score])
combined = gate * text_embedding + (1 - gate) * projected_audio_embedding
```

The gate can learn to trust text when audio is noisy and audio when transcription confidence is low.

### Model D — Prosody-aware fusion

```text
Transcript embedding
+ learned audio embedding
+ interpretable prosody vector
+ ASR confidence
+ noise/overlap measures
-> calibrated fusion classifier
```

This should be the preferred final model because it combines learned representations with interpretable signals.

---

## 15. Critical experiments

### Experiment 1 — Modality ablation

Compare:

1. text only;
2. handcrafted prosody only;
3. learned audio only;
4. raw-audio LLM;
5. text + handcrafted prosody;
6. text + learned audio;
7. text + learned audio + prosody.

### Experiment 2 — Transcript representation

Compare Urdu script, Roman Urdu, code-mixed text, normalized text, and optional English translation. This is a crucial Urdu-specific contribution.

### Experiment 3 — Same words, different delivery

Have volunteers record the same text in neutral, urgent, aggressive, authoritative, and friendly-persuasive styles. Test whether audio-aware predictions change while text-only predictions remain stable. Do not treat aggression itself as the ground-truth scam label.

### Experiment 4 — Prosody perturbation

Evaluate original, pitch-normalized, volume-normalized, speed-normalized, silence-trimmed, and noise-reduced audio. Treat these as perturbations, not perfect isolation of one human factor.

### Experiment 5 — ASR corruption

Delete or replace words, remove punctuation, corrupt financial terms, and mask low-confidence regions. Measure whether fusion remains robust as transcript quality declines.

### Experiment 6 — Noise and telephone robustness

Test clean, street, office, traffic, television/music, low-volume, 8-kHz telephone compression, packet loss, and overlapping speech.

### Experiment 7 — Hard negatives

Create a test set of legitimate but intense calls: bank fraud warnings, emergency calls, payment reminders, customer complaints, sales calls, and government enquiries. This identifies whether the model detects fraud or merely emotion.

### Experiment 8 — Unseen scam categories

Train without one category and test on it. Repeat for multiple categories to determine whether the model learns general manipulation patterns.

### Experiment 9 — Early detection

Evaluate the first 10, 20, 30, and 60 seconds and the full call. Report median time to correct detection and false warnings per benign call.

### Experiment 10 — Cross-domain generalization

If possible, train mainly on staged/public data and test on a small, independently sourced, privacy-cleared set. This test is more valuable than a random split from one source.

---

## 16. Metrics

### Classification

- precision;
- recall;
- F1 and macro-F1;
- PR-AUC;
- ROC-AUC;
- scam recall;
- benign specificity;
- confusion matrix.

### Calibration

- Brier score;
- Expected Calibration Error;
- reliability diagram.

### ASR

- word error rate;
- character error rate;
- code-switched term error rate;
- critical-entity error rate for OTP, money, account, CNIC, bank, and organization terms.

### Operational

- latency;
- real-time factor;
- memory and hardware use;
- API cost per minute;
- refusal rate;
- invalid-output rate;
- median detection time.

### Statistical reporting

- 95% bootstrap confidence intervals;
- multiple random seeds;
- paired McNemar test for error differences;
- bootstrap comparison of F1 or PR-AUC;
- effect sizes and practical significance.

---

## 17. Explainability

### Text evidence

Highlight exact transcript spans such as requests for OTP, urgent transfers, secrecy, threats, or instructions not to verify independently. Prefer SHAP, Integrated Gradients, or token-removal tests over an unsupported LLM-generated explanation.

### Audio evidence

Display pitch, energy, speaking-rate variation, pauses, overlap, and model saliency over time.

### Example output

```text
Risk: High (0.87)

Evidence:
- 00:18-00:24: caller claims institutional authority
- 00:31-00:38: urgent request for account verification code
- 00:35-00:42: increased loudness and speaking rate
- 00:48-00:55: caller discourages independent verification

Safety message:
Do not share credentials or send money. End the call and contact the
organization through an independently verified official number.
```

The interface should say “suspicious patterns detected,” not declare that a person is a criminal.

---

## 18. Ethics, privacy, and safety

- Obtain institutional/supervisor approval before collecting human voice data.
- Obtain informed consent for all staged recordings.
- Remove names, phone numbers, CNIC numbers, addresses, account details, and voice-linked identifiers.
- Store raw audio in access-controlled storage.
- Publish only data for which redistribution is legally permitted.
- Allow participants to withdraw their recordings.
- Do not perform speaker identification.
- Document licences, collection methods, and intended uses in a dataset card.
- Treat the detector as decision support, not proof of criminal conduct.
- Analyze bias by accent, age group where ethically available, gender representation, device, and speaking style.

Potential harms include false accusations, bias against emotional speakers or regional accents, surveillance misuse, privacy loss, and over-reliance on automated warnings.

---

## 19. Recommended implementation stack

### Audio

- Python;
- `librosa`;
- `openSMILE`;
- `torchaudio`;
- voice-activity detection;
- optional speaker diarization, subject to licence and privacy review.

### ASR

Compare at least two systems:

- a Whisper-family model;
- an XLS-R/wav2vec 2.0 Urdu model;
- optionally one commercial ASR if budget and privacy terms permit.

Evaluate them on your own held-out call audio rather than relying on benchmark claims from clean speech.

### Text

- TF-IDF + linear SVM;
- multilingual/Urdu transformer;
- character-level features for Roman Urdu variation;
- language/script identification and code-switch tagging.

### Audio representation

- openSMILE handcrafted features;
- wav2vec 2.0/XLS-R;
- WavLM or HuBERT.

### Fusion

- scikit-learn for late fusion;
- PyTorch for feature and gated fusion.

### Tracking and reproducibility

- MLflow or Weights & Biases;
- Git;
- fixed seeds;
- configuration files;
- versioned data manifests;
- model cards and dataset cards.

### Demo

Use Streamlit or Gradio to upload/stream a recording and display the transcript, risk score, evidence timeline, ASR confidence, and safety advice.

---

## 20. Timeline

### Weeks 1–4: proposal and literature

- refine scope;
- define taxonomy and research questions;
- review Urdu ASR, fraud NLP, prosody, and multimodal fusion;
- prepare ethics and data-management plan;
- pre-register hypotheses.

### Weeks 5–10: collection and dataset audit

- audit available data;
- identify duplicates and sources;
- record consent-based calls;
- remove personal information;
- create metadata and split policy.

### Weeks 8–13: annotation

- train annotators;
- conduct double annotation;
- measure agreement;
- adjudicate disagreements;
- freeze dataset version 1.

### Weeks 11–16: baseline models

- keyword rules;
- TF-IDF/SVM;
- transformer text model;
- handcrafted audio model;
- learned audio model;
- raw-audio LLM benchmark.

### Weeks 16–22: fusion

- late fusion;
- feature fusion;
- gated fusion;
- prosody-aware model.

### Weeks 22–27: controlled evaluation

- ablations;
- script/code-switch comparison;
- same-text/different-delivery test;
- hard negatives;
- ASR corruption;
- noise robustness;
- unseen-category and early-detection tests.

### Weeks 26–30: prototype

- calibrated output;
- evidence highlighting;
- timeline visualization;
- runtime and cost evaluation.

### Weeks 29–36: thesis and defense

- complete statistical analysis;
- document negative results and limitations;
- freeze final test results;
- prepare thesis, poster, demo, and paper-style manuscript.

---

## 21. Scope options

### Minimum acceptable FYP

- 300 carefully labelled calls;
- Urdu-script and code-mixed transcripts;
- strong text baseline;
- handcrafted audio baseline;
- one pretrained audio encoder;
- late fusion;
- leakage-safe test split;
- hard-negative and early-detection experiments;
- explainable demo.

### Strong FYP

Add:

- 600+ calls;
- Roman Urdu parallel transcripts;
- feature fusion;
- prosody annotations;
- ASR/noise robustness;
- calibration;
- independent test sources.

### Publication-oriented FYP

Add:

- 1,000+ calls;
- gated or cross-attention fusion;
- same-text/different-prosody corpus;
- unseen-category evaluation;
- privacy-preserving public benchmark;
- streaming prototype;
- comparison with commercial multimodal LLMs.

---

## 22. Expected contributions

1. **An Urdu multimodal scam-call dataset** containing aligned audio, transcripts, scam categories, manipulation tactics, and selected prosodic annotations.
2. **A true audio-text fusion architecture** combining dedicated Urdu ASR with linguistic and acoustic information.
3. **Controlled evidence about prosody**, rather than assuming that stress or urgency improves fraud detection.
4. **An Urdu-specific analysis** of Urdu script, Roman Urdu, and Urdu-English code-switching.
5. **A realistic evaluation framework** covering source leakage, unseen speakers, hard negatives, noise, early detection, calibration, and model refusals.
6. **An explainable prototype** that provides calibrated warnings and observable evidence.

Even if fusion does not outperform text-only classification, the project can still make a valid contribution by showing under what conditions prosody does—or does not—add measurable value.

---

## 23. Risks and mitigation

### Risk: insufficient real scam audio

**Mitigation:** combine privacy-cleared public examples, staged calls, and carefully labelled synthetic augmentation; reserve realistic human-performed data for testing.

### Risk: model overfitting

**Mitigation:** freeze encoders, use simple fusion first, apply group splits, report cross-validation, and avoid training very large models on a small dataset.

### Risk: high ASR error

**Mitigation:** compare ASR systems, use character-level text representations, retain code-switched terms, include ASR confidence in fusion, and report entity-specific errors.

### Risk: the model learns emotion rather than fraud

**Mitigation:** build hard-negative calls and run same-text/different-delivery experiments.

### Risk: synthetic audio shortcuts

**Mitigation:** use multiple voices/TTS systems only for training augmentation and never rely on synthetic-only test results.

### Risk: privacy or copyright limitations

**Mitigation:** prioritize consent-based reenactments, redact identifiers, maintain restricted raw storage, and publish only licensed or derived features.

### Risk: fusion does not improve F1

**Mitigation:** measure robustness, calibration, early detection, ASR degradation, and challenging subsets. The scientific result is not dependent on a positive outcome.

---

## 24. Final recommended FYP deliverables

1. FYP proposal and literature review;
2. ethics and data-management documentation;
3. annotation guide and fraud taxonomy;
4. versioned Urdu multimodal dataset;
5. reproducible baseline and fusion code;
6. experiment configurations and logs;
7. statistical evaluation report;
8. model card and dataset card;
9. explainable demonstration application;
10. final thesis;
11. conference-style poster;
12. optional paper submission.

---

## 25. Final proposal summary

This FYP should not merely repeat the question “Is audio better than text?” It should ask a more precise and valuable question:

> **When a strong Urdu ASR system already provides the words, does the original audio contribute additional, reliable evidence of fraud—and can that evidence improve detection without confusing emotion with criminal intent?**

The project should answer that question through a dedicated transcript branch, a separate prosody/audio branch, true fusion, Urdu-specific representation experiments, hard negatives, and leakage-resistant evaluation. That design directly resolves the main methodological weakness of the original poster and raises the work to a strong FYP or potential publication-level study.

---

## References and starting resources

- TeleAntiFraud-28k audio-text telecom fraud dataset and benchmark. citeturn7search86turn7search87turn7search88
- Common Voice Urdu corpus mirror for ASR experimentation. citeturn7search79
- Pakistan Urdu conversational telephone-speech dataset description. citeturn7search74
- Scripted and desktop Urdu speech corpus descriptions. citeturn7search75turn7search76
- Open Urdu/Kaldi and XLSR-wav2vec experimentation references. citeturn7search77turn7search78
- Roman Urdu fraud/spam text research and recent code-mixed fintech project. citeturn7search80turn7search84
- LLM-generated Roman Urdu scam-call transcript study, useful as a synthetic-data comparison but not a substitute for real audio evaluation. citeturn7search82
