# Q-SQOOL SIH demonstration audit

Project: **Q-SQOOL** · Team **ALL STAR** · **SIH26140** · Smart Education · Software.
Supplied title: **AI-Based Interactive Quantum Algorithm Learning Platform**.

This is a simulator-based learning application. No quantum hardware execution is implemented.

## Scope and evidence

The inspected checkout is Next.js 16 / React 19 / TypeScript with FastAPI, SQLModel,
Qiskit 2.5.2 and Qiskit Aer 0.17.2. At the start of implementation the checkout was
clean on `main` at `5e70e7d`; the user's Google-auth work had been committed and
merged outside this audit. It was preserved. No repository AGENTS.md or Sites
hosting configuration was found. No deployment, framework migration or
production database write was performed.

Browser runtime discovery returned **No browser is available**. Desktop/mobile
click-through, screenshots, popup interaction and hydrated visual QA remain
unverified. Source inspection, regression tests, production compilation and HTTP
checks are identified separately below. These are not claims of browser E2E passes.

An authoritative official SIH problem-statement record was not retrieved. Search
results were third-party mirrors. The matrix below uses the supplied requirements;
formal compliance against the official wording is **unverified**.

## Confirmed defects and fixes

| Area | Root cause | Implemented correction |
| --- | --- | --- |
| Progress | Dashboard streak/mastery placeholders; Learn hardcoded 12-day streak and unearned badges | One summary calculation shared by Home, Learn and Profile. New users have zero earned activity. Loading values are not presented as earned zeros. Badges depend on completions. |
| Backend progress | Only module snapshots existed; no activity-day history | Additive `learningactivity` table; `GET /api/progress/summary` returns persisted modules, XP, last lesson and activity dates. Both write paths record a UTC day only when progress advances. Repeated refresh/completion does not create new activity or XP. |
| Cross-device resume/retry | Clean local resume path always beat the remote path; retry did nothing if initial user lookup failed | Server path wins over a clean cache; unsaved local edits retain their destination. Retry can initialize the session again. Failed identity/summary reads cannot proceed to a write using previously verified state. |
| Recent projects | Literal example names and relative timestamps | Fetch account-owned/shared cloud projects and account-scoped local records. Show actual timestamps, storage source, empty/loading/error states; reopen the selected circuit. |
| Suggestions | Hardcoded Phase Estimation/Order Finding; role recommendations bypassed prerequisites | Shared real curriculum data; incomplete eligible modules ranked by saved progress, role and assessment. New learners start with Qubits. Counts derive from the catalog. |
| Landing/navigation | Build CTA led to dashboard; shortcut buttons promised nonexistent backend activation | Final build CTA opens Composer. Dashboard guidance and code-import shortcuts open implemented workspaces; settings opens Profile. Unknown lesson IDs show an honest not-found state. |
| Depth | Highest timeline column was labelled depth | Logical dependency layers shared by UI and optimizer. H then CX is depth 2 even with blank columns. Explicit measurements count as one layer; disjoint gates may run in one layer. No barriers are supported. Automatic backend readout is excluded from displayed input-circuit depth. |
| Composer | Missing visible inspector despite selection state; global shortcuts intercepted text inputs | Inspector supports control/target, timeline movement, radian rotation input, duplication and removal without dragging. Invalid changes show errors. Text inputs retain native editing shortcuts. Qubit removal drops operations referencing the removed wire. |
| Editor persistence | Shared circuit cache leaked between account scopes; Code Lab could initialize before cache hydration | Per-account editor cache with legacy guest-only migration; validate stored circuits; save synchronously before route changes; mount editor after hydration. |
| Code import | Unanchored regexes and partial parsing silently discarded unsupported operations | Bounded full-line grammar; unsupported/incomplete statements, remapped measurements, out-of-range inputs and expressions fail without replacing the last valid circuit. No uploaded Python execution. |
| Code export | Angles rounded to three decimals; order tie-break differed from backend; repeated Cirq measurements reused implicit keys | Preserve numeric precision; consistent `(column, id)` ordering; unique explicit Cirq measurement keys. |
| Optimization | Used storage-array order instead of execution order; repacked even unchanged circuits | Validate inputs; sort by simulator order; cancel only supported self-inverse pairs without intervening operations on their wires. Only compact when cancellations occur. Show before/after depth and gate counts. |
| Q-AI | Repeated-measurement advice ignored intervening gates; any H/CX pair could trigger a Bell-output claim; missing-measurement warning contradicted automatic readout | Deterministic guidance validates current inputs and ordered operations; redundant readout requires no intervening operation on that wire; Bell description limited to the initial preparing pair with later-operation caveat; automatic readout explained. Explicitly labelled rule-based, no AI provider. |
| Execution | Internal `initial` state exposed; empty identity circuits rejected; no validation of successful response counts | Meaningful labels, identity circuit execution, bounded input sizes and result-count validation. Circuit changes remount execution state; cancellation/late responses cannot be accepted after abort. No fallback results. |
| Visualizers | Old result-workspace code included fabricated phase/state/density branches | Removed that implementation. Results table/histogram displays only backend counts and sampled frequencies. Existing tested ideal amplitude/phase/Bloch trajectory playback remains separately labelled. |
| Algorithm examples | Grover circuit lacked full diffusion; teleportation/QFT/hybrid samples implied complete algorithms | Complete the two-qubit Grover iteration. Label teleportation (no conditional corrections), QFT (no controlled-phase gates), and hybrid (no optimizer loop) as partial concept starters. Challenges are ungraded practice, with no invented XP. |
| Authentication | Password login issued a token for disabled users even though protected endpoints denied it | Reject disabled users at password sign-in. Existing Google verification/linking and record ownership tests retained. |

## Progress rules

- The curriculum contains 11 modules, defined in `lib/curriculum.ts` with stable
  reward IDs in `lib/learning-catalog.json`. Each completed module earns 100 XP
  once. Server totals come from completion records, not submitted XP/count totals.
- The lesson UI requires all three checkpoints and the correct knowledge-check
  answer before completion. Checkpoints contribute up to 70%; explicit completion
  sets 100%. This is learning self-assessment, not tamper-proof exam grading.
- Mastery is completed modules / catalog module count, rounded to a percentage.
- Streaks use UTC calendar days consistently. A streak remains current when the
  latest activity was yesterday, until today has elapsed. The seven-day indicator
  contains real recorded activity only.
- Authenticated activity is dated when the backend accepts a genuine advance.
  Offline work synced later counts on the acceptance day, not a client-supplied
  historical date. Previously unrecorded streak history is not fabricated.
- Guest activity stays on that device in the guest namespace. Signing in never
  silently adopts guest XP, projects or circuits into an account. Cached account
  progress is retained offline with an explicit unsynced state.

## Feature matrix for slides

| Requirement | Status | Evidence / accurate presentation claim |
| --- | --- | --- |
| Structured curriculum | Implemented | 11 modules, checkpoints, quizzes, stable progress/rewards; some algorithm circuit starters are partial. |
| Visual circuit builder | Implemented | 1–5 qubits; 12 operation types; select/place/drag/edit/remove; undo/redo; touch inspector. Browser gestures unverified here. |
| Code editor and synchronization | Partial | Qiskit, Cirq and OpenQASM 3 bounded syntax import/export; round trips tested. Not arbitrary Python or full SDK parsing. |
| Simulator execution | Partial | Real Qiskit Aer execution and shots, including empty/X/H/Bell/cancellation tests. One execution backend. Noise models and additional backends are unavailable. |
| Visualizers | Implemented within ideal model | Sampled counts/frequencies; ideal complex amplitudes and phase; reduced-state Bloch vectors and single-shot measurement trajectories. General noisy mixed-state simulation and density-matrix UI are not implemented. |
| Real-time explanations | Partial | Immediate rule-based current-circuit guidance. No connected generative AI tutor. |
| Error detection | Partial | Deterministic gate/parameter/index/size and selected measurement checks. Not proof of algorithm correctness. |
| Optimization suggestions | Implemented, bounded | Rule-based safe pair cancellation with explicit Preview/Apply. Full unitary-operator regression checks up to global phase; no general hardware/noise optimization. |
| Personalised learning | Partial | Progress/prerequisite/role/assessment rules. No model-driven adaptation or instructor dashboard. |
| Collaboration / modular use | Partial | Saved cloud circuits with owner/edit/view permissions, invitations to existing accounts, revoke/delete, independent local forks. Refresh to see updates; no simultaneous co-editing, comments or email delivery. |
| Authentication | Implemented locally | Email/password, profile, token expiry and isolated records. Google code present, but production provider disabled until a client ID is configured. |
| Challenges | Partial | Practice starter circuits; no automatic grading or leaderboard. |

Do not describe Qiskit/Cirq/OpenQASM formats as three execution backends. Do not
claim an LLM, real quantum hardware, noise simulation, full teleportation/QFT/VQE,
simultaneous editing, hardware fidelity, or benchmarked performance.

## Validation results

- `npm test`: **39 passed** (includes nine new SIH regressions).
- `PYTHONPATH=.:backend backend/.venv/bin/python -m pytest backend/tests -q`:
  **78 passed**. After the final zero-score activity normalization change, the
  focused SIH suite was rerun: **14 passed**.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed, no warnings/errors at the completed check.
- `npm run build`: passed, all routes compiled; Next.js emitted existing Node
  module-registration deprecation notices. Backend tests report two existing
  Starlette/httpx deprecation warnings.
- Optimizer checks compare full `qiskit.quantum_info.Operator` matrices up to global
  phase for 35 seeded shuffled circuits, not just evolution from the zero state.
  Measurement boundaries are tested separately; no noisy equivalence is claimed.
- Fixed generated Python fixture: Qiskit and Cirq pass `ast.parse`; generated
  Qiskit executes and its operator matches the source circuit. Cirq runtime and a
  standalone OpenQASM runtime were not installed/tested; round-trip grammar tests
  pass for both. Only this trusted test fixture was executed.
- Local FastAPI TestClient invokes actual Aer and checks empty/X/Bell HTTP contracts,
  normalization, invalid requests, account isolation and CRUD. Existing tests also
  cover H, cancelling gates, progress retry/account switches and collaboration roles.
- Public homepage: HTTP 200. Public backend `/health`: online, `qiskit_aer`.
- Public Bell request, 128 shots: HTTP 200, `00: 59`, `11: 69`, total 128. CORS
  response allowed `https://q-sqool.netlify.app`. This exercised the deployed
  simulator independently of a browser, not the un-deployed local changes.
- Production `/api/auth/google/config`: `enabled: false`.
- Production `/api/progress/summary`: HTTP 404 (new local route is not deployed).
- No browser available: mobile/desktop rendering, drag, keyboard focus, Google popup,
  and combined browser journeys remain manual verification items.

## Configuration / remaining work

1. **Deploy only after authorization.** The new frontend requires the new backend
   progress-summary route. Deploy/restart the backend first (or coordinate both).
   SQLModel startup creates the activity table without clearing prior data. SQLite
   tests pass; a real PostgreSQL migration/deployment has not been exercised here.
2. Set `NEXT_PUBLIC_API_URL` to the intended backend. Local default is
   `http://127.0.0.1:8000`; production fallback is `https://q-sqool-api.onrender.com`.
   Backend CORS currently allows the Netlify site and localhost/127.0.0.1:3000.
3. Set a real production `JWT_SECRET_KEY`, database URL and environment. No secret
   values were printed or added to frontend code during this audit.
4. Google: configure an OAuth Web client and approved origins; set backend
   `GOOGLE_CLIENT_ID`, restart, then perform a real popup test. No client secret or
   Gmail access is needed. See the existing README setup instructions.
5. General AI tutoring, more simulators/noise, full unsupported algorithm primitives,
   real-time co-editing and automated challenge grading remain separate work.
6. Run the six browser journeys below on desktop and mobile once browser access is
   available. Honest API success is not a substitute for that visual walkthrough.

## Short demonstration sequence

This sequence uses implemented, API/math-tested capabilities; perform a browser
rehearsal before presenting because browser interaction was unavailable in this audit.

1. Landing → Learn → Qubits. Show the concepts/checkpoints and complete its quiz.
   Home/Learn/Profile should reflect 100 XP and one completed module after sync.
2. Landing final build CTA → Composer. Clear, use two qubits, place H on q0 then CX
   q0→q1. Show depth 2. Run 1024 shots and explain sampled 00/11 frequencies.
3. Open Code Lab. Edit a numeric rotation or gate, then return to Composer. Show an
   unsupported statement produces an error and retains the previous circuit.
4. Add a cancelling X-X pair. Preview/Apply rule-based optimization; show gate count
   and depth changes. Use Explain and explicitly call it deterministic guidance.
5. Save to Projects, reopen, rename, and delete a disposable test project. For cloud
   collaboration, use two pre-created accounts and demonstrate view/edit permissions.
6. Revisit Home. Show real recent-project timestamps and progress-based eligible
   recommendations. Explain that Google and advanced AI features need configuration
   or future implementation rather than presenting simulated success.

## Changed-file map

- `app/page.tsx`: bounded composer editing, accurate execution states, parser wiring,
  circuit persistence/handoff, curriculum usage, guidance and honest practice labels.
- `components/progress/Dashboard.tsx`, `ProgressProvider.tsx`: actual account data,
  recommendations and working initialization retry.
- `components/profile/ProfilePage.tsx`, `components/landing/LandingPage.tsx`:
  consistent progress, curriculum counts and build destination.
- `components/quantum-playback/ExecutionResults.tsx`: sampled results only.
- `lib/curriculum.ts`, `learning-summary.ts`, `progress-{types,storage,sync}.ts`:
  shared content, metrics, activity dates and synchronization rules.
- `lib/circuit.ts`, `circuit-code.ts`, `circuit-guidance.ts`, `project-storage.ts`:
  bounded validation, depth, strict code subset and accurate deterministic guidance.
- `lib/api.ts`, `lib/auth-api.ts`: validated simulation responses and progress snapshot.
- `backend/app/{db_models,main,models,simulator,optimizer}.py` and
  `backend/app/routers/{progress,projects,authentication}.py`: persistent activity,
  shared validation, correct optimization ordering and inactive-account rejection.
- `tests/sih-regressions.test.mjs`, `tests/progress.test.mjs`,
  `backend/tests/test_sih_audit.py`: regression coverage.
