from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import update
from sqlmodel import Session, select
from ..database import get_session
from ..db_models import User, LearningProgress, Profile
from ..schemas import ProgressResponse, ProgressUpdate, UserProgressSync
from ..dependencies import get_current_user
from ..learning import REWARDS, valid_lessons, earned_xp

router = APIRouter(prefix="/api/progress", tags=["progress"])


def records(session: Session, user_id: str):
    return session.exec(select(LearningProgress).where(LearningProgress.user_id == user_id)).all()


def validate_module(module_id: str, lessons: list[str]):
    if module_id not in REWARDS or not set(lessons) <= valid_lessons(module_id):
        raise HTTPException(status_code=422, detail="Unknown module or lesson ID")


def lock_progress(session: Session, user_id: str):
    # Serialize writes for this account before reading. Also works on SQLite,
    # where SELECT FOR UPDATE does not acquire a write lock.
    session.execute(update(Profile).where(Profile.user_id == user_id).values(xp=Profile.xp))


def merge_module(session: Session, user_id: str, module_id: str, percent: int,
                 completed: bool | None, quiz_score: int | None, lessons: list[str]):
    record = session.exec(select(LearningProgress).where(
        LearningProgress.user_id == user_id, LearningProgress.module_id == module_id
    )).first()
    if record is None:
        record = LearningProgress(user_id=user_id, module_id=module_id)
    lesson_ids = set(record.completed_lessons) | set(lessons)
    # Preserve completions from clients predating lesson IDs.
    if record.completed or completed or percent == 100 or module_id in lesson_ids:
        lesson_ids.add(module_id)
    record.completed_lessons = sorted(lesson_ids)
    record.completed = module_id in lesson_ids
    record.progress = 100 if record.completed else max(record.progress, percent)
    if quiz_score is not None:
        record.quiz_score = max(record.quiz_score or 0, quiz_score)
    record.updated_at = datetime.now(timezone.utc)
    session.add(record)
    session.flush()
    return record


def update_totals(session: Session, user_id: str, path: str | None = None):
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).one()
    profile.xp = earned_xp(session, user_id)
    if path in {f"/{section}/{module}" for section in ("learn", "algorithms") for module in REWARDS}:
        profile.last_visited_path = path
    profile.updated_at = datetime.now(timezone.utc)
    session.add(profile)
    return profile


@router.get("", response_model=list[ProgressResponse])
def get_progress(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    return records(session, current_user.id)


@router.put("")
def sync_progress(sync_data: UserProgressSync, current_user: User = Depends(get_current_user),
                  session: Session = Depends(get_session)):
    for module_id, module in sync_data.modules.items():
        validate_module(module_id, module.completedLessons)
        if module.moduleId != module_id:
            raise HTTPException(status_code=422, detail="Module IDs must match")
    lock_progress(session, current_user.id)
    for module_id, module in sync_data.modules.items():
        merge_module(session, current_user.id, module_id, module.percent,
                     module.completed, module.quizScore, module.completedLessons)
    profile = update_totals(session, current_user.id, sync_data.lastVisitedPath)
    session.commit()
    return {"xp": profile.xp, "modules": [ProgressResponse.model_validate(record, from_attributes=True)
                                         for record in records(session, current_user.id)]}


@router.patch("/modules/{module_id}", response_model=ProgressResponse)
def update_module_progress(module_id: str, progress_update: ProgressUpdate,
                           current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    validate_module(module_id, progress_update.completed_lessons)
    lock_progress(session, current_user.id)
    record = merge_module(session, current_user.id, module_id, progress_update.progress,
                          progress_update.completed, progress_update.quiz_score, progress_update.completed_lessons)
    update_totals(session, current_user.id)
    session.commit()
    session.refresh(record)
    return record
