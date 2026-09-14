from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from ..database import get_session
from ..db_models import User, LearningProgress
from ..schemas import ProgressResponse, ProgressUpdate
from ..dependencies import get_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])

@router.get("", response_model=List[ProgressResponse])
def get_progress(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    progress_records = session.exec(select(LearningProgress).where(LearningProgress.user_id == current_user.id)).all()
    return progress_records

@router.put("/{module_id}", response_model=ProgressResponse)
def update_progress(
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
