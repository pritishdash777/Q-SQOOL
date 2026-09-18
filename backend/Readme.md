# Q-SQOOL API

FastAPI provides authentication, profiles, learning progress, saved projects,
collaboration, Qiskit Aer simulation and circuit optimization.

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
