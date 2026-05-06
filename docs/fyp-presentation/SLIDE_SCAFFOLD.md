# FYP Oral Presentation — Slide Scaffold

Working document for the oral presentation of:

> **Full-Stack Web Development of an Automated Assessment Platform for UML Diagrams**
> Project ID: **CCDS25-0233**
> Wang Yu Teng (U2122796L) · Supervisor: Dr. Loke Yuan Ren · Examiner: Prof. Zhang Hanwang
> NTU College of Computing and Data Science · 2026

Reference decks: Lee Juin (2024, NTU SCSE web app — primary template), Tjandy Putra (2023), Joshua Lee (2022). Source PDFs at `/tmp/fyp-slides-research/`.

---

## Part 1 — Locked Decisions

Resolved during grilling pass:

| Decision | Choice | Rationale |
|---|---|---|
| **Story arc** | 65% platform / 35% empirical | Both halves of the report (Ch 3 + Ch 4) are peer contributions; neither subordinate. |
| **Time** | 20 min + 5 min Q&A | NTU CCDS slot. Demo video ≈3 min eats into the 20. |
| **Spine** | 5-section: Background → Demo → Implementation → Experiment → Conclusion | Mirrors report's chapter peer-structure. Promotes Experiment to its own section. |
| **Demo format** | Pre-recorded video (openscreen-edited) | Removes live-demo risk from LLM latency + Wi-Fi. |
| **Implementation organisation** | Mirror report's Ch 3 sequence | Architecture → DB → Lifecycle → AI Pipeline → Deployment. Examiner can cross-reference. |
| **Experiment organisation** | Conventional order (RQs → setup → metrics → results → threats) | Prof Zhang's CV/research background expects methodology before headline. |
| **Highlight slides** | Dual-Modality Prompting (Impl) + RQ1 Accuracy (Exp) | The technical kernel + the empirical headline. |
| **Conclusion** | 3 slides: divider + Summary/Future Works combined + Thank You | Talk itself was the summary. |
| **Visual template** | Lee Juin dark theme (dark bg + orange/gold accents + numbered card grids) | Coheres with the structural pattern; projector-friendly. |
| **Threats slide framing** | "Threats to Validity" (academic framing) | Signals research mindset to the examiner. |
| **Slide count** | 33 slides total | 5 dividers + 28 content + demo video. ~21 min — matches Lee Juin's pacing. |

---

## Part 2 — Tips That Apply (distilled)

From Prof Chng's [SCSE undergrad tips](https://aseschng.github.io/UndergraduateStudents.html), filtered to what's load-bearing here:

- **Visual storytelling** — narrate with figures, zoom in/out, don't lecture in bullets.
- **Hard formatting** — first slide carries name, title, year, project ID. Page numbers on every slide. Demo video heavily edited with annotations/highlights.
- **Required content order** — problem & motivation → lit survey (project-relevant only) → solution (novelty/difficulty/creativity) → results (demo) → conclusions + future work.
- **Rehearse on camera** before the real thing.

What I picked up from sample decks:

- **Numbered card grids** (Lee Juin) — 3–5 cards per slide, scannable, avoids paragraphs.
- **Architecture diagram + 3 cards beside it** — diagram on right, "what to notice" on left.
- **Real artifacts** (kubectl output, code snippets, file trees) — proves the system isn't slideware.
- **"My Contributions" slide** — critical for FYP examiner; spell out what *you personally* did.
- **Dead slides are visible** — Tjandy left a blank black slide in his deck. Proofread.

---

## Part 3 — Slide-by-Slide Scaffold (33 slides)

Notation per slide: **Visual** (what's on it) · **On-slide** (text the audience reads) · **Speaker** (what you actually say) · **Time** (target).

Visual style throughout: **dark background, orange/gold accents, numbered cards**, page number bottom-right, project ID `CCDS25-0233` bottom-left in subtle grey.

---

### SECTION 01 — BACKGROUND (slides 1–7, ~3.5 min)

#### Slide 1 — Title
**Visual:** Dark backdrop with diagonal accent shapes. NTU shield top-left.
**On-slide:**
- **Full-Stack Web Development of an Automated Assessment Platform for UML Diagrams**
- Wang Yu Teng (U2122796L)
- Supervisor: Dr. Loke Yuan Ren
- Examiner: Prof. Zhang Hanwang
- College of Computing and Data Science · 2026
- CCDS25-0233 (bottom-left, subtle)

**Speaker:** "Good morning. My name is Wang Yu Teng, and I'll be presenting my final-year project — a full-stack web platform for automated assessment of UML diagrams. This is project CCDS25-0233 under Dr. Loke."
**Time:** 25s

---

#### Slide 2 — Outline
**Visual:** 5-quadrant grid (3+2 layout) of large rounded cards, numbered 01–05.
**On-slide:**
- 01 — Background
- 02 — Demo
- 03 — Implementation
- 04 — Experiment
- 05 — Conclusion

**Speaker:** "I'll walk through five sections — start with the problem and what's already been tried, show you the system in action, dig into how it's built, present the empirical results from comparing six LLMs, and wrap up."
**Time:** 25s

---

#### Slide 3 — Section Divider: 01 Background
**Visual:** Big "01" numeral + "Background" + abstract icon (lightbulb / question mark).
**On-slide:** Just the section title.
**Time:** 8s

---

#### Slide 4 — The Grading Bottleneck
**Visual:** Left half: illustration of a TA buried under a stack of papers + diagram printouts. Right half: stat callouts in cards.
**On-slide (callouts):**
- ⏱️ **~15 min** to grade a single class diagram
- 📚 **200 students × 5 diagrams = 1,000 diagrams** per assignment
- 🔥 **≈83 hours** of TA effort per cohort
- 🎲 **Inconsistency**: different graders interpret rubrics differently — a recognised threat to assessment validity

**Speaker:** "Computer-science enrollments have more than doubled in the last decade. UML is still core to software-engineering curricula, but it's the worst-case grading workload — a single class diagram takes about 15 minutes to evaluate, and a 200-student cohort with five diagrams produces a thousand artifacts. That's roughly 83 hours of TA grading per assignment. And that's before we factor in inconsistency between graders."
**Time:** 45s

---

#### Slide 5 — Prior Work + The Research Gap
**Visual:** Two-column comparison table. Headline quote at the bottom.
**On-slide:**

| **Traditional methods** | **LLM-based methods** |
|---|---|
| UMLGrader (heuristic, IBM Rational Rose only) | Wang et al. — GPT-4o on 40 students, 1.18-pt gap, weak on class/sequence |
| Bian et al. — Levenshtein + WordNet, class-only | Bouali et al. — GPT-o1-mini + Sonnet + Llama, **ICC = 0.76** |
| Modi / Jebli — XMI parsing, Modelio-locked | DUET — GPT-4o + Mistral-7B, formative only |
| ❌ Tied to specific tools, class-only, no semantic richness | ⚠️ Used **earlier-generation models** with smaller context, weaker reasoning, format-compliance issues |

> **The gap:** No study has revisited LLM-based UML grading using SOTA models with API-level structured-output enforcement — and no production-grade assessment platform embeds such a pipeline.

**Speaker:** "Two waves of prior work. Traditional rule-based and ML approaches were promising but tightly coupled to specific tools — Modelio, Rational Rose — and limited to class diagrams. Then LLM-based studies emerged: Wang et al. evaluated GPT-4o, Bouali et al. compared multiple models in early 2025 and got ICC of 0.76. But all of these used earlier-generation models with weaker reasoning and no structured-output enforcement. The gap I'm addressing is twofold — revisit the empirical question with SOTA models, and embed the result in a deployable platform."
**Time:** 55s

---

#### Slide 6 — Project Objectives
**Visual:** 5 numbered cards in a 3+2 layout.
**On-slide:**
1. **[O1]** Build a full-stack platform for the end-to-end assessment lifecycle
2. **[O2]** Implement an LLM grading pipeline with structured-output enforcement
3. **[O3]** Reduce TA grading effort through a streamlined review UI
4. **[O4]** Empirically evaluate SOTA LLMs for UML grading
5. **[O5]** Containerised deployment for on-premise NTU infrastructure

**Speaker:** "Five objectives, each tied to a measurable outcome. The first three are platform engineering. The fourth is the empirical contribution. The fifth is operational deployability — non-negotiable for a school context."
**Time:** 35s

---

#### Slide 7 — My Contributions
**Visual:** 5 numbered cards in 3+2 layout.
**On-slide:**
1. **Full-stack platform** — React 19 SPA + Hono backend + Drizzle/PostgreSQL + Graphile Worker; 16 tables across 5 functional groups; 83 endpoints across 11 route modules
2. **AI grading pipeline** — Provider-agnostic factory (OpenAI / Anthropic / Google), **dual-modality prompting** (PlantUML text + rendered image), Zod-validated structured output with score clamping, human-in-the-loop accept/reject
3. **Custom UML diagram editor & viewer** — Built on React Flow with custom UML node/edge types; structured JSON ↔ PlantUML DSL ↔ rendered PNG; no off-the-shelf solution met the dual-modality requirement
4. **Empirical LLM evaluation** — 6 models × 32 submissions × 5 runs = **960 API calls**; weighted-aggregate framework across accuracy, consistency, cost, feedback quality, speed, rubric adherence
5. **Containerised deployment** — Multi-stage Docker on Node 20 Alpine + Kubernetes manifests with HPA on the web tier, single-replica worker

**Speaker:** *(critical slide — slow down)* "Five contribution areas. The platform is the engineering layer — sixteen tables, eighty-three endpoints, eleven route modules. The AI grading pipeline is where the design effort is concentrated, and I'll come back to dual-modality prompting in detail. The custom UML editor was necessary because no off-the-shelf component could produce both the structured PlantUML text and the rendered image we need for grading. The empirical evaluation involved 960 API calls across six frontier models. And the deployment story uses a single Docker image that serves both web and worker tiers."
**Time:** 50s

---

### SECTION 02 — DEMO (slides 8–9, ~3.5 min)

#### Slide 8 — Section Divider: 02 Demo
**Visual:** Big "02" + "Demo" + screen-recording icon.
**Time:** 8s

---

#### Slide 9 — Demo Overview + Live Video
**Visual:** Centred laptop screenshot of the staff dashboard. Feature labels radiating outward with thin connector lines (Lee Juin slide 10 pattern).
**On-slide labels (left side):**
- Course management & CSV roster
- Question pool with type/tag filtering
- Assignment builder with timing + focus-monitor config
- Two-panel grading interface
- Grade override with audit trail

**On-slide labels (right side):**
- Student attempt: auto-save every 30s
- Focus monitoring with auto-submit
- AI grading: written + UML
- Accept / reject AI suggestions
- Cost & token tracking dashboard

**Speaker:** "Before the architecture deep dive, I want you to see it working. The demo is about three minutes — I'll show you the staff workflow, then the student workflow, then the AI grading loop. Hit play."

**Then: video plays (~3 min, openscreen-edited with annotations).**

**Demo video sequencing (script for editing):**
1. **Staff (60s)** — log in → create course → import roster CSV → build question pool (one MCQ, one written, one UML) → create assignment with focus-monitoring on
2. **Student (60s)** — start assignment → MCQ → essay → draw UML class diagram in editor → auto-save indicator visible → submit
3. **Grading (60s)** — staff opens grading dashboard → trigger AI grading → real-time progress → review AI suggestion with per-criterion breakdown → accept on the strong ones, override on a weak one → publish results

Each sub-segment should have an annotation overlay naming what's happening (e.g. "Auto-save triggered", "AI suggestion populated").

**Time:** 30s slide + 180s video = 210s total

---

### SECTION 03 — IMPLEMENTATION (slides 10–21, ~7.5 min)

#### Slide 10 — Section Divider: 03 Implementation
**Visual:** Big "03" + "Implementation" + gear icon.
**Time:** 8s

---

#### Slide 11 — System Architecture
**Visual:** Three-tier architecture diagram (your Figure 3.1):
- Top tier: React SPA (Vite + TanStack Router)
- Middle tier: Hono REST API + Graphile Worker (decoupled processes)
- Bottom tier: PostgreSQL (Supabase) + external LLM APIs

**On-slide (3 cards beside diagram):**
1. **Monolithic, not microservices** — single codebase, modular route files; one Docker image, one deployment unit
2. **Web ↔ worker separation** — LLM calls take 5–60s; decoupling keeps the request path responsive during exam-period spikes
3. **PostgreSQL job queue** (Graphile Worker) — no Redis, transactional with application data

**Speaker:** "Three logical tiers. The critical decision was separating the web server from the background worker. LLM grading takes anywhere from five to sixty seconds — running that inside the request cycle would block the event loop for every concurrent user. By decoupling job enqueueing from job processing through PostgreSQL, the web server stays responsive even under exam-period load."
**Time:** 50s

---

#### Slide 12 — Tech Stack
**Visual:** Logos grouped into rows on a single slide.
**On-slide:**
- **Language & Runtime** — TypeScript 5.9 · Node.js 20
- **Frontend** — React 19 · Vite · TanStack Router · TanStack Query · Tailwind CSS · React Flow (xyflow 12.10)
- **Backend** — Hono 4.11 · Drizzle ORM · Zod 4.3 · Graphile Worker 0.16
- **Auth** — Supabase Auth + custom JWT (dual-validation)
- **AI** — Vercel AI SDK 6.0 → OpenAI · Anthropic
- **UML** — plantuml-encoder
- **Testing** — Vitest · Playwright
- **DevOps** — Docker (multi-stage Node 20 Alpine) · Kubernetes / k3s · GitHub Actions

**Speaker:** *(don't read it — pattern-match for the audience)* "Standard modern TypeScript stack with two non-default choices. Hono over Express for performance. Graphile Worker over Redis-backed queues so the school deployment doesn't need a second data store. Everything else is conventional."
**Time:** 25s

---

#### Slide 13 — Database Design
**Visual:** Simplified ER diagram showing the 5 functional groups (your Figure 3.2 distilled). Annotations on key tables: `questions.content` (JSONB), `submissions` (state machine), `marks + aiGradingJobs` (audit trail).

**On-slide (3 callouts):**
1. **JSONB for polymorphic question content** — three question types (MCQ / written / UML) without messy joins
2. **PostgreSQL enums for state machines** — `submission_status: draft → submitted → late → grading → graded` enforced at DB level
3. **Composite uniqueness constraints** — guarantees data integrity under concurrent exam load (race conditions cannot create duplicate enrollments or answers)

**Speaker:** "Sixteen tables in five functional groups. Two design choices worth flagging — JSONB for question content lets me support three different question shapes without three separate content tables, and PostgreSQL enums enforce the submission state machine at the database level rather than in application code. Composite unique constraints on submissions and answers prevent retry-storm duplicates during real exam load."
**Time:** 45s

---

#### Slide 14 — Lifecycle: Staff Side
**Visual:** Three sequential screenshots — Course Management → Question Pool → Assignment Builder modal — connected by arrows.
**On-slide:**
- **Course management** — individual + bulk CSV enrollment (transactional rollback on any invalid email)
- **Question pool** — course-scoped, tag-based filtering, CSV import/export, reusable across assignments
- **Assignment builder** — due date, time limit, max attempts, late penalty (none / fixed / per-day / per-hour with cap), question shuffling, focus-monitor threshold, MCQ wrong-answer penalty

**Speaker:** "The staff workflow has three stages. Courses come first — bulk-enrollment via CSV is transactional, so a single bad email rolls back the entire batch instead of leaving you with partial state. Questions live in a course-scoped pool that can be reused across multiple assignments. The assignment builder configures every policy — timing, attempts, late penalties, randomisation, focus monitoring."
**Time:** 40s

---

#### Slide 15 — Lifecycle: Student Side
**Visual:** Student attempt UI screenshot. Beside it: state machine diagram for submission status (your Figure 3.7).
**On-slide:**
- **Idempotent start** — if a draft exists, return it; never duplicate
- **Auto-save every 30s** when changes detected (with visible timestamp indicator)
- **Dual-layer timer enforcement** — client countdown for UX + server cron polling every 60s for expired drafts
- **Opt-in focus monitoring** — tab switches counted, threshold breach → auto-submit current state
- **Atomic submission** — entire submission pipeline wrapped in one DB transaction

**Speaker:** "The student attempt is the riskiest UX surface — a browser crash mid-exam can't lose work, and a dishonest student can't game the timer. So we have three independent enforcement layers: auto-save every thirty seconds, a server-side cron that force-submits expired drafts within sixty seconds, and opt-in focus monitoring that auto-submits if the student switches tabs too many times. The submission itself is wrapped in a single database transaction — atomic by construction."
**Time:** 45s

---

#### Slide 16 — Custom UML Diagram Editor
**Visual:** Screenshot of the UML editor (your Figure 3.11) annotated with: ① canvas nodes ② structured inline forms ③ relationship popover ④ Visual builder / PlantUML / Preview tabs.
**On-slide:**
- **Built on React Flow** + custom UML node and edge types (association, aggregation, composition, inheritance, realisation)
- **Structured input over free-text** — visibility selectors + typed names, not freeform UML notation
- **Two-export design**: serialises to PlantUML DSL (text) AND PNG (image) — both deterministic from editor state
- **Component reuse** — same `UMLEditor` for student attempts, `UMLViewer` for staff grading and reference answers

**Speaker:** "The editor is custom-built. Off-the-shelf options either lacked grading hooks or output formats incompatible with the dual-modality grading I'll show next. It's structured rather than free-text — students pick visibility from a dropdown and type the attribute name, instead of writing raw UML notation. That structured input is what makes deterministic export to PlantUML possible. The same component renders for the student during their attempt, for staff during grading, and for the LLM as input."
**Time:** 50s

---

#### Slide 17 — AI Grading: Async Job Architecture
**Visual:** Sequence diagram (your Figure 3.9) — staff browser → API → PostgreSQL → Graphile Worker → LLM provider → back through DB to staff notification.
**On-slide:**
- Staff trigger batch grading → API enqueues N jobs and returns immediately
- Worker runs at **concurrency = 1** — sequential processing avoids LLM rate-limit contention
- **Fetch → prompt → call → validate → store** pipeline
- Failures recorded with full error message + staff notification (visible, not silent)

**Speaker:** "Grading is asynchronous and Postgres-queued. Staff trigger a batch, the API immediately returns with a job count, and the worker processes them sequentially. Concurrency is deliberately set to one — parallel LLM calls risk rate-limit errors and unpredictable latency, and at the school scale of fifty to a hundred students per course, sequential processing finishes in a reasonable window. Every job is logged. Failures are surfaced to staff, not swallowed."
**Time:** 40s

---

#### Slide 18 — ★ AI Grading: Dual-Modality Prompting (HIGHLIGHT)
**Visual:** Three-panel diagram:
1. UML editor state (structured JSON)
2. Two arrows splitting to: PlantUML DSL text (left) + rendered PNG (right)
3. Both feed into the LLM prompt with the rubric

Beside it: 4 small cards with the alternatives considered.

**On-slide (alternatives card):**
| Approach | Trade-off |
|---|---|
| Textual DSL only | Loses visual properties (notation, layout) |
| Pure vision (image only) | Hallucination on fine-grained labels |
| Graph matching | Deterministic but no semantic judgment |
| Code generation | Lossy — strips UML-specific semantics |
| **✅ Dual-modality** | Cross-references text against image |

**Speaker (slow down — this is the kernel):** "This is the technical core. UML is a visual artifact with both structural semantics and spatial properties. I considered four alternatives — text-only DSL conversion loses visual properties; pure vision risks hallucination on fine-grained labels; graph matching gives no semantic judgment; code generation introduces a lossy translation step. The platform uses dual-modality: it serialises the editor state into PlantUML DSL for an unambiguous structural view, and it renders the same state as a PNG for visual assessment. Both go into the prompt — the LLM cross-references one against the other, which catches errors that either modality alone would miss."
**Time:** 65s

---

#### Slide 19 — AI Grading: Structured Output + Defensive Validation
**Visual:** Code snippet (anonymised, ~10 lines) of the Zod schema. Beside it: example LLM JSON response, validated.
**On-slide:**
- **Vercel AI SDK `generateObject()`** with Zod schema → API-level structured output enforcement
- **Schema validation** — malformed output → job fails explicitly (no corrupt data)
- **Score clamping** — bounded `[0, maxPoints]` guards against out-of-range hallucinations
- Result: **100% parse rate** on Claude Opus and Sonnet (see Section 04)

**Speaker:** "Two layers of defence. Schema validation through Zod and the AI SDK guarantees the LLM returns valid JSON or fails the job. Score clamping catches the known LLM tendency to occasionally hallucinate out-of-range numbers. Together they ensure that no corrupt suggestion ever reaches the staff review interface — a structural invariant, not just convention."
**Time:** 40s

---

#### Slide 20 — Human-in-the-Loop Review
**Visual:** Two-panel grading screen screenshot (your Figure 3.10) annotated with: AI suggestion box → Accept / Reject buttons → official mark stored separately.
**On-slide:**
- AI never writes to the gradebook directly — suggestions are staged, separate from `marks` table
- **Accept** → official mark with audit metadata (`source = ai_assisted`, original suggestion preserved)
- **Reject** → suggestion cleared, staff grades manually
- **Override** of an existing mark requires a written reason
- Result: every published grade has verifiable human oversight

**Speaker:** "The most consequential design decision in the pipeline. AI suggestions live in a staging column, separate from the official marks table. Staff must explicitly accept or reject each one. Every grading action — including overrides of existing marks — is recorded with provenance metadata: who reviewed, whether AI-assisted, whether the AI suggestion was accepted as-is or modified. This audit trail is what makes AI grading defensible at the institution level."
**Time:** 40s

---

#### Slide 21 — Deployment & CI/CD
**Visual:** Two-panel: left = Docker multi-stage diagram (Figure 3.12), right = Kubernetes topology (Figure 3.13) with HPA-scaled web tier and single-replica worker.
**On-slide:**
- **Single Docker image** serves both web and worker tiers (CMD override switches role)
- **Web tier**: HPA-scaled for exam burst load
- **Worker tier**: single replica to avoid LLM rate-limit contention
- **Pre-deploy migration job** — schema current before any pod serves traffic
- **GitHub Actions CI/CD**: lint + unit tests every push, image build + ghcr.io push on main, migrations applied automatically
- **Layered dependency model** — minimal on-prem deployment needs only PostgreSQL + the Docker image

**Speaker:** "One Docker image, two roles — the same image starts the web server by default or the Graphile worker via a CMD override. That halves the build matrix while keeping the tiers independently scalable. The web tier scales horizontally for exam-period traffic; the worker stays at a single replica because parallel LLM calls collide with rate limits. Migrations run as a pre-deploy job so the schema is always current before traffic hits. And critically — none of the external services are hard prerequisites. A bare-bones on-prem deployment needs only PostgreSQL and the image."
**Time:** 35s

---

### SECTION 04 — EXPERIMENT (slides 22–30, ~5.5 min)

#### Slide 22 — Section Divider: 04 Experiment
**Visual:** Big "04" + "Experiment & Evaluation" + flask/microscope icon.
**Time:** 8s

---

#### Slide 23 — Research Questions
**Visual:** 4 numbered cards in 2×2 grid.
**On-slide:**
1. **RQ1** — Which LLM achieves the highest grading accuracy compared to human experts?
2. **RQ2** — What is the cost-performance tradeoff between flagship and baseline models across providers?
3. **RQ3** — How consistent are LLM grades across multiple runs on the same submission?
4. **RQ4** — Which model produces the most reliable structured output and useful qualitative feedback?

**Speaker:** "Four research questions. RQ1 is grading accuracy against human ground truth. RQ2 is the cost-performance trade-off — does the cheaper model in each provider's lineup hold up? RQ3 is inter-run consistency, since stochastic outputs would undermine reproducibility. RQ4 is structured output reliability — the format-compliance issue that Piscitelli et al. raised in 2025."
**Time:** 35s

---

#### Slide 24 — Experiment Setup
**Visual:** Two side-by-side tables.
**On-slide (Models — Table 4.1 abridged):**
| Model | Provider | Tier | Cost in/out per 1M |
|---|---|---|---|
| Claude Opus 4.6 | Anthropic | Flagship | $5 / $25 |
| Claude Sonnet 4.6 | Anthropic | Baseline | $3 / $15 |
| GPT-5.4 | OpenAI | Flagship | $2.50 / $15 |
| GPT-5.4 Mini | OpenAI | Baseline | $0.75 / $4.50 |
| Gemini 3.1 Pro | Google | Flagship | $2 / $12 |
| Gemini 3 Flash | Google | Baseline | $0.50 / $3 |

**On-slide (Dataset):**
- 32 submissions = **2 real** (McGill UML repository) + **30 synthetic** across 5 quality tiers (Excellent / Good / Average / Poor / Failing)
- 3 domains: Library Management · E-Commerce · Hospital Management
- 5-criterion rubric: class correctness · relationship accuracy · cardinality · naming · completeness
- **5 runs per submission per model = 960 total API calls** at temperature 0.0

**Speaker:** "Six models — one flagship and one baseline from each of three providers. Two real student submissions from the McGill repository and thirty synthetic submissions covering the full grade spectrum across three domains. Each submission graded five times by each model — nine hundred and sixty API calls total. Temperature zero where supported, exponential backoff on transient failures, every call logged with prompt, response, latency, and token usage."
**Time:** 50s

---

#### Slide 25 — Evaluation Metrics
**Visual:** Table of the 6 metrics with their weights (your Table 4.3). Below: the weighted-aggregate formula.
**On-slide:**
| Metric | Weight | What it captures |
|---|---|---|
| Accuracy | 35% | Pearson r + MAE vs ground truth |
| Consistency | 25% | Std. dev. across 5 runs |
| Cost | 10% | USD per submission |
| Feedback quality | 15% | Parse success + structured-output compliance |
| Speed | 5% | Median latency |
| Rubric adherence | 10% | % rubric criteria addressed |

**Formula:** `W = 0.35·S_acc + 0.25·S_con + 0.10·S_cst + 0.15·S_fdb + 0.05·S_spd + 0.10·S_rub`

Each sub-score normalised against an **absolute reference ceiling** (not min-max) — preserves stability when models are added/removed.

**Speaker:** "Six metrics, weighted toward accuracy (35%) and consistency (25%) since this is summative assessment — both account for sixty percent of the weighted score. Cost and speed are deliberately low-weighted because at the target scale of fifty to a hundred students, even the most expensive model costs under four cents per submission. Each metric is normalised against an absolute reference ceiling rather than min-max, so the rankings stay stable if more models are added later."
**Time:** 45s

---

#### Slide 26 — ★ RQ1 — Grading Accuracy (HIGHLIGHT)
**Visual:** Table 4.4 styled with the Claude Opus row highlighted in orange. Optional: small bar chart of Pearson r per model.
**On-slide:**
| Model | Pearson r | MAE /10 | Mean Bias |
|---|---|---|---|
| **Claude Opus 4.6** | **0.92** | **0.68** | **−0.28** |
| Claude Sonnet 4.6 | 0.89 | 0.78 | −0.42 |
| GPT-5.4 | 0.86 | 0.90 | −0.55 |
| Gemini 3.1 Pro | 0.85 | 0.95 | −0.52 |
| GPT-5.4 Mini | 0.79 | 1.25 | −0.80 |
| Gemini 3 Flash | 0.74 | 1.48 | −1.02 |

**Bottom callout:** Pearson 0.92 is a substantial improvement over Bouali et al.'s ICC = 0.76 with earlier-generation models. All models exhibit negative bias — systematic over-strictness vs. the human grader (consistent with Zhang et al. and Bouali et al.).

**Speaker (slow down — this is the headline):** "RQ1. Claude Opus 4.6 leads with Pearson 0.92 and mean absolute error of 0.68 out of 10 — clearly the best-performing model overall. Sonnet and GPT-5.4 form a competitive second tier with Pearson 0.89 and 0.86. The baseline models — GPT-5.4 Mini and Gemini 3 Flash — show a clear accuracy drop. Two takeaways. First, Pearson 0.92 is a notable improvement over Bouali et al.'s 0.76 with an earlier Claude generation, which directly addresses the gap from Section 01. Second, every model shows negative mean bias — they grade more strictly than the human grader. That's consistent with prior work and suggests a systematic LLM tendency, not a quirk of one provider."
**Time:** 65s

---

#### Slide 27 — RQ2 — Cost-Performance Tradeoff
**Visual:** Scatter plot — x: cost/submission (log scale), y: Pearson r. Each model is a point. Pareto frontier highlighted. (If chart is hard, use Table 4.5 styled.)
**On-slide:**
- Range: **$0.003 (Gemini 3 Flash) → $0.032 (Claude Opus)** per submission — 10× span
- At 200-student cohort: total cost ranges from $0.60 → $6.40 — all models operationally affordable
- **Sonnet 4.6 ($0.018, r = 0.89)** is the strongest cost-quality balance — half Opus's cost, near-equal accuracy
- Within a single provider, the cost-accuracy gap is **remarkably tight** — institutions can choose by budget without sacrificing grading quality

**Speaker:** "RQ2. Even the most expensive model costs under four cents per submission, so for a typical course the entire grading bill is under seven dollars per assignment. The interesting finding is the cost-accuracy ratio within a provider — Sonnet trails Opus by 0.03 on Pearson r at roughly half the cost. Institutions can choose based on budget without meaningfully compromising grading quality."
**Time:** 40s

---

#### Slide 28 — RQ3 + RQ4 — Consistency & Structured Output
**Visual:** Two side-by-side mini-tables.
**On-slide (RQ3 — Inter-run consistency):**
| Model | Mean σ | Max σ |
|---|---|---|
| **Claude Opus 4.6** | **0.16** | **0.50** |
| Claude Sonnet 4.6 | 0.21 | 0.65 |
| Gemini 3 Flash | 0.48 | 1.60 |

**On-slide (RQ4 — Parse success):**
- **Claude Opus / Sonnet: 100% parse**
- All flagship models: ≥97.5%
- Gemini 3 Flash: 94.4% (truncated reasoning fields)

**Bottom callout:** Structured-output enforcement at API level — combined with temperature 0.0 — has resolved the format-compliance problem flagged by Piscitelli et al. (2025).

**Speaker:** "Two RQs in one slide because they tell a single story. Claude Opus is the most consistent across runs at standard deviation 0.16, well below the 1.5-point ceiling that would mean two students could receive grades a full letter apart on the same submission. On structured output, both Claude models hit 100% parse rate — the API-level structured-output enforcement, combined with temperature zero, has effectively solved the format-compliance problem that Piscitelli et al. flagged earlier this year."
**Time:** 45s

---

#### Slide 29 — Aggregate Ranking & Recommendation
**Visual:** Final ranking table (Table 4.9) with Opus + Sonnet highlighted.
**On-slide:**
| Rank | Model | Weighted Score | Recommendation |
|---|---|---|---|
| 1 | **Claude Opus 4.6** | 0.87 | Default for production deployment |
| 2 | Claude Sonnet 4.6 | 0.87 | Cost-effective alternative |
| 3 | GPT-5.4 | 0.84 | Fallback when Anthropic unavailable |
| 4 | Gemini 3.1 Pro | 0.83 | Not recommended |
| 5 | GPT-5.4 Mini | 0.80 | Not recommended |
| 6 | Gemini 3 Flash | 0.77 | Not recommended |

**Speaker:** "Apply the weighting formula and Opus and Sonnet tie at 0.87 — Opus leads by less than 0.01 at full precision, driven by its accuracy and consistency advantage. Opus is the production recommendation when grading quality is paramount; Sonnet is the cost-effective alternative at roughly half the per-submission cost. GPT-5.4 is a viable fallback if the Anthropic API is unavailable. The baseline models — Mini and Flash — would be acceptable for formative feedback but their variance is too high for summative grading."
**Time:** 35s

---

#### Slide 30 — Threats to Validity
**Visual:** 5 concise cards — clean, not crowded.
**On-slide:**
1. **Synthetic-heavy dataset** — only 2 of 32 submissions are real student work
2. **Single-grader ground truth** — most significant threat; no inter-rater reliability measured
3. **Class diagrams only** — sequence/activity/state not yet evaluated
4. **Conversion artefact** — McGill submissions required Umple → PlantUML conversion
5. **Model drift** — providers update models over time; results are a snapshot

**Bottom callout:** Future work prioritises real student data with multi-grader ground truth (see Section 05).

**Speaker:** "I want to be explicit about the limits of these results. The dataset is small and predominantly synthetic — thirty of thirty-two submissions were author-generated. Ground truth came from a single grader, which is the most significant threat to internal validity. We only evaluated class diagrams, not sequence or activity. The McGill data required Umple-to-PlantUML conversion which may affect comparability. And model behaviour drifts as providers update their checkpoints. These are real limits — and they're exactly what Section 05's future work prioritises."
**Time:** 50s

---

### SECTION 05 — CONCLUSION (slides 31–33, ~1.5 min)

#### Slide 31 — Section Divider: 05 Conclusion
**Visual:** Big "05" + "Conclusion" + horizon/arrow icon.
**Time:** 8s

---

#### Slide 32 — Summary & Future Work
**Visual:** Two-column slide.

**Left column — Delivered:**
- ✅ Full-stack platform with end-to-end assessment lifecycle [O1]
- ✅ Dual-modality LLM grading, 100% parse rate on Claude models [O2]
- ✅ Empirical: Claude Opus 4.6 wins (r=0.92), Sonnet best cost-quality [O4]
- 🔶 Two-panel grading UX [O3] — *exact time saving pending user study*
- 🔶 Containerised + k8s deployment [O5] — *load-test under realistic exam load pending*

**Right column — Future Work (4 cards in 2×2):**
1. **Beyond class diagrams** — Extend editor to sequence, activity, state, ER. Grading pipeline already diagram-type agnostic.
2. **Real-student benchmark** — Expand dataset with organic student work, multiple courses, multi-grader ground truth. Closes the Bouali et al. standardisation gap.
3. **Multi-grader validation** — 3+ independent graders, ICC metrics, recalibrate the −0.28 → −1.02 LLM bias estimates.
4. **Air-gapped deployment** — Ollama / vLLM for on-prem LLM serving; replace Supabase with self-hosted PostgreSQL StatefulSet.

**Speaker:** "Five objectives. Three were fully met — the platform, the AI grading pipeline with 100% parse rate on Claude, and the empirical evaluation. Two were substantially met with caveats: the grading UX was designed for time-saving but I haven't run a user study to quantify it, and the deployment was architecturally complete but I haven't load-tested it under realistic exam load. Future work in four directions — extend to other diagram types, build a real-student multi-grader benchmark to close the literature gap, validate with multiple human graders, and add air-gapped LLM serving for schools that can't permit outbound traffic."
**Time:** 60s

---

#### Slide 33 — Thank You / Q&A
**Visual:** Big "Thank You" centred + small "Q & A" subtitle. Same backdrop as title slide.
**On-slide:** *(no other text)*
**Speaker:** "Thank you. Happy to take questions."
**Stay on this slide** for the entire Q&A.
**Time:** 10s + Q&A duration

---

## Part 4 — Pre-flight Checklist

Run through this before recording / submitting:

- [ ] Page numbers on every slide (bottom-right, small, light grey)
- [ ] `CCDS25-0233` on slide 1 + subtle on every content slide footer
- [ ] Slide 1 has full names: Wang Yu Teng (U2122796L), Dr. Loke Yuan Ren, Prof. Zhang Hanwang
- [ ] Deck saved as `.pptx` AND exported as `.pdf` (PDF is projector fallback)
- [ ] Demo video edited with annotations (~3 min, openscreen export)
- [ ] Demo video embedded *in the deck*, not a separate file
- [ ] Demo tested on the actual presentation laptop (codec/playback)
- [ ] All screenshots crisp at projection resolution — no JPEG artifacts
- [ ] Architecture diagram + ER diagram readable from the back row (re-export at 2× if needed)
- [ ] No dead/unfinished slides (Tjandy left a black one — don't be that)
- [ ] **Rehearse twice**: once for timing (target ≤ 21 min), once recorded for self-review
- [ ] Backup: USB stick + cloud link for the deck

---

## Part 5 — Q&A Preparation

Anticipated questions, ranked by likelihood. Have a one-paragraph answer ready for each.

**Methodology / experiment:**
- *"The dataset is mostly synthetic — how does that affect external validity?"* → Acknowledge openly; reference the 5-tier quality stratification + 3-domain coverage as partial mitigation; commit to multi-grader real-student work in future.
- *"Single grader for ground truth — how do you know your rubric interpretation is the canonical one?"* → Yes, this is the most significant internal-validity threat per §4.4. Mitigation: rubric was deliberately structured into five orthogonal criteria (class / relationship / cardinality / naming / completeness) with 2 points each, designed to minimise interpretive ambiguity.
- *"Why no open-source models like Llama?"* → Deliberate exclusion. Target deployment is on-prem schools without GPU infrastructure for a 70B+ model. API costs at ~$0.005-0.032/submission are operationally trivial at school scale. Future work covers this with Ollama/vLLM.
- *"All models showed negative mean bias — could that be a single-grader artifact?"* → Could partially be. Both Bouali et al. and Zhang et al. report similar negative bias, suggesting it's a systematic LLM tendency. Multi-grader validation would isolate which.

**Architecture / engineering:**
- *"Why monolith over microservices?"* → Single developer, school-scale deployment, simpler ops. Modular route files give modularity benefits without distributed-systems overhead. Trade-off: harder to scale services independently — acceptable here.
- *"Concurrency = 1 for the worker — won't that bottleneck?"* → At target scale (50–100 students × 5 questions × ~5s/question), full batch completes in 25 minutes worst case — acceptable for asynchronous grading. Trade-off is throughput for predictability and rate-limit avoidance.
- *"Supabase is a vendor dependency — is that a problem for on-prem?"* → Soft dependency. Custom JWT path works without Supabase; manual grading works without LLM keys. Future work removes Supabase via self-hosted PG StatefulSet for fully air-gapped deployments.

**LLM grading correctness:**
- *"What stops the LLM from hallucinating a perfect score?"* → Three layers: (1) Zod schema validation rejects malformed output, (2) score clamping bounds output to `[0, maxPoints]`, (3) human-in-the-loop — staff must explicitly accept every suggestion. AI never writes to gradebook directly.
- *"How is the rubric expressed in the prompt?"* → Each rubric criterion with point allocation goes into the prompt text. The model evaluates each independently and returns per-criterion scores with reasoning, so the response can be audited.

**Use of AI assistance during development:**
- *"Did you use AI tools to write the code?"* → AI was used as a coding assistant. All design decisions — the dual-modality strategy, the schema decomposition, the experiment methodology, the empirical analysis — are my own.

---

## Part 6 — Reference Decks

Source PDFs at `/tmp/fyp-slides-research/` on this machine. Originals:

- **Lee Juin (2024, web app — primary template):** [slides PDF](https://www.dropbox.com/scl/fi/569j27ppzo7paquzq9zjm/2024_SCSE23-0810_Lee_Juin_SlideDeck.pdf?rlkey=yuftkw1df6zvg5m4wdok2xxfx&dl=1) · [video](https://youtu.be/9MRV12ZFUm4)
- Tjandy Putra (2023, infra — sparser style): [slides PDF](https://www.dropbox.com/scl/fi/2065jqymccauatf679pb5/2023_SCSE22-0652_FYP_Tjandy_Slides.pdf?rlkey=5tx9kkb4oglm3wrfg03ibxhqg&dl=1)
- Christopher Yong (2023, web platform): [slides PPTX](https://www.dropbox.com/s/7ecanlwk61cdrl3/ChrisYong_May2023_FYP_Presentation_Slides.pptx?dl=1)
- Marcus Yeo (2025, dev project): [slides PPTX](https://www.dropbox.com/scl/fi/dppso9ygcj3fmoxqo02h1/2025_UG_FYP_MacusYeoOral-Presentation-Slides-Final.pptx?rlkey=bwbetkmuilde68hs8l35oj9et&dl=1)

Submitted FYP report: [Wang_Yu_Teng_FYP_Report_CCDS25-0233.pdf](../../fyp-report/Wang_Yu_Teng_FYP_Report_CCDS25-0233.pdf)
