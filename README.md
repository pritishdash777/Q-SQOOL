# Q-SQOOL

Learn Quantum. Build Circuits. Shape the Future.

Q-SQOOL is an interactive quantum-computing education platform featuring structured learning modules, a visual circuit composer, code-based circuit development, simulation visualisations and future AI-assisted guidance.

## Current prototype

- Animated landing page
- Personalised dashboard
- Structured learning hub
- Interactive lessons and quizzes
- Visual quantum circuit composer
- Qiskit and Cirq code workspace
- Responsive desktop and mobile design
- Backend integration placeholders


### Progress reliability and validation

Learning progress uses `q-sqool-progress:v1:<authenticated-user-id>`; guest progress
uses the `guest` suffix. Legacy `q-sqool-learning` data has no account owner and is
read only as guest progress. It is never automatically assigned to an account.
Offline account changes remain pending until the authenticated backend acknowledges
them. XP is derived from completed curriculum modules (100 XP each), not submitted
XP totals. The shared curriculum IDs/rewards are in `lib/learning-catalog.json`;
include this file when packaging the backend.

On the next backend startup, an additive migration adds the JSON
`learningprogress.completed_lessons` column if missing. Existing rows and completed
modules are preserved. No database reset is needed. SQLite migration is covered by
a regression test; the PostgreSQL DDL still needs verification in that environment.

Run frontend regressions with `npm test` (Node 22.15+), and production validation
with `npm run build`. With the backend requirements installed, run from the repo
root:

```sh
PYTHONPATH=.:backend python -m pytest backend/tests -q
```

Circuit requests time out after 20 seconds; account/progress requests after 10
seconds. Stopping a browser request discards its result; backend computation may
continue. Unavailable simulation/optimization endpoints display a retry action.
