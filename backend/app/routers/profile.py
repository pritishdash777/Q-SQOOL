from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from ..database import get_session
from ..db_models import User, Profile
from ..schemas import ProfileResponse, ProfileUpdate
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/profile", tags=["profile"])

@router.get("", response_model=ProfileResponse)
def get_profile(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    profile = session.exec(select(Profile).where(Profile.user_id == current_user.id)).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    return profile

@router.patch("", response_model=ProfileResponse)
def update_profile(
    profile_update: ProfileUpdate, 
    current_user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    profile = session.exec(select(Profile).where(Profile.user_id == current_user.id)).first()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    update_data = profile_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(profile, key, value)
        
    profile.updated_at = datetime.now(timezone.utc)
    
    session.add(profile)
    session.commit()
    session.refresh(profile)
    
    return profile
