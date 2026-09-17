from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional
from datetime import datetime

class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=100)

class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str

class UserSummary(BaseModel):
    id: str
    email: str
    is_active: bool

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary

class ProfileResponse(BaseModel):
    id: int
    user_id: str
    full_name: str
    user_role: str
    institution: Optional[str] = None
    bio: Optional[str] = None
    experience_level: str
    preferred_sdk: str
    learning_goal: Optional[str] = None
    avatar_url: Optional[str] = None
    xp: int
    last_visited_path: Optional[str] = None
    updated_at: datetime

class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    user_role: Optional[str] = Field(default=None, max_length=50)
    institution: Optional[str] = Field(default=None, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=500)
    experience_level: Optional[str] = Field(default=None, max_length=50)
    preferred_sdk: Optional[str] = Field(default=None, max_length=50)
    learning_goal: Optional[str] = Field(default=None, max_length=100)

class ProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    progress: int = Field(ge=0, le=100)
    quiz_score: Optional[int] = Field(default=None, ge=0, le=100)
    completed: Optional[bool] = None
    completed_lessons: list[str] = Field(default_factory=list)

class ProgressResponse(BaseModel):
    module_id: str
    progress: int
    quiz_score: Optional[int]
    completed: bool
    completed_lessons: list[str] = Field(default_factory=list)
    updated_at: datetime

class SavedProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    circuit_json: dict
    sdk: str = Field(default="Qiskit")

class SavedProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    circuit_json: Optional[dict] = None
    sdk: Optional[str] = None

class SavedProjectResponse(BaseModel):
    id: str
    name: str
    circuit_json: dict
    sdk: str
    created_at: datetime
    updated_at: datetime

from typing import Dict, List

class ModuleProgressSync(BaseModel):
    model_config = ConfigDict(extra="ignore")
    moduleId: str
    completed: bool
    percent: int = Field(ge=0, le=100)
    quizScore: Optional[int] = Field(default=None, ge=0, le=100)
    completedLessons: List[str] = Field(default_factory=list)
    updatedAt: str

class UserProgressSync(BaseModel):
    model_config = ConfigDict(extra="ignore")
    # Legacy clients may send XP/counts; neither is authoritative.
    xp: int = 0
    completedModules: int = 0
    modules: Dict[str, ModuleProgressSync]
    lastVisitedPath: Optional[str] = None


class CollaboratorAddRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    permission: str = Field(default="edit", pattern="^(view|edit)$")


class CollaboratorResponse(BaseModel):
    id: int
    user_id: str
    email: str
    permission: str
    created_at: datetime