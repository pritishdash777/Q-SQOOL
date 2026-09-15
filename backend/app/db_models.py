from typing import Optional
from datetime import datetime, timezone
import uuid
from sqlmodel import SQLModel, Field, Column, JSON
from sqlalchemy import UniqueConstraint

class User(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Profile(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, unique=True, foreign_key="user.id")
    full_name: str
    user_role: str = Field(default="Student")
    institution: Optional[str] = Field(default=None)
    bio: Optional[str] = Field(default=None)
    experience_level: str = Field(default="Beginner")
    preferred_sdk: str = Field(default="Qiskit")
    learning_goal: Optional[str] = Field(default=None)
    avatar_url: Optional[str] = Field(default=None)
    xp: int = Field(default=0)
    last_visited_path: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LearningProgress(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "module_id", name="uq_user_module"),)
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True, foreign_key="user.id")
    module_id: str = Field(index=True)
    progress: int = Field(default=0, ge=0, le=100)
    quiz_score: Optional[int] = Field(default=None)
    completed: bool = Field(default=False)
    completed_lessons: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, server_default="[]"))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SavedProject(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(index=True, foreign_key="user.id")
    name: str
    circuit_json: dict = Field(default={}, sa_column=Column(JSON))
    sdk: str = Field(default="Qiskit")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
