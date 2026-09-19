"""Verify Google credentials before they can become Q-SQOOL sessions."""
import os
import secrets

from fastapi import HTTPException
from google.auth.exceptions import GoogleAuthError, TransportError
from google.auth.transport.requests import Request
from google.oauth2 import id_token
from pydantic import EmailStr, TypeAdapter, ValidationError


def google_client_id() -> str:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise HTTPException(503, "Google sign-in is not available yet. Please use email and password.")
    return client_id


class TimeoutRequest(Request):
    def __call__(self, *args, **kwargs):
        kwargs["timeout"] = 5
        return super().__call__(*args, **kwargs)


def verify_google_credential(credential: str, nonce: str) -> dict:
    client_id = google_client_id()
    try:
        # google-auth checks the signature, audience, expiration and issuer.
        claims = id_token.verify_oauth2_token(credential, TimeoutRequest(), client_id)
    except TransportError as exc:
        raise HTTPException(503, "Cannot reach Google to verify your account. Please retry.") from exc
    except (ValueError, GoogleAuthError) as exc:
        raise HTTPException(401, "Google sign-in could not be verified. Please try again.") from exc

    token_nonce = claims.get("nonce")
    if not isinstance(token_nonce, str) or not secrets.compare_digest(token_nonce.encode(), nonce.encode()):
        raise HTTPException(401, "Google sign-in expired or did not match this request. Please try again.")
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject or len(subject) > 255:
        raise HTTPException(401, "Google did not return a valid account identifier.")
    if claims.get("email_verified") is not True:
        raise HTTPException(401, "Please verify your email with Google before signing in.")
    try:
        claims["email"] = str(TypeAdapter(EmailStr).validate_python(claims.get("email"))).lower()
    except ValidationError as exc:
        raise HTTPException(401, "Google did not return a valid email address.") from exc
    return claims
