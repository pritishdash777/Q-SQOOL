from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from ..database import get_session
from ..db_models import User, SavedProject, ProjectCollaborator
from ..schemas import (
    SavedProjectCreate,
    SavedProjectUpdate,
    SavedProjectResponse,
    CollaboratorAddRequest,
    CollaboratorResponse,
)
from ..dependencies import get_current_user
from ..models import Circuit  # Validate using existing Circuit
from ..simulator import build_qiskit_circuit

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("", response_model=List[SavedProjectResponse])
def get_projects(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    owned_projects = session.exec(
        select(SavedProject).where(
            SavedProject.user_id == current_user.id
        )
    ).all()

    memberships = session.exec(
        select(ProjectCollaborator).where(
            ProjectCollaborator.user_id == current_user.id
        )
    ).all()
    permissions = {item.project_id: item.permission for item in memberships}
    shared_project_ids = list(permissions)

    shared_projects = []

    if shared_project_ids:
        shared_projects = session.exec(
            select(SavedProject).where(
                SavedProject.id.in_(shared_project_ids)
            )
        ).all()

    return [
        SavedProjectResponse.model_validate(project).model_copy(update={
            "permission": "owner" if project.user_id == current_user.id else permissions[project.id]
        })
        for project in sorted(
            {project.id: project for project in owned_projects + shared_projects}.values(),
            key=lambda project: project.updated_at, reverse=True,
        )
    ]

@router.post("", response_model=SavedProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_create: SavedProjectCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    try:
        build_qiskit_circuit(Circuit.model_validate(project_create.circuit_json))
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

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.user_id == current_user.id

    is_collaborator = session.exec(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == current_user.id,
        )
    ).first()

    if not is_owner and not is_collaborator:
        raise HTTPException(status_code=404, detail="Project not found")

    return SavedProjectResponse.model_validate(project).model_copy(update={
        "permission": "owner" if is_owner else is_collaborator.permission
    })

@router.patch("/{project_id}", response_model=SavedProjectResponse)
def update_project(
    project_id: str,
    project_update: SavedProjectUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    project = session.get(SavedProject, project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.user_id == current_user.id

    collaborator = session.exec(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == current_user.id,
        )
    ).first()

    if not is_owner and not collaborator:
        raise HTTPException(status_code=404, detail="Project not found")

    if collaborator and collaborator.permission != "edit" and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You only have view permission for this project",
        )

    if project_update.circuit_json is not None:
        try:
            build_qiskit_circuit(Circuit.model_validate(project_update.circuit_json))
        except Exception as e:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid circuit json: {str(e)}"
            )

    update_data = project_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(project, key, value)

    project.updated_at = datetime.now(timezone.utc)

    session.add(project)
    session.commit()
    session.refresh(project)

    return SavedProjectResponse.model_validate(project).model_copy(update={
        "permission": "owner" if is_owner else collaborator.permission
    })


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    project = session.get(SavedProject, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found")
        
    collaborators = session.exec(
        select(ProjectCollaborator).where(ProjectCollaborator.project_id == project_id)
    ).all()
    for collaborator in collaborators:
        session.delete(collaborator)
    session.flush()
    session.delete(project)
    session.commit()


@router.post(
    "/{project_id}/collaborators",
    response_model=CollaboratorResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_collaborator(
    project_id: str,
    request: CollaboratorAddRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # Only the project owner can add collaborators
    project = session.get(SavedProject, project_id)

    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Find the user by email
    email_lower = request.email.lower()
    collaborator_user = session.exec(
        select(User).where(User.email == email_lower)
    ).first()

    if not collaborator_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email does not exist",
        )

    # Owner cannot add themselves
    if collaborator_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot add yourself as a collaborator",
        )

    # Prevent duplicate collaborators
    existing = session.exec(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id,
            ProjectCollaborator.user_id == collaborator_user.id,
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a collaborator",
        )

    collaborator = ProjectCollaborator(
        project_id=project_id,
        user_id=collaborator_user.id,
        permission=request.permission,
    )

    session.add(collaborator)
    session.commit()
    session.refresh(collaborator)

    return CollaboratorResponse(
        id=collaborator.id,
        user_id=collaborator_user.id,
        email=collaborator_user.email,
        permission=collaborator.permission,
        created_at=collaborator.created_at,
    )

@router.get(
    "/{project_id}/collaborators",
    response_model=List[CollaboratorResponse],
)
def get_collaborators(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    project = session.get(SavedProject, project_id)

    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    collaborators = session.exec(
        select(ProjectCollaborator).where(
            ProjectCollaborator.project_id == project_id
        )
    ).all()

    return [
        CollaboratorResponse(
            id=collaborator.id,
            user_id=collaborator.user_id,
            email=session.get(User, collaborator.user_id).email,
            permission=collaborator.permission,
            created_at=collaborator.created_at,
        )
        for collaborator in collaborators
    ]

@router.delete(
    "/{project_id}/collaborators/{collaborator_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_collaborator(
    project_id: str,
    collaborator_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    project = session.get(SavedProject, project_id)

    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    collaborator = session.get(ProjectCollaborator, collaborator_id)

    if not collaborator or collaborator.project_id != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collaborator not found",
        )

    session.delete(collaborator)
    session.commit()
