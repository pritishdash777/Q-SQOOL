# Q-SQOOL API

FastAPI provides authentication, profiles, learning progress, saved projects,
collaboration, Qiskit Aer/Cirq/PennyLane simulation and circuit optimization.

Run commands from the **repository root**, so the default SQLite path is consistent.
Python 3.11+ is recommended.

```sh
python3.11 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --env-file backend/.env --reload --port 8000
```

Set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` in the frontend `.env.local`.
The default allowed browser origins are `http://localhost:3000`,
`http://127.0.0.1:3000`, and `https://q-sqool.netlify.app`.
API documentation is available at `http://127.0.0.1:8000/docs`.

Production requires `APP_ENV=production` and a strong `JWT_SECRET_KEY`.
Set `DATABASE_URL` for PostgreSQL or SQLite. Tables are created on startup;
existing learning progress receives an additive migration. The collaboration
table is also created without resetting existing data. Package
`lib/learning-catalog.json` with the backend.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Service status |
| `POST /api/auth/register`, `/api/auth/login` | Create a session |
| `GET /api/auth/me` | Current user |
| `GET`, `PATCH /api/profile` | Profile |
| `GET`, `PUT /api/progress` | Learning progress |
| `POST /api/simulate`, `/api/optimize` | Circuit execution and optimization |
| `GET`, `POST /api/projects` | List owned/shared projects or create one |
| `GET`, `PATCH`, `DELETE /api/projects/{id}` | Read, edit, or delete a project |
| `GET`, `POST /api/projects/{id}/collaborators` | Owner lists/adds collaborators |
| `DELETE /api/projects/{id}/collaborators/{collaborator_id}` | Owner revokes access |

Protected endpoints require `Authorization: Bearer <access_token>`.
Project responses include `permission`: `owner`, `edit`, or `view`. Only owners
can delete projects or manage collaborators. Invitations grant access immediately
to an existing account; no email is sent. Deleting a project removes its
collaborator records in the same transaction. Updates reject explicit nulls.

```sh
PYTHONPATH=.:backend backend/.venv/bin/python -m pytest backend/tests -q
backend/.venv/bin/python backend/check_db.py
```

Tests use isolated in-memory SQLite databases. Collaboration deletion tests enable
foreign-key constraints. PostgreSQL deployment still needs validation against a
real PostgreSQL instance.

## Google authentication

Optional Google sign-in is configured with `GOOGLE_CLIENT_ID` in the backend
environment. See the [Google Cloud setup instructions](../README.md#enable-google-sign-in).
Install `backend/requirements.txt` and restart the backend to create the additive
identity/challenge tables. No existing user data needs to be reset.

- `GET /api/auth/google/config`: whether the provider is configured.
- `POST /api/auth/google/challenge`: public client ID and a five-minute nonce.
- `POST /api/auth/google`: verified Google credential, nonce, and optional existing
  Q-SQOOL password for linking; returns the normal session plus `is_new_user`.

Google login never accepts an email/profile supplied by the browser as identity.
An existing email requires password confirmation before linking. No Gmail scopes,
Google refresh tokens, client secrets, or OAuth redirect routes are used.

## SDK execution

`POST /api/simulate` accepts `simulator: "qiskit_aer" | "cirq" | "pennylane"`.
Each selection runs its native simulator; there is no fallback to another SDK.
Redeploy the Python service with the updated `backend/requirements.txt` when
adding these backends (a frontend-only Netlify deploy does not install Python SDKs).
All engines support 1–5 qubits, up to 256 operations, and 1–4096 shots.
Counts use c[n-1]…c[0]. M writes q[i] into c[i]; the last measurement on each
wire wins, unmeasured classical bits remain zero, and circuits without M
receive terminal measurement on every wire. The playback's intermediate states
remain explicitly labelled local ideal calculations.

The Composer live AI coach uses the existing server-side Groq configuration.
Live mode is opt-in, debounced, limited to one automatic request per 12 seconds
and ten updates per activation. It sends circuit JSON, current sampled counts,
response style and actual completed module IDs. Validated proposals require
Apply, use Composer undo, and are never presented as executed results.
