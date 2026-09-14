from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from ..database import get_session
from ..db_models import User, Profile
from ..schemas import RegisterRequest, LoginRequest, TokenResponse, UserSummary, ProfileResponse
from ..auth import get_password_hash, verify_password, create_access_token
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, session: Session = Depends(get_session)):
    email_lower = request.email.lower()
    existing_user = session.exec(select(User).where(User.email == email_lower)).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
        
    hashed_password = get_password_hash(request.password)
    
    new_user = User(
        email=email_lower,
        hashed_password=hashed_password,
    )
    
    session.add(new_user)
    session.flush() # get new_user.id
    
    new_profile = Profile(
        user_id=new_user.id,
        full_name=request.full_name,
    )
    
    session.add(new_profile)
    session.commit()
    session.refresh(new_user)
    
    access_token = create_access_token(subject=new_user.id)
    
    return TokenResponse(
        access_token=access_token,
        user=UserSummary(
            id=new_user.id,
            email=new_user.email,
            is_active=new_user.is_active
        )
    )

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, session: Session = Depends(get_session)):
    email_lower = request.email.lower()
    user = session.exec(select(User).where(User.email == email_lower)).first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(subject=user.id)
    
    return TokenResponse(
        access_token=access_token,
        user=UserSummary(
            id=user.id,
            email=user.email,
            is_active=user.is_active
        )
    )

@router.get("/me", response_model=UserSummary)
def get_me(current_user: User = Depends(get_current_user)):
    return UserSummary(
        id=current_user.id,
        email=current_user.email,
        is_active=current_user.is_active
    )
