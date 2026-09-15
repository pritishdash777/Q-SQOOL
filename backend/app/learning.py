"""Stable curriculum IDs and server-owned completion rewards."""
import json
from pathlib import Path
from sqlmodel import Session, select
from .db_models import LearningProgress

REWARDS = json.loads((Path(__file__).resolve().parents[2] / "lib/learning-catalog.json").read_text())


def valid_lessons(module_id: str) -> set[str]:
    return {module_id, *(f"{module_id}:step-{i}" for i in range(1, 4))}


def earned_xp(session: Session, user_id: str) -> int:
    records = session.exec(select(LearningProgress).where(LearningProgress.user_id == user_id)).all()
    return sum(REWARDS.get(record.module_id, 0) for record in records if record.completed)
