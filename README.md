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
- Google sign-in/sign-up with password-confirmed linking of existing accounts
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

## Enable Google sign-in

Google sign-in uses the Google Identity Services popup. It requests basic identity
information, not Gmail access. No Google client secret or redirect endpoint is used.

1. Create/select a project in [Google Cloud](https://console.cloud.google.com/auth/overview).
2. Configure Google Auth Platform branding and audience for Q-SQOOL; add your
   Google account as a test user if the app is in testing mode.
3. Create an OAuth client of type **Web application**. Add **Authorized JavaScript
   origins**: `http://localhost`, `http://localhost:3000`, and the deployed frontend
   origin (currently `https://q-sqool.netlify.app`). Use origins without paths.
4. Put the public client ID in `backend/.env`:
   `GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com`.
   Set the same variable in your backend hosting environment for production.
5. Install updated backend requirements and restart the backend. Reload `/login`.
   The frontend obtains the client ID from the backend, so no frontend client-ID
   variable or rebuild is needed when changing it.

See [Google's setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
New frontend domains must also be added to the backend CORS allowlist in
`backend/app/main.py`. Production sites must use HTTPS. Hosting proxies should
preserve the popup-compatible response headers configured for `/login`.

The Google control is available on both Sign In and Register. New users go to
profile setup; returning users go to their requested local destination. When the
email matches an existing password account, Q-SQOOL requires its password once
before linking. Later Google logins use Google's stable subject identifier,
preserving the user's projects, collaborations and learning progress. Password
sign-in continues to work for linked password accounts. Accounts created only
through Google do not have a usable Q-SQOOL password.

The backend verifies Google's signature, audience, issuer, expiry, verified email
and a single-use five-minute nonce, then issues the existing Q-SQOOL session.
Google tokens are not persisted. Startup creates two additive tables,
`googleidentity` and `googleloginchallenge`, without altering existing user rows.
With `GOOGLE_CLIENT_ID` unset, Google sign-in stays unavailable and password/guest
flows continue working.

After configuring a real client ID, check new Google registration, returning login,
password-confirmed linking, canceling the popup, and local destination redirects.
Automated tests cover backend token checks and account handling; they do not log
into a real Google account.

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
