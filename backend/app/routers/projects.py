from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from ..database import get_session
from ..db_models import User, SavedProject
from ..schemas import SavedProjectCreate, SavedProjectUpdate, SavedProjectResponse
from ..dependencies import get_current_user
from ..models import Circuit  # Validate using existing Circuit

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("", response_model=List[SavedProjectResponse])
def get_projects(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)):
    projects = session.exec(select(SavedProject).where(SavedProject.user_id == current_user.id)).all()
    return projects

@router.post("", response_model=SavedProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_create: SavedProjectCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    try:
        Circuit.model_validate(project_create.circuit_json)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid circuit json: {str(e)}")
        
    project = SavedProject(
        user_id=current_user.id,
        name=project_create.name,
        circuit_json=project_create.circuit_json,
        sdk=project_create.sdk
    )
    
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return project

@router.get("/{project_id}", response_model=SavedProjectResponse)
def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    project = session.get(SavedProject, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    return project

@router.patch("/{project_id}", response_model=SavedProjectResponse)
def update_project(
    project_id: str,
    project_update: SavedProjectUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    project = session.get(SavedProject, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if project_update.circuit_json is not None:
        try:
            Circuit.model_validate(project_update.circuit_json)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Invalid circuit json: {str(e)}")
            
    update_data = project_update.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(project, key, value)
        
    project.updated_at = datetime.now(timezone.utc)
    
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    project = session.get(SavedProject, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    session.delete(project)
    session.commit()
