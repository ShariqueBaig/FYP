# Batch 3 Addendum: Affordable ROS 2 Teaching Robot for LMIC Universities

## Proposed title
**PakBot-EDU: A Locally Maintainable, Low-Cost ROS 2 and micro-ROS Mobile Robot for Robotics Education in Pakistan and Other LMICs**

## Assessment
- **Overall:** 8.8/10
- **CV fit:** 9.3/10
- **Difficulty:** High but manageable for three people
- **Original novelty:** 5.5/10
- **Refined novelty:** 8.0/10
- **Social/educational value:** Very high
- **Verdict:** Retain, but do not pitch it as merely a cheaper TurtleBot.

## Honest novelty check
Low-cost ROS 2 robots already exist. MARPY documents an ESP32/micro-ROS differential-drive platform with a stated bill of materials below USD 50, Gazebo support, odometry and host-assisted ROS 2. ROSMO is an ESP32-S3 educational platform designed without requiring soldering or 3D printing. Andino reports a budget below USD 300, while SMARTmBOT reports approximately USD 210. Therefore, replacing a Raspberry Pi with an ESP32 is not, by itself, a research contribution.

The defensible research gap is:

> Can a locally sourceable, repairable and progressively extensible ROS 2 platform deliver defined undergraduate learning outcomes under the procurement, infrastructure and maintenance constraints of Pakistani and similar LMIC universities?

## Refined contribution
1. **Local component substitution:** permit several motors, drivers, IMUs and controllers through documented compatibility profiles.
2. **Capability tiers:** simulation-only, MCU/host-assisted, and optional onboard-SBC modes using the same ROS interfaces.
3. **Repairability:** replaceable motor, power, sensor and controller modules.
4. **Offline/recovery support:** reusable local installation, Wi-Fi/power recovery and firmware restore.
5. **Teaching reproducibility:** versioned setup, hardware self-test, instructor diagnostics and common simulation/hardware topics.
6. **Educational evidence:** evaluate defined ROS, control, odometry, sensor and debugging outcomes.
7. **Total cost of ownership:** include hosts, fabrication, spares, repairs, tools and instructor time, not only component price.

## Recommended architecture
### Base tier
- Differential-drive chassis and two encoder motors
- ESP32 running micro-ROS
- Motor driver, battery monitor and optional IMU/range sensors
- ROS 2 and micro-ROS agent on a shared lab PC or student laptop
- Standard interfaces for velocity, encoder/odometry, IMU, range and battery data

### Wired alternative
A Raspberry Pi Pico/RP2040 can use micro-ROS through a host agent and serial transport. Evaluate it as a predictable wired teaching tier, not automatically as the main mobile platform.

### Optional advanced tier
Add a Raspberry Pi-class SBC only when a course requires onboard perception or navigation. The core FYP can credibly teach nodes, topics, services, launch files, URDF, teleoperation, encoder calibration, PID control, odometry, introductory fusion, obstacle detection and simulation-to-hardware transfer. Treat LiDAR, SLAM, Nav2 and edge AI as stretch goals.

## Required final artifact
- At least three repeatable physical units
- Open CAD, wiring and modular hardware design
- Locally validated BOM with substitute parts
- ESP32 and/or Pico firmware
- ROS 2 packages, URDF, launch files and Gazebo model
- Self-test and instructor diagnostics
- Six to eight laboratory exercises
- Reproducible/offline-friendly setup
- Repair and maintenance manual
- Cost, reliability and technical evaluation
- Small ethics-approved teaching pilot or structured educator review

## Research questions
1. Can host-assisted ROS 2 hardware provide useful university teaching capability at lower total laboratory cost than integrated platforms?
2. Which outcomes work on MCU-only/host-assisted hardware, and which require an SBC, LiDAR or camera?
3. Does simulation-first instruction reduce setup failures and improve exercise completion?
4. How do locally substituted components affect control, odometry and reliability?
5. Does modular repair reduce downtime and replacement cost?
6. How do Wi-Fi and serial transport compare for classroom exercises?

## Evaluation
### Cost
Use dated Pakistani quotations and report components, fabrication, tools, spares, host assumptions, repair cost, cost per student group and cost per completed lab. Do not select a PKR target before collecting quotations.

### Technical
Measure velocity error, odometry drift, latency/jitter/loss, interruption recovery, battery endurance, assembly repeatability, inter-unit variance, module replacement time and simulation-to-hardware difference.

### Educational
With university approval, compare simulation-only versus simulation-plus-hardware, or conduct pre/post exercises and instructor review. Measure completion, debugging success, setup burden and maintainability. Do not claim learning improvement without evidence.

## Three-person split
1. **Embedded/control:** chassis, power, encoders, PID, firmware, reliability.
2. **ROS/simulation:** micro-ROS, ROS packages, URDF/Gazebo, diagnostics and optional navigation.
3. **Curriculum/evaluation:** labs, sourcing/TCO, educator study, documentation and productization.

Sharique fits system integration and embedded/control particularly well due to his ESP32 robot, PID line follower, drone coordination, xv6/QEMU, Docker and security experience.

## Optional security differentiator
Use only a bounded classroom-fleet layer: signed firmware/update packages, per-robot identity, authenticated enrollment, safe command limits/emergency stop, student-session reset and tamper-evident configuration logs. This is sufficient to distinguish a safely manageable teaching fleet without turning the project into an overloaded security platform.

## Pakistan collaboration map
### NCRA
NCRA describes a consortium of 11 labs over 13 Pakistani universities, with objectives covering robotics R&D capacity, commercialization, shared services and human-resource development. Its listed labs include Robot Maker and Robot Design and Development at NUST, Human Centered Robotics, Swarm Robotics, NED/MUET Haptics and Condition Monitoring, and Advanced Robotics and Automation. Ask for a design review, ROS educator feedback, a test session or referral to the most relevant lab.

### NCAI
Its listed Intelligent Field Robotics Lab at NUST and Smart City labs at NED are plausible routes for navigation, perception or educational validation.

### Regional routes
NED/MUET are practical due to Karachi/Hyderabad proximity. UET Taxila's Swarm Robotics Lab becomes relevant if the platform includes a multi-robot teaching module.

### Open-source maintainers
Contact MARPY, ROSMO, Andino or SMARTmBOT maintainers with a specific contribution: Pakistani substitute BOMs, offline setup, reliability benchmarks, Urdu teaching material, classroom diagnostics or fixture-free assembly. Building on prior work may strengthen, rather than weaken, the thesis.

## Partner value
Partners could receive an openly documented platform, Pakistani classroom/cost evidence, reusable labs, comparison of MCU/host/SBC tiers, a swarm/control/IoT teaching base and a commercialization candidate. These are potential benefits, not promised outcomes.

## Risks
- **Weak novelty:** center LMIC maintainability and learning evidence, not low price.
- **Hidden laptop cost:** disclose host requirements and include them in TCO.
- **Cheap mechanical variability:** build multiple units and quantify/calibrate variance.
- **ROS setup burden:** provide containers/images, offline documentation and self-tests.
- **Overpromised autonomy:** guarantee a base curriculum; make SLAM/AI optional.
- **Poor maintainability:** measure repair time, connector durability, spares and instructor workload.

## Final verdict
This is a strong FYP after refinement. Cheap ROS robots already exist, so the project should be presented as a **Pakistan/LMIC-oriented, locally substitutable, repairable and evidence-validated teaching platform**. It ranks approximately fifth to seventh in the master catalogue. It is less directly aligned with your cybersecurity trajectory than agent security, Urdu scam intelligence, SentinelEdge or eBPF, but it has excellent hardware fit, social impact, demonstration value and possible education-product potential.

## Sources checked on 26 August 2026
- [MARPY repository](https://github.com/LevinTamir/MARPY)
- [MARPY Open Robotics discussion](https://discourse.openrobotics.org/t/marpy-a-50-micro-ros-robot/54536)
- [ROSMO project](https://www.hackster.io/Rosmo/rosmo-easy-to-build-robot-platform-for-ros-2-and-microblock-9da8eb)
- [Andino educational platform](https://ekumenlabs.com/blog/posts/andino-empowering-education-with-an-open-source-educational-robot/)
- [SMARTmBOT paper](https://ar5iv.labs.arxiv.org/html/2203.08903)
- [micro-ROS Raspberry Pi Pico SDK](https://github.com/micro-ROS/micro_ros_raspberrypi_pico_sdk)
- [TurtleBot 4 description](https://clearpathrobotics.com/turtlebot-4/)
- [ROSbot 2 listing](https://www.roboworks.net/store/p/rosbot2)
- [National Centre of Robotics and Automation](https://ncra.org.pk/)
- [NCAI core labs](https://ncai.pk/core-labs/)
- [NCRA laboratory list at NUST](https://ceme.nust.edu.pk/department-page/ncra/)
- [UET Taxila Swarm Robotics Lab](https://web.uettaxila.edu.pk/SwarmRoboticsLab/Index)
