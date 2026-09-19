import hashlib
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..auth import create_access_token, get_password_hash, verify_password
from ..database import get_session
from ..db_models import GoogleIdentity, GoogleLoginChallenge, Profile, User
from ..google_auth import google_client_id, verify_google_credential
from ..schemas import GoogleChallengeResponse, GoogleLoginRequest, GoogleTokenResponse, UserSummary

router = APIRouter(prefix="/api/auth/google", tags=["auth"])
CHALLENGE_SECONDS = 300


@router.get("/config")
def config(response: Response):
    response.headers["Cache-Control"] = "no-store"
    try:
        google_client_id()
        return {"enabled": True}
    except HTTPException:
        return {"enabled": False}


@router.post("/challenge", response_model=GoogleChallengeResponse)
def challenge(response: Response, session: Session = Depends(get_session)):
    client_id = google_client_id()
    nonce = secrets.token_urlsafe(32)
    now = int(time.time())
    session.exec(delete(GoogleLoginChallenge).where(GoogleLoginChallenge.expires_at <= now))
    session.add(GoogleLoginChallenge(
        nonce_hash=hashlib.sha256(nonce.encode()).hexdigest(), expires_at=now + CHALLENGE_SECONDS,
    ))
    session.commit()
    response.headers["Cache-Control"] = "no-store"
    return GoogleChallengeResponse(client_id=client_id, nonce=nonce, expires_in=CHALLENGE_SECONDS)


@router.post("", response_model=GoogleTokenResponse)
def login(request: GoogleLoginRequest, response: Response, session: Session = Depends(get_session)):
    google_client_id()
    nonce_hash = hashlib.sha256(request.nonce.encode()).hexdigest()
    pending = session.get(GoogleLoginChallenge, nonce_hash)
    if not pending or pending.expires_at <= int(time.time()) or pending.failed_attempts >= 5:
        raise HTTPException(401, "Google sign-in expired. Please start again.")
    claims = verify_google_credential(request.credential, request.nonce)
    identity = session.get(GoogleIdentity, claims["sub"])
    user = session.get(User, identity.user_id) if identity else session.exec(
        select(User).where(User.email == claims["email"])
    ).first()
    if identity and not user:
        raise HTTPException(401, "This Google account is no longer linked to an active account.")
    if user and not user.is_active:
        raise HTTPException(403, "This account is disabled.")
    if user and not identity:
        if session.exec(select(GoogleIdentity).where(GoogleIdentity.user_id == user.id)).first():
            raise HTTPException(400, "This account is linked to a different Google account. Use your original sign-in method.")
        # Email equality alone is not permission to take over an existing account.
        if request.password is None:
            raise HTTPException(409, "Confirm your Q-SQOOL password once to link this Google account.")
        if not verify_password(request.password, user.hashed_password):
            session.exec(update(GoogleLoginChallenge).where(
                GoogleLoginChallenge.nonce_hash == nonce_hash,
            ).values(failed_attempts=GoogleLoginChallenge.failed_attempts + 1))
            session.commit()
            raise HTTPException(403, "Incorrect Q-SQOOL password. Please try again.")

    # Atomically consume the challenge: parallel or repeated submissions cannot log in twice.
    consumed = session.exec(delete(GoogleLoginChallenge).where(
        GoogleLoginChallenge.nonce_hash == nonce_hash,
        GoogleLoginChallenge.expires_at > int(time.time()),
        GoogleLoginChallenge.failed_attempts < 5,
    ))
    if consumed.rowcount != 1:
        session.rollback()
        raise HTTPException(401, "Google sign-in expired. Please start again.")
    is_new_user = user is None
    try:
        if user is None:
            # Existing databases require a password hash. No usable password is created.
            user = User(email=claims["email"], hashed_password=get_password_hash(secrets.token_urlsafe(48)))
            session.add(user)
            session.flush()
            name = str(claims.get("name") or "Quantum learner").strip()[:100] or "Quantum learner"
            session.add(Profile(user_id=user.id, full_name=name))
        if identity is None:
            session.add(GoogleIdentity(subject=claims["sub"], user_id=user.id))
        session.commit()
        session.refresh(user)
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(400, "Your account changed during sign-in. Please start Google sign-in again.") from exc
    response.headers["Cache-Control"] = "no-store"
    return GoogleTokenResponse(
        access_token=create_access_token(user.id),
        user=UserSummary(id=user.id, email=user.email, is_active=user.is_active),
        is_new_user=is_new_user,
    )
