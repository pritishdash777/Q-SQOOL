import hashlib
import time

import pytest
from fastapi import HTTPException
from google.auth.exceptions import TransportError
from sqlmodel import select

from app import google_auth
from app.auth import decode_access_token
from app.db_models import GoogleIdentity, GoogleLoginChallenge, Profile, User
from app.routers import google_authentication


@pytest.fixture
def google(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    claims = {"sub": "google-user-123", "email": "learner@gmail.com", "email_verified": True, "name": "Quantum Learner"}

    def verify(credential, nonce):
        assert credential == "google-credential"
        return {**claims, "nonce": nonce}

    monkeypatch.setattr(google_authentication, "verify_google_credential", verify)
    return claims


def credential(client):
    response = client.post("/api/auth/google/challenge")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["client_id"] == "test-client.apps.googleusercontent.com"
    return {"credential": "google-credential", "nonce": response.json()["nonce"]}


def test_unconfigured_google_keeps_password_auth_available(client, monkeypatch):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    assert client.get("/api/auth/google/config").json() == {"enabled": False}
    assert client.post("/api/auth/google/challenge").status_code == 503
    assert client.post("/api/auth/register", json={
        "email": "normal@example.com", "password": "password123", "full_name": "Normal User",
    }).status_code == 201


def test_google_signup_session_profile_and_returning_subject(client, session, google):
    assert client.get("/api/auth/google/config").json() == {"enabled": True}
    response = client.post("/api/auth/google", json=credential(client))
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    result = response.json()
    assert result["is_new_user"] is True
    user_id = result["user"]["id"]
    assert decode_access_token(result["access_token"])["sub"] == user_id
    headers = {"Authorization": f"Bearer {result['access_token']}"}
    assert client.get("/api/auth/me", headers=headers).json()["id"] == user_id
    assert client.get("/api/profile", headers=headers).json()["full_name"] == "Quantum Learner"
    assert session.get(GoogleIdentity, google["sub"]).user_id == user_id
    # Changed Google email/name must not create a duplicate or overwrite a local profile.
    google.update(email="changed@gmail.com", name="Changed Name")
    returning = client.post("/api/auth/google", json=credential(client)).json()
    assert returning["is_new_user"] is False
    assert returning["user"]["id"] == user_id
    assert len(session.exec(select(User)).all()) == 1
    assert session.exec(select(Profile)).one().full_name == "Quantum Learner"


def test_google_account_link_requires_password_and_preserves_projects(client, session, google):
    existing = client.post("/api/auth/register", json={
        "email": google["email"], "password": "original-password", "full_name": "Original Profile",
    }).json()
    headers = {"Authorization": f"Bearer {existing['access_token']}"}
    project_response = client.post("/api/projects", headers=headers, json={
        "name": "Saved circuit", "circuit_json": {"qubits": 2, "gates": []},
    })
    assert project_response.status_code == 201
    project = project_response.json()
    body = credential(client)
    assert client.post("/api/auth/google", json=body).status_code == 409
    assert session.get(GoogleIdentity, google["sub"]) is None
    assert client.post("/api/auth/google", json={**body, "password": "wrong"}).status_code == 403
    response = client.post("/api/auth/google", json={**body, "password": "original-password"})
    assert response.status_code == 200
    assert response.json()["is_new_user"] is False
    assert response.json()["user"]["id"] == existing["user"]["id"]
    linked_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/api/projects", headers=linked_headers).json()[0]["id"] == project["id"]
    assert client.get("/api/profile", headers=linked_headers).json()["full_name"] == "Original Profile"
    assert client.post("/api/auth/login", json={"email": google["email"], "password": "original-password"}).status_code == 200
    assert client.post("/api/auth/google", json=credential(client)).status_code == 200


def test_google_challenges_expire_and_cannot_be_replayed(client, session, google):
    body = credential(client)
    assert client.post("/api/auth/google", json=body).status_code == 200
    assert client.post("/api/auth/google", json=body).status_code == 401
    body = credential(client)
    pending = session.get(GoogleLoginChallenge, hashlib.sha256(body["nonce"].encode()).hexdigest())
    pending.expires_at = int(time.time()) - 1
    session.add(pending)
    session.commit()
    assert client.post("/api/auth/google", json=body).status_code == 401
    assert client.post("/api/auth/google", json={**body, "nonce": "x" * 43}).status_code == 401
    assert len(session.exec(select(User)).all()) == 1


def test_link_attempt_limit(client, google):
    client.post("/api/auth/register", json={
        "email": google["email"], "password": "original-password", "full_name": "Original Profile",
    })
    body = credential(client)
    for _ in range(5):
        assert client.post("/api/auth/google", json={**body, "password": "wrong"}).status_code == 403
    assert client.post("/api/auth/google", json={**body, "password": "original-password"}).status_code == 401


def test_disabled_or_differently_linked_accounts_cannot_sign_in(client, session, google):
    first = client.post("/api/auth/google", json=credential(client)).json()
    original_subject = google["sub"]
    google["sub"] = "other-google-user"
    assert client.post("/api/auth/google", json=credential(client)).status_code == 400
    assert session.get(GoogleIdentity, "other-google-user") is None
    google["sub"] = original_subject
    user = session.get(User, first["user"]["id"])
    user.is_active = False
    session.add(user)
    session.commit()
    assert client.post("/api/auth/google", json=credential(client)).status_code == 403


@pytest.mark.parametrize("patch", [
    {"nonce": "wrong"}, {"nonce": None}, {"email_verified": False}, {"email_verified": "true"},
    {"email": "not-an-email"}, {"sub": ""}, {"sub": None},
])
def test_verifier_rejects_invalid_claims(monkeypatch, patch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")
    claims = {"sub": "123", "email": "test@gmail.com", "email_verified": True, "nonce": "expected", **patch}
    monkeypatch.setattr(google_auth.id_token, "verify_oauth2_token", lambda *_: claims)
    with pytest.raises(HTTPException) as error:
        google_auth.verify_google_credential("token", "expected")
    assert error.value.status_code == 401


@pytest.mark.parametrize("failure,status", [(ValueError("invalid signature/audience/expiry"), 401), (TransportError("offline"), 503)])
def test_verifier_rejects_invalid_token_and_network_errors(monkeypatch, failure, status):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")

    def verify(*_):
        raise failure

    monkeypatch.setattr(google_auth.id_token, "verify_oauth2_token", verify)
    with pytest.raises(HTTPException) as error:
        google_auth.verify_google_credential("token", "nonce")
    assert error.value.status_code == status


def test_verifier_uses_configured_audience_and_normalizes_email(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "expected-client-id")

    def verify(token, transport, audience):
        assert token == "signed-token"
        assert audience == "expected-client-id"
        assert isinstance(transport, google_auth.TimeoutRequest)
        return {"sub": "123", "email": "LEARNER@GMAIL.COM", "email_verified": True, "nonce": "expected"}

    monkeypatch.setattr(google_auth.id_token, "verify_oauth2_token", verify)
    assert google_auth.verify_google_credential("signed-token", "expected")["email"] == "learner@gmail.com"


@pytest.mark.parametrize("change", [{}, {"aud": "wrong-client"}, {"iss": "https://attacker.example"}, {"exp": 1}, {"nonce": "wrong"}, {"signature": "wrong"}])
def test_real_google_verifier_with_signed_tokens(monkeypatch, change):
    import json
    import jwt
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")

    class CertificateResponse:
        status = 200
        data = json.dumps({"test-key": public.decode()}).encode()

    # Replace only Google's certificate HTTP fetch; signature and claims checks are real.
    monkeypatch.setattr(google_auth, "TimeoutRequest", lambda: lambda *args, **kwargs: CertificateResponse())
    claims = {
        "sub": "google-123", "email": "signed@gmail.com", "email_verified": True,
        "iss": "https://accounts.google.com", "aud": "client-id", "nonce": "expected",
        "iat": int(time.time()) - 10, "exp": int(time.time()) + 600,
        **{name: value for name, value in change.items() if name != "signature"},
    }
    signing_key = rsa.generate_private_key(public_exponent=65537, key_size=2048) if "signature" in change else key
    token = jwt.encode(claims, signing_key, algorithm="RS256", headers={"kid": "test-key"})
    if change:
        with pytest.raises(HTTPException) as failure:
            google_auth.verify_google_credential(token, "expected")
        assert failure.value.status_code == 401
    else:
        assert google_auth.verify_google_credential(token, "expected")["sub"] == "google-123"
