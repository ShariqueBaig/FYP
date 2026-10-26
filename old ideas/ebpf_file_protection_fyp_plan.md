# Beyond Unlink Blocking: A Full FYP Plan for Tamper-Resistant File-Destruction Protection with eBPF

**Project type:** Final Year Project / undergraduate systems-security research  
**Primary domains:** Linux kernel security, eBPF, file systems, access control, runtime security  
**Recommended scope:** Design, implementation, adversarial evaluation, and reproducible benchmark  
**Target platform:** Linux with BPF LSM, BTF, and CO-RE support

---

## 1. Executive verdict

### Is this a good FYP topic?

**Yes, but not if the project is only “attach an eBPF program to `unlink` and deny deletion.”** That core idea has already been demonstrated. An IEEE Symposium on Security and Privacy 2026 poster, *Preventing Unauthorized File Deletion via eBPF*, describes a BPF LSM unlink-hook prototype that protects inode-identified files, including against privileged user-space agents, with a user-space controller and claimed minimal overhead [1].

A basic clone would be a useful learning exercise, but the research novelty would be weak. A strong FYP should instead investigate the larger and more difficult problem:

> **Can a BPF LSM policy protect critical file content and names against all practically relevant destruction paths, remain manageable under legitimate administration, resist tampering by privileged user-space processes, and operate with predictable overhead across file systems and workloads?**

That reframing turns a small unlink demo into a rigorous systems-security project.

### Recommended direction

Build a **tamper-resistant, lifecycle-aware file-protection system** using multiple BPF LSM hooks, a least-privilege user-space controller, protected BPF maps, audit telemetry, protected-object identity based on device/inode information, and an explicit recovery and fail-safe policy.

The system should cover more than `unlink`:

- unlinking a file name;
- renaming a protected object;
- renaming another object over a protected name;
- truncating or opening a protected file for destructive write;
- changing attributes that weaken protection;
- removing protected directories;
- link-based aliasing and replacement scenarios;
- policy-map or pinned-object tampering;
- controller termination;
- namespace and container boundaries;
- reboot and early-boot limitations.

The central contribution should be **complete threat-model coverage and measured resistance to bypass**, not the existence of one hook.

---

## 2. Recommended title

### Primary title

**Beyond Unlink Blocking: Tamper-Resistant File-Destruction Protection with eBPF LSM**

### Alternative research title

**How Complete Is eBPF-Based File Protection? A Systematic Study of Deletion, Replacement, Truncation, Rename, and Privileged Tampering on Linux**

### AI-agent-oriented alternative

**Guarding Critical Files from Privileged Automation: Policy-Aware Destructive-Operation Control with eBPF LSM**

The second title is the strongest academically because it does not assume the system is complete. It frames the FYP as a controlled investigation of security boundaries.

---

## 3. Background

BPF LSM programs allow privileged users to instrument Linux Security Module hooks and implement system-wide mandatory access-control and audit policies using eBPF. The Linux kernel documentation shows that an LSM BPF program can return an error such as `-EPERM` to reject an operation, and that BTF and CO-RE-style structure access can reduce dependence on manually copied kernel headers [2].

This matters because ordinary tracing mechanisms and enforcement mechanisms are different:

- A kprobe is primarily observational; returning a nonzero value from an ordinary kprobe does not generally cancel the operation [3].
- A BPF LSM program attaches to a security decision point and can reject an operation through the hook's return value [2].
- fanotify can monitor broad file-system scopes, but its permission-event coverage differs from LSM coverage and user-space handling introduces context switches [4].

Linux deletion semantics also need precise treatment. `unlink()` deletes a **name** from the file system. If that name is the final hard link and no process has the object open, storage can be reclaimed. If a process still has it open, the object remains until the last file descriptor closes [5]. Therefore, “protect a file from deletion” is not one simple operation. It involves file names, dentries, inodes, links, open handles, directory entries, and content-changing operations.

---

## 4. What the current poster contributes

The 2026 poster provides a useful baseline. It proposes:

1. attaching an eBPF program to a BPF LSM unlink hook;
2. identifying protected files through inode-based policies in an eBPF map;
3. using a user-space controller;
4. preventing unauthorized deletion by privileged user-space agents;
5. evaluating whether the prototype blocks deletion and measuring overhead [1].

This establishes that BPF LSM enforcement is feasible for the stated operation. It does **not**, from the poster text available in the source, fully establish complete coverage of destructive file operations, resilience to policy tampering, cross-file-system behavior, namespace behavior, boot persistence, or an adversarial bypass benchmark.

That is the opportunity for your FYP.

---

## 5. Current limitations and missing research

## 5.1 Protecting `unlink` is not the same as protecting file content

A file may remain named but lose its content through truncation, destructive opening, or overwriting. A deletion-only policy can therefore satisfy a narrow test while failing the actual security goal.

The research must define which asset it protects:

- the path name;
- the inode/object;
- the file content;
- metadata and permissions;
- availability;
- recoverability;
- or all of these.

A good FYP should protect **object identity, content integrity, and name availability**, then state where those guarantees stop.

## 5.2 Rename and replacement are separate attack paths

A protected file can be affected by renaming it, moving it, or renaming another file over its protected path. A recent open-source eBPF protection daemon uses several hooks rather than only unlink: `file_open`, `inode_unlink`, `inode_rename`, `inode_setattr`, `task_kill`, and `bpf_map` [6]. That project is useful evidence that practical protection requires a wider hook set, but it is not itself a peer-reviewed proof of completeness.

Your work should derive hook coverage from a formal operation matrix rather than adding hooks ad hoc.

## 5.3 Inode identity has lifecycle problems

Inode-based identification avoids fragile string comparison and can survive a rename, but it creates research questions:

- How is the file first resolved and registered?
- Is the device identifier included with the inode number?
- What happens after deletion and inode reuse?
- What if an attacker creates a hard link before protection is enabled?
- What if the object is on another mount or file system?
- How are bind mounts and mount namespaces handled?
- How does policy behave when a protected object is replaced during controller downtime?

The FYP should test stale-policy and object-reuse scenarios explicitly.

## 5.4 Path-based policies are difficult inside eBPF

File paths are contextual rather than stable object identities. Relative paths, renamed directories, mount namespaces, bind mounts, chroots, aliases, and hard links can make path decisions complex. Earlier discussion around eBPF deletion interception also identified path extraction as a practical problem [7].

Newer BPF LSM work has added selected path-based hooks to sleepable LSM support and introduced a safer `bpf_path_d_path()` kfunc for path rendering in supported contexts [8]. This is promising, but a path string should remain an audit aid or policy input whose semantics are carefully documented, not a casually assumed global identity.

## 5.5 A privileged process may tamper with the eBPF control plane

If a policy lives in writable BPF maps, a sufficiently privileged process may attempt to modify those maps or interfere with pinned programs and links. The NSA's SeaBee project explicitly identifies privileged-user access to eBPF maps and tools as a security problem and builds policy controls to make such subversion harder [9].

This means a claim such as “even root cannot delete the file” is incomplete unless the threat model answers:

- Can that root process update the policy map?
- Can it detach the BPF link?
- Can it remove pinned objects?
- Can it kill or replace the controller?
- Can it load another BPF program or kernel module?
- Can it reboot into a configuration without BPF LSM?
- Can it access the disk offline?

A defensible system may resist a constrained privileged user-space agent while explicitly excluding kernel compromise, malicious modules, offline disk access, and reboot into an unprotected environment.

## 5.6 The loader/controller is part of the trusted computing base

A user-space controller can add or remove protected objects and update policy. If compromised, it may authorize destructive operations. It also handles configuration, audit events, persistence, and emergency unlock.

The FYP must minimize and document the trusted computing base:

- controller binary;
- configuration;
- BPF object;
- pinned programs, links, and maps;
- service unit;
- credentials or authorization mechanism;
- boot-time activation path.

## 5.7 Reboot and early boot can defeat runtime-only protection

BPF LSM must be available in the running kernel. BPF LSM support was introduced in Linux 5.7, and systems must have the relevant support enabled [10]. A project cannot claim unconditional root resistance if an attacker can reboot, alter the boot command line, load a different kernel, or access the disk offline.

The correct contribution is a precise runtime guarantee under stated assumptions, not “undeletable files.”

## 5.8 Portability is a serious systems issue

Kernel version, architecture, BTF availability, LSM configuration, hook availability, helper/kfunc support, and distribution policy can affect deployment. CO-RE improves portability of structure access, but it does not mean every target kernel exposes every desired hook and helper [2].

A strong FYP should include a compatibility matrix rather than testing only one machine.

## 5.9 File-system semantics differ

The project should not assume ext4 results automatically generalize to XFS, Btrfs, tmpfs, overlayfs, NFS, or container layers. Network and stacked file systems may expose different behavior, error cases, or performance.

A manageable FYP can select two or three local file systems and clearly mark network file systems as future work.

## 5.10 Performance claims need workload design

“Minimal overhead” is not enough without:

- baseline workload;
- file size distribution;
- protected-object count;
- policy-map size;
- operation mix;
- concurrent process count;
- hardware and kernel configuration;
- cold/warm cache status;
- repeated trials and confidence intervals.

LSM hooks are global decision points. A 2025 LSFMM+BPF discussion noted that LSM hooks respond to all relevant operations even if policy applies only to a subset, whereas fanotify can eliminate irrelevant events through mask-based filtering but handles notifications in user space [4]. Your evaluation should therefore measure the cost of large protected sets and mostly irrelevant workloads.

## 5.11 Fail-open and fail-closed behavior is unresolved

What should happen if:

- the controller crashes;
- the audit ring buffer is full;
- a map lookup fails;
- configuration is corrupt;
- the BPF program cannot load;
- the protected file is temporarily unavailable;
- an administrator needs emergency changes?

Security and availability pull in opposite directions. Your system needs explicit modes and safe recovery.

## 5.12 Comparison with existing Linux controls is essential

A convincing FYP should not assume eBPF is automatically superior. Compare the design against:

- ordinary Unix DAC;
- immutable file attributes;
- SELinux or AppArmor policy;
- fanotify-based monitoring where applicable;
- audit-based observation;
- snapshots/versioning as recovery rather than prevention.

The objective is not to “defeat” these systems in every category. It is to identify where dynamic BPF LSM policy offers useful flexibility and where conventional mechanisms are stronger or simpler.

---

## 6. Proposed research aim

> To design and evaluate a tamper-resistant BPF LSM system that protects critical Linux file objects against multiple destructive operations, dynamically updates policy without kernel modification, produces trustworthy audit evidence, and clearly defines its limits against privileged user-space and system-level adversaries.

---

## 7. Research questions

### RQ1: Coverage

Which Linux operations can destroy, replace, hide, or materially damage a protected file without invoking a narrow unlink-only rule?

### RQ2: Completeness

Can a multi-hook BPF LSM policy enforce a consistent protection invariant across unlink, rename, replacement, truncation, destructive open, attribute changes, links, and directory removal?

### RQ3: Identity

What combination of object identity and path context provides robust policy decisions under rename, hard links, mount namespaces, and inode reuse?

### RQ4: Privileged tampering

Under a clearly bounded threat model, can the system prevent a privileged user-space process from modifying policy, detaching protection, killing the controller, or replacing protected objects?

### RQ5: Performance

How does overhead change with policy size, protected-file count, event rate, concurrency, file system, and workload type?

### RQ6: Operability

Can legitimate administrators safely register, update, temporarily unlock, recover, and audit protected files without creating an easy bypass?

### RQ7: Portability

Which kernel, distribution, architecture, LSM, and file-system conditions limit deployment?

---

## 8. Hypotheses

- **H1:** An unlink-only policy will fail at least one destructive operation class that a multi-hook policy blocks.
- **H2:** Device-and-inode identity will be more stable under rename than path-only identity, but will require explicit handling of lifecycle and reuse.
- **H3:** Kernel-side map lookup will add low median overhead for ordinary file operations, while overhead will increase with policy complexity and global hook frequency.
- **H4:** A privileged user-space threat can bypass a naive BPF-map policy unless the maps, pinned objects, controller, and authorization path are protected.
- **H5:** A multi-hook BPF LSM design will be easier to update dynamically than a static kernel modification, but less universally deployable than basic DAC or immutable attributes.
- **H6:** Security guarantees will not survive an adversary capable of replacing the kernel, modifying boot configuration, loading hostile kernel code, or accessing storage offline unless additional platform controls are assumed.

---

## 9. Threat model

A security FYP is only credible when it separates in-scope and out-of-scope adversaries.

## 9.1 Protected assets

- critical configuration files;
- security logs;
- audit records;
- backup metadata;
- application state;
- service definitions;
- the protection controller and its configuration;
- BPF maps, links, and pinned objects used by the system.

## 9.2 In-scope adversaries

### Level A: Unprivileged process

Attempts destructive operations through ordinary system calls.

### Level B: Privileged user-space process

Has root or selected capabilities and may be an incorrectly instructed automation/AI agent, compromised management service, or malicious administrator process. It can issue file operations and may attempt to kill the controller or access BPF objects.

### Level C: Containerized privileged process

Operates in a mount/user namespace and may target bind-mounted or overlay-backed protected objects.

Use Level B as the primary high-stakes FYP threat model. Level C can be an extension.

## 9.3 Explicitly out of scope unless extra controls are added

- compromised kernel;
- arbitrary malicious kernel module;
- physical or offline disk access;
- bootloader compromise;
- reboot into an unprotected kernel;
- firmware compromise;
- destructive storage-controller behavior;
- denial of service through resource exhaustion unless specifically evaluated.

Do not claim “root-proof” without immediately stating these exclusions.

## 9.4 Security invariants

Define measurable invariants:

1. A protected object cannot lose its final name through an unauthorized operation.
2. A protected object's content cannot be truncated or opened for destructive modification by an unauthorized subject.
3. A protected name cannot be replaced by renaming another object over it.
4. Protection metadata cannot be changed by an unauthorized user-space process.
5. Every denied operation generates an auditable event, subject to documented telemetry-loss behavior.
6. Authorized maintenance requires an explicit, logged policy transition.

---

## 10. Proposed architecture

```text
+---------------------------------------------------------------+
| User space                                                    |
|                                                               |
|  policyctl CLI ---- authenticated request ----+                |
|                                               v                |
|                                      +------------------+      |
|                                      | policy controller|      |
|                                      | least privilege  |      |
|                                      +----+--------+----+      |
|                                           |        |           |
|                                  map update|        |audit read |
+-------------------------------------------|--------|-----------+
                                            v        ^
+---------------------------------------------------------------+
| Linux kernel                                                  |
|                                                               |
|  BPF maps                                                     |
|  - protected objects: device + inode + generation/context     |
|  - authorized subjects / maintenance state                    |
|  - configuration and policy version                           |
|                                                               |
|  BPF LSM programs                                             |
|  - unlink/rmdir                                               |
|  - rename and replacement                                     |
|  - file open for write/truncate                               |
|  - setattr/truncate/chmod/chown as required                   |
|  - link/symlink policy where relevant                         |
|  - BPF-map/pinned-object anti-tamper                          |
|  - controller signal/process self-protection, if justified    |
|                                                               |
|  Ring buffer / audit channel                                  |
+---------------------------------------------------------------+
                                            |
                                            v
                                   protected file systems
```

## 10.1 Kernel enforcement plane

Use BPF LSM programs for actual allow/deny decisions. The Linux kernel documentation confirms that BPF LSM programs can implement MAC/audit logic and reject operations through hook return values [2].

## 10.2 Policy data plane

Store compact identity and access decisions in BPF maps. A suggested key is:

```text
filesystem/device identity + inode number + policy namespace
```

Treat any additional generation or version field as an experimental design choice that must be validated against the target file systems and available kernel context.

## 10.3 User-space control plane

The controller should:

- resolve requested paths to stable kernel object identifiers;
- update the policy map;
- verify that protected objects still match expected metadata;
- stream and persist audit events;
- expose status and health information;
- implement controlled maintenance mode;
- recover policy after restart;
- refuse unsafe configuration.

## 10.4 Audit plane

Each decision event should include, when available and legally appropriate:

- monotonic timestamp;
- operation type;
- result and policy reason;
- process ID and thread group ID;
- effective user identity;
- cgroup/container context;
- executable identity;
- object device/inode;
- path as best-effort context, not sole identity;
- policy version;
- controller mode.

---

## 11. Hook-coverage methodology

Do not choose hooks merely because their names look relevant. Build an **operation-to-hook coverage matrix** and validate it experimentally.

### Destructive-operation classes

1. remove a name;
2. remove a directory containing protected names;
3. rename a protected object;
4. replace a protected destination through rename;
5. truncate through explicit truncate operations;
6. truncate through `open` flags;
7. write/overwrite content;
8. modify metadata that enables later destruction;
9. create/remove hard links;
10. alter symlink or bind-mount access paths;
11. modify BPF policy state;
12. kill or replace the control process.

### Candidate BPF LSM enforcement points

The exact function signatures must be selected from the target kernel's LSM definitions and verified against the kernel documentation/source. Recent BPF LSM work identifies path hooks including unlink, rmdir, truncate, link, rename, chmod, and chown as supported in its described sleepable-hook set [8]. Open-source implementations also demonstrate practical use of `file_open`, `inode_unlink`, `inode_rename`, `inode_setattr`, `task_kill`, and `bpf_map` [6].

For each operation, record:

- exact syscall/test action;
- expected kernel object;
- candidate hook;
- hook arguments available;
- decision identity available;
- audit context available;
- whether denial occurs before state change;
- bypass result;
- kernel/file-system version.

---

## 12. Policy model

## 12.1 Object policy

Each protected object can have flags such as:

```text
DENY_UNLINK
DENY_RENAME_SOURCE
DENY_RENAME_DESTINATION_REPLACE
DENY_TRUNCATE
DENY_WRITE
DENY_METADATA_WEAKENING
DENY_NEW_HARDLINK
AUDIT_ONLY
```

The actual representation should be a compact bit mask.

## 12.2 Subject policy

Avoid a single permanent “root is allowed” exception. Consider explicit subject authorization based on a narrowly scoped maintenance process and inherited task context, while documenting the risks of executable-path or PID-only authorization.

Possible research variants:

- no bypass: policy change only by controller;
- controller-authorized maintenance token;
- signed request handled by controller;
- time-bounded maintenance mode;
- cgroup-scoped authorization;
- executable identity plus process lineage.

The purpose is to compare security and usability, not assume one identity mechanism is perfect.

## 12.3 Operating modes

- **OFF:** no decision or audit, used only for controlled teardown.
- **AUDIT:** log what would be denied.
- **ENFORCE:** reject protected operations.
- **MAINTENANCE:** narrowly authorized and fully logged changes.
- **DEGRADED:** protection remains but audit/control health is impaired.

## 12.4 Safe update sequence

Suggested design goal:

1. validate requested object;
2. stage new policy version;
3. atomically switch active policy where feasible;
4. verify map state;
5. persist signed/hashed policy manifest;
6. emit an audit event.

This is a proposed engineering design and should be evaluated rather than presented as a kernel guarantee.

---

## 13. Baseline systems

A strong evaluation needs more than “protected versus unprotected.”

### Baseline 1: Unix DAC

Use file and directory permissions with ordinary user/root behavior.

### Baseline 2: Immutable attribute

Evaluate the Linux immutable-file mechanism under your stated privileged threat model and maintenance workflow.

### Baseline 3: SELinux or AppArmor

Implement the closest practical mandatory-access-control policy that your environment supports. Compare policy expressiveness, operational complexity, dynamic update behavior, and overhead.

### Baseline 4: fanotify monitoring

Use fanotify as an observation or applicable permission baseline. Do not claim identical enforcement coverage: a 2025 kernel discussion notes that fanotify and LSM have different coverage, with user-space context-switch cost on fanotify and global execution cost on LSM hooks [4].

### Baseline 5: Audit-only eBPF

Attach tracing or audit programs without blocking. This separates the cost of observation from denial logic.

### Baseline 6: Unlink-only BPF LSM

Reproduce the poster's narrow architecture as the minimum BPF baseline [1].

### Proposed system: Multi-hook tamper-resistant BPF LSM

Compare every baseline on:

- operation coverage;
- privileged bypasses;
- update flexibility;
- audit quality;
- recovery behavior;
- performance;
- deployment requirements.

---

## 14. Implementation plan

## Phase A: Environment and feasibility

1. Use an isolated Linux VM, not the daily-use host.
2. Verify the target kernel exposes BTF and BPF LSM support.
3. enable the BPF LSM in the test boot configuration where required.
4. Install clang/LLVM, libbpf, bpftool, and build dependencies.
5. Generate `vmlinux.h` from target BTF for CO-RE development, following kernel documentation [2].
6. Build and attach a harmless audit-only LSM example.
7. Confirm event delivery and clean detach.

## Phase B: Narrow reproduction

1. Implement protected-object registration.
2. Attach an unlink enforcement program.
3. Demonstrate deny/allow behavior.
4. Measure a first microbenchmark.
5. Document every configuration prerequisite.

This phase reproduces the baseline and should not be claimed as final novelty.

## Phase C: Destruction-surface expansion

Add one operation class at a time:

1. rename source;
2. rename-over-destination;
3. truncate;
4. destructive open;
5. direct write, depending on your policy objective;
6. metadata weakening;
7. hard-link creation/removal;
8. protected-directory operations.

For each addition, write positive, negative, and bypass tests before continuing.

## Phase D: Control-plane hardening

1. protect map writes from unauthorized privileged processes;
2. protect pinned objects and BPF links where possible within the stated threat model;
3. protect the controller from unauthorized termination if the chosen hook and policy are defensible;
4. protect the controller binary, service definition, and configuration;
5. remove unnecessary capabilities after load;
6. separate policy administration from routine audit reading;
7. implement authenticated, logged maintenance.

SeaBee and recent anti-tamper prototypes provide valuable references for the privileged-map threat and policy-isolation problem [6][9].

## Phase E: Portability and lifecycle

1. restart controller while protection remains active;
2. reboot and restore policy;
3. test object rename and path display;
4. test deletion/recreation and inode reuse;
5. test hard links created before and after protection;
6. test bind mounts and namespaces;
7. test at least two local file systems;
8. test at least two supported kernel versions if resources permit.

## Phase F: Prototype interface

Build a command-line interface such as:

```text
protect add /path/to/file --deny unlink,rename,truncate,write
protect remove /path/to/file
protect list
protect status
protect audit --follow
protect maintenance begin
protect maintenance end
protect doctor
```

These names are suggestions, not external tool claims.

---

## 15. Test suite and adversarial experiments

## 15.1 Functional tests

- delete unprotected file: allowed;
- delete protected file: denied;
- legal read of protected file: allowed;
- rename protected source: denied;
- rename another file onto protected destination: denied;
- truncate protected file: denied;
- open protected file with destructive flags: denied;
- authorized maintenance: allowed and audited;
- remove protection, then operate: allowed.

## 15.2 Link and identity tests

- create hard link before protection;
- create hard link after protection;
- remove one of several links;
- remove final link;
- rename parent directory;
- bind-mount protected location;
- access through alternate namespace/path;
- delete/recreate same path;
- churn files to investigate inode reuse;
- verify device/inode collision handling across mounts.

## 15.3 Privileged tamper tests

Within the Level B threat model:

- update protected-object map directly;
- delete or replace pinned map/link;
- detach BPF link;
- kill controller;
- replace controller executable;
- alter controller configuration;
- load a competing BPF program if permissions permit;
- change file attributes;
- attempt policy change outside authenticated flow.

Record whether each action is blocked, detected, or outside scope.

## 15.4 Controller-failure tests

- controller crash;
- audit consumer crash;
- controller restart;
- corrupted persisted policy;
- ring-buffer pressure;
- full audit disk;
- stale registration;
- partial policy update;
- failed boot-time load.

## 15.5 Namespace/container tests

- process in ordinary container;
- privileged container;
- user namespace;
- mount namespace;
- bind-mounted protected host path;
- overlayfs upper/lower layer behavior;
- cgroup-scoped authorization.

Treat this as a strong-FYP extension if the core host design is not yet stable.

## 15.6 File-system tests

Recommended minimum:

- ext4;
- tmpfs;
- one of XFS or Btrfs.

Optional:

- overlayfs;
- NFS, clearly separated because network file-system semantics can complicate interpretation.

## 15.7 Red-team bypass matrix

Create a table with columns:

```text
attack_id
operation
privilege_level
namespace
file_system
expected_hook
expected_result
actual_result
state_changed
telemetry_received
bypass_status
notes
```

The bypass matrix may become the most valuable artifact of the FYP.

---

## 16. Performance evaluation

## 16.1 Metrics

- operation latency: median, p95, p99;
- throughput: operations per second;
- CPU utilization;
- memory and locked-memory usage;
- BPF map memory;
- audit event loss rate;
- controller CPU and memory;
- context switches where relevant;
- policy update latency;
- startup and recovery behavior;
- protected-object lookup cost;
- workload completion time.

## 16.2 Microbenchmarks

Measure repeated:

- open/close;
- create/unlink;
- rename;
- truncate;
- metadata update;
- directory traversal;
- protected versus unprotected object operations.

## 16.3 Policy-size scaling

Suggested protected-set sizes:

```text
0, 1, 10, 100, 1,000, 10,000
```

Use only sizes your environment can safely support. Report exact map configuration and memory.

## 16.4 Macrobenchmarks

Use representative workloads such as:

- source-tree compilation;
- archive extraction and deletion;
- file-server-like metadata workload;
- log rotation;
- package installation in an isolated snapshot;
- container image build, if overlayfs is in scope.

## 16.5 Experimental discipline

- fixed hardware/VM allocation;
- fixed kernel and file-system configuration;
- repeated trials;
- warm-up runs;
- randomized run order where appropriate;
- confidence intervals;
- raw results and scripts published where permitted;
- no performance comparison across unlike environments without qualification.

---

## 17. Security evaluation metrics

Do not reduce security to one accuracy number.

### Coverage

```text
blocked destructive operations / tested destructive operations
```

Report by operation class, not only aggregate.

### False denial rate

Legitimate operations incorrectly blocked under the policy workload.

### Bypass success rate

Successful state-changing attacks divided by attempted in-scope bypasses.

### Detection completeness

Percentage of tested allow/deny actions that produced the expected audit record.

### Recovery reliability

Percentage of failure/restart trials restoring the intended policy without unsafe manual intervention.

### Time to policy update

Measured time from authenticated request to verified active policy.

### Trusted computing base size

Report source lines/modules and privileges for:

- kernel eBPF programs;
- controller;
- helper processes;
- configuration and secrets.

This is descriptive, not a standalone security proof.

---

## 18. Statistical analysis

- use at least 30 repetitions for stable microbenchmarks where practical;
- report median and percentile latency because systems data may be skewed;
- include 95% bootstrap confidence intervals;
- compare paired runs when testing baseline versus protected mode;
- report effect size, not only p-values;
- separate cold-cache and warm-cache experiments;
- report all failed and verifier-rejected configurations.

For security coverage, provide exact counts and a qualitative explanation of each failure. Do not hide a bypass in an average.

---

## 19. Ethics and safety

This is defensive systems-security research, but careless experimentation can damage data or destabilize a machine.

### Required precautions

- conduct tests in disposable VMs or snapshots;
- use synthetic test files only;
- never test destructive operations on personal or institutional production data;
- maintain an out-of-band console for recovery;
- preserve a known-good kernel entry;
- document all capability and root requirements;
- avoid publishing code whose default behavior locks an entire system;
- default the prototype to audit mode;
- require explicit scope for enforcement;
- include a safe uninstall/recovery guide;
- clearly label unsupported configurations.

### Responsible claims

Do not advertise the system as:

- impossible for root to bypass;
- ransomware-proof;
- a replacement for backups;
- a complete replacement for SELinux/AppArmor;
- safe against kernel or physical compromise.

A more accurate claim is:

> The prototype enforces tested file-protection invariants against defined user-space adversaries on specified Linux configurations.

---

## 20. Timeline

### Weeks 1–4: literature and threat model

- study eBPF, BPF LSM, VFS deletion semantics, Linux security modules, fanotify, and existing prototypes;
- reproduce the current poster's narrow problem statement;
- define assets, adversaries, invariants, and exclusions;
- prepare system and safety plan.

### Weeks 5–8: environment and unlink baseline

- build VM and toolchain;
- verify BPF LSM/BTF support;
- create audit-only example;
- implement controller skeleton;
- implement unlink-only baseline;
- create initial tests.

### Weeks 9–14: operation coverage

- add rename source/destination handling;
- add truncate/destructive-open handling;
- add metadata and link policy as justified;
- build operation-hook matrix;
- test alternate paths and hard links.

### Weeks 15–19: anti-tamper and lifecycle

- harden policy maps and pinned objects;
- protect controller/control flow within scope;
- implement persistent policy and restart recovery;
- add maintenance workflow;
- document reboot/offline limits.

### Weeks 20–24: adversarial evaluation

- execute bypass matrix;
- test namespace/container cases;
- test controller failures;
- test multiple file systems;
- resolve or document failures.

### Weeks 25–28: performance evaluation

- run microbenchmarks;
- run macrobenchmarks;
- scale policy sizes;
- compare baselines;
- calculate confidence intervals.

### Weeks 29–32: usability and final prototype

- finish CLI;
- add status/doctor/audit views;
- improve safe defaults;
- write deployment and recovery documentation.

### Weeks 33–36: thesis and defense

- freeze code and test environment;
- rerun final experiments;
- complete limitations and negative results;
- prepare thesis, poster, diagrams, demo, and optional paper submission.

---

## 21. Scope options

## Minimum acceptable FYP

- isolated VM and reproducible build;
- unlink-only baseline;
- multi-hook coverage for unlink, rename-overwrite, and truncation/destructive open;
- device/inode policy map;
- simple controller and audit log;
- ext4 evaluation;
- DAC, immutable flag, and unlink-only comparisons;
- bypass matrix for unprivileged and constrained privileged user-space processes;
- microbenchmark results.

## Strong FYP

Add:

- map and controller anti-tamper;
- authenticated maintenance mode;
- two or three file systems;
- CO-RE portability testing;
- namespace/container experiments;
- macrobenchmarks;
- controller failure and recovery testing;
- complete operational documentation.

## Publication-oriented FYP

Add:

- formalized file-protection invariants;
- systematic hook-coverage derivation;
- automated red-team corpus;
- several kernels/distributions;
- container/overlayfs coverage;
- signed policy/update mechanism;
- comparison with SELinux/AppArmor and fanotify;
- public benchmark and reproducibility artifact;
- analysis of unresolved kernel/API gaps.

---

## 22. Expected contributions

1. **A destruction-surface taxonomy** for Linux file protection beyond unlink.
2. **A multi-hook BPF LSM prototype** enforcing object, content, and name protection under a defined policy.
3. **A privileged-tampering analysis** covering maps, pinned objects, controller lifecycle, and maintenance paths.
4. **A reproducible bypass benchmark** across operations, privilege levels, namespaces, and file systems.
5. **A performance and scalability study** across policy sizes and workloads.
6. **A compatibility matrix** stating exactly which Linux configurations support the design.
7. **A precise threat model and limitations report** that avoids exaggerated “root-proof” claims.
8. **An open, safe-by-default educational artifact** suitable for future security research.

Even a negative result can be valuable. If the FYP finds that robust anti-tamper requires unacceptable complexity or that conventional MAC offers stronger guarantees for a given case, that is a legitimate systems-security conclusion.

---

## 23. Main research risks and mitigation

### Risk: weak novelty

**Mitigation:** do not stop at unlink. Focus on coverage completeness, tamper resistance, lifecycle, portability, and adversarial testing.

### Risk: verifier and hook complexity

**Mitigation:** add one hook and one invariant at a time; maintain minimal programs; preserve verifier logs; use CO-RE and official kernel documentation.

### Risk: locking yourself out

**Mitigation:** audit mode first, disposable snapshots, explicit path scope, out-of-band console, safe unload plan, and never test on critical host files initially.

### Risk: privileged bypass remains

**Mitigation:** state the exact adversary, test map/link/controller attacks, add control-plane hardening, and document unavoidable reboot/kernel/offline limits.

### Risk: path confusion

**Mitigation:** use object identity for enforcement where possible, path only as contextual evidence, and test hard links, renames, namespaces, and bind mounts.

### Risk: inode reuse

**Mitigation:** persist expected metadata, monitor object lifecycle, verify registration after restart, create an explicit reuse stress test, and avoid claims unsupported by the tested file systems.

### Risk: overhead is higher than expected

**Mitigation:** profile by hook and workload, reduce policy complexity, distinguish audit overhead from enforcement overhead, and report the trade-off honestly.

### Risk: project becomes too broad

**Mitigation:** freeze the minimum scope at unlink, rename replacement, truncation/destructive open, anti-tamper basics, one main file system, and one privileged threat level. Treat containers and additional file systems as extensions.

---

## 24. Recommended deliverables

1. FYP proposal and literature review;
2. threat-model document;
3. operation-to-hook coverage matrix;
4. BPF LSM source code;
5. least-privilege user-space controller;
6. policy CLI;
7. audit-event schema;
8. automated functional and adversarial test suite;
9. benchmark scripts and raw results;
10. compatibility matrix;
11. safe installation, recovery, and uninstall guide;
12. final thesis;
13. conference-style poster;
14. demonstration video or live VM demo;
15. optional reproducibility artifact and paper submission.

---

## 25. Suggested thesis structure

1. Introduction
2. Linux file lifecycle and attacker model
3. Background: VFS, LSM, eBPF, BPF LSM, fanotify
4. Related work
5. Limitations of unlink-only protection
6. Threat model and security invariants
7. System architecture
8. Policy and hook-coverage design
9. Implementation
10. Functional and adversarial methodology
11. Performance methodology
12. Results
13. Bypasses, negative results, and limitations
14. Comparison with existing controls
15. Ethics, safe deployment, and responsible use
16. Conclusion and future work

---

## 26. Final assessment

### Academic value

**High if reframed correctly.** The topic combines operating systems, kernel programming, file-system semantics, access control, adversarial testing, and performance measurement. It is technically deep enough for a serious FYP and produces tangible artifacts.

### Feasibility

**Moderate.** A minimum prototype is achievable, but BPF verifier errors, LSM configuration, kernel-version differences, and system lockout risk make the implementation more demanding than an ordinary application project.

### Novelty

- **Low:** block `unlink` for inode IDs.
- **Moderate:** block unlink, rename, and truncate with a controller.
- **Strong:** systematically derive and test complete destructive-operation coverage, implement control-plane anti-tamper, evaluate identity/lifecycle problems, and publish a bypass benchmark.

### Recommended final research question

> **To what extent can BPF LSM provide complete, dynamically manageable, and tamper-resistant protection of critical Linux file objects against destructive operations by privileged user-space processes?**

That question is honest, measurable, and strong enough to support a high-quality FYP.

---

## 27. References and starting resources

1. N. Chen, “Poster: Preventing Unauthorized File Deletion via eBPF,” IEEE Symposium on Security and Privacy 2026 poster collection. [View poster collection](https://www.ieee-security.org/TC/SP2026/downloads/posters/sp2026posters-final3.pdf)
2. Linux kernel documentation, “LSM BPF Programs.” [Read official BPF LSM documentation](https://docs.kernel.org/bpf/prog_lsm.html)
3. Stack Overflow discussion, “Hook file deletion with EBPF,” explaining the observational nature of an ordinary kprobe return and pointing to LSM enforcement. [Read discussion](https://stackoverflow.com/questions/79108889/hook-file-deletion-with-ebpf)
4. LWN.net, “Filtering fanotify events with BPF,” coverage of the 2025 LSFMM+BPF discussion on fanotify and LSM trade-offs. [Read article](https://lwn.net/Articles/1018493/)
5. Linux manual page, `unlink(2)`. [Read unlink semantics](https://www.man7.org/linux/man-pages/man2/unlink.2.html)
6. `ebpfblock`, open-source multi-hook eBPF LSM file-protection daemon. [View repository](https://github.com/jrsmile/ebpfblock)
7. Stack Overflow discussion on pre-deletion interception, path retrieval, and backup timing. [Read discussion](https://stackoverflow.com/questions/69641533/is-it-possible-to-do-it-using-ebpf-i-e-can-i-capture-the-event-before-the-fil)
8. Linux Plumbers Conference material, “kfuncs for BPF LSM use cases,” including path hooks and `bpf_path_d_path()` discussion. [View slides](https://lpc.events/event/18/contributions/1940/attachments/1438/3389/kfuncs%20for%20BPF%20LSM%20Use%20Cases.v4.pdf)
9. NSA, SeaBee, a framework for hardening eBPF security tools against privileged intervention. [View repository](https://github.com/NationalSecurityAgency/seabee)
10. Eunomia eBPF tutorial, “Security Detection and Defense using LSM,” including Linux 5.7 BPF LSM background and capability checks. [Read tutorial](https://eunomia.dev/tutorials/19-lsm-connect/)
11. A. Sekar, S. G. Kulkarni, and J. Kuri, “Leveraging eBPF and AI for Ransomware Nose Out,” 2024. This is relevant related work for behavior-based eBPF security, but its research objective differs from file-object policy enforcement. [Read paper](https://arxiv.org/html/2406.14020v1)
12. `ebpfangel`, an open research prototype for eBPF and machine-learning-based Linux ransomware detection. [View repository](https://github.com/TomasPhilippart/ebpfangel)

---

## 28. Immediate starting checklist

- [ ] Lock the threat model to privileged user-space processes, not kernel compromise.
- [ ] Set up a disposable Linux VM with snapshots.
- [ ] Verify BPF LSM and BTF support.
- [ ] Reproduce an audit-only LSM program.
- [ ] Implement the unlink-only baseline.
- [ ] Write tests before adding more hooks.
- [ ] Build the destructive-operation matrix.
- [ ] Add rename-overwrite and truncation coverage.
- [ ] Add map/controller tamper tests.
- [ ] Freeze the minimum FYP scope before container extensions.
- [ ] Measure overhead and publish negative results.
