from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from ..database import get_session
from ..db_models import User, LearningProgress, Profile
from ..schemas import ProgressResponse, ProgressUpdate, UserProgressSync
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])

@router.get("", response_model=List[ProgressResponse])
def get_progress(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    progress_records = session.exec(select(LearningProgress).where(LearningProgress.user_id == current_user.id)).all()
    return progress_records

@router.put("")
def sync_progress(
    sync_data: UserProgressSync,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Upsert Profile data (XP and last_visited_path)
    profile = session.exec(select(Profile).where(Profile.user_id == current_user.id)).first()
    if profile:
        profile.xp = sync_data.xp
        if sync_data.lastVisitedPath:
            profile.last_visited_path = sync_data.lastVisitedPath
        profile.updated_at = datetime.now(timezone.utc)
        session.add(profile)
        
    # Upsert each module
    for mod_id, mod_data in sync_data.modules.items():
        progress = session.exec(
            select(LearningProgress)
            .where(LearningProgress.user_id == current_user.id)
            .where(LearningProgress.module_id == mod_id)
        ).first()
        
        if not progress:
            progress = LearningProgress(
                user_id=current_user.id,
                module_id=mod_id,
                progress=mod_data.percent,
                quiz_score=mod_data.quizScore,
                completed=mod_data.completed
            )
        else:
            progress.progress = mod_data.percent
            progress.quiz_score = mod_data.quizScore
            progress.completed = mod_data.completed
            
        progress.updated_at = datetime.now(timezone.utc)
        session.add(progress)
        
    session.commit()
    return {"status": "success"}

@router.patch("/modules/{module_id}", response_model=ProgressResponse)
def update_module_progress(
    module_id: str,
    progress_update: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    progress = session.exec(
        select(LearningProgress)
        .where(LearningProgress.user_id == current_user.id)
        .where(LearningProgress.module_id == module_id)
    ).first()
    
    if not progress:
        progress = LearningProgress(
            user_id=current_user.id,
            module_id=module_id,
            progress=progress_update.progress,
            quiz_score=progress_update.quiz_score,
            completed=progress_update.completed if progress_update.completed is not None else False
        )
    else:
        progress.progress = progress_update.progress
        if progress_update.quiz_score is not None:
            progress.quiz_score = progress_update.quiz_score
        if progress_update.completed is not None:
            progress.completed = progress_update.completed
            
    if progress.progress >= 100:
        progress.completed = True
        progress.progress = 100
        
    progress.updated_at = datetime.now(timezone.utc)
    
    session.add(progress)
    session.commit()
    session.refresh(progress)
    
    return progress
