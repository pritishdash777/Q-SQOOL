# Q-SQOOL

Learn Quantum. Build Circuits. Shape the Future.

Q-SQOOL is an interactive quantum-computing education platform featuring structured learning modules, a visual circuit composer, code-based circuit development, simulation visualisations and future AI-assisted guidance.

## Features

- Animated landing page
- Personalised dashboard
- Structured learning hub
- Interactive lessons and quizzes
- Visual quantum circuit composer
- Qiskit and Cirq code workspace
- Responsive desktop and mobile design
- FastAPI authentication, profiles, and account-scoped learning progress
- Cloud projects, shared view/edit access, and collaborator management
- Guest/offline local projects, JSON import, SDK export, and independent forks


## Run locally

Use Node 22.15+ and Python 3.11+. From the repository root:

```sh
npm ci
cp .env.example .env.local
python3.11 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Start each service in its own terminal:

```sh
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --env-file backend/.env --reload --port 8000
```

```sh
npm run dev
```

Open `http://localhost:3000`. See [backend setup and API details](backend/Readme.md).
Existing `.env.local` and `backend/.env` files should be kept rather than overwritten.

## Projects and collaboration

Signed-in users save to the cloud and see projects they own or that another user
has shared with them. Owners invite existing accounts with view or edit access,
revoke collaborators, and delete projects. Changes appear for collaborators when
they refresh projects; concurrent cloud edits use the last successful save.

Guests and offline users save on the device. Local drafts use
`q-sqool-projects:v2:<user-id>` (or `guest`) and can be uploaded after sign-in.
Legacy local drafts remain guest-only; legacy cloud-linked records are replaced
by authenticated server results. To move a guest draft to an account, export JSON
as a guest, sign in, then import and upload it. The original legacy storage is
retained. Duplicate and Fork create independent local copies.

Local projects retain up to 10 versions on the device. Cloud projects store the
latest circuit, with recent version previews available during the current session.
Live co-editing, comments, and email invitations are not implemented.

## Validation

```sh
npm test
npm run lint
npm run build
PYTHONPATH=.:backend backend/.venv/bin/python -m pytest backend/tests -q
```


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
PYTHONPATH=.:backend backend/.venv/bin/python -m pytest backend/tests -q
```

Circuit requests time out after 20 seconds; account/progress requests after 10
seconds. Stopping a browser request discards its result; backend computation may
continue. Unavailable simulation/optimization endpoints display a retry action.
