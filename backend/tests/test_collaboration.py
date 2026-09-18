import pytest
from sqlalchemy import text
from sqlmodel import select
from app.db_models import ProjectCollaborator

CIRCUIT = {"qubits": 2, "gates": [{"id": 1, "type": "H", "qubit": 0, "column": 0}]}


def register(client, email):
    response = client.post('/api/auth/register', json={
        'email': email, 'password': 'password123', 'full_name': 'Project Tester',
    })
    assert response.status_code == 201
    return {'Authorization': f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def sharing(client, session):
    # Exercise deletion with the same referential constraints as PostgreSQL.
    session.exec(text('PRAGMA foreign_keys=ON'))
    owner = register(client, 'owner@example.com')
    editor = register(client, 'editor@example.com')
    viewer = register(client, 'viewer@example.com')
    stranger = register(client, 'stranger@example.com')
    response = client.post('/api/projects', headers=owner, json={'name': 'Shared circuit', 'circuit_json': CIRCUIT})
    assert response.status_code == 201
    assert response.json()['permission'] == 'owner'
    path = f"/api/projects/{response.json()['id']}"
    members = {}
    for email, permission in [('editor@example.com', 'edit'), ('viewer@example.com', 'view')]:
        response = client.post(f'{path}/collaborators', headers=owner, json={'email': email, 'permission': permission})
        assert response.status_code == 201
        members[permission] = response.json()['id']
    return path, owner, editor, viewer, stranger, members


def test_shared_projects_and_permissions(client, sharing):
    path, owner, editor, viewer, stranger, _ = sharing
    for headers, permission in [(owner, 'owner'), (editor, 'edit'), (viewer, 'view')]:
        projects = client.get('/api/projects', headers=headers).json()
        assert len(projects) == 1
        assert projects[0]['permission'] == permission
        assert client.get(path, headers=headers).json()['permission'] == permission
    assert client.get('/api/projects', headers=stranger).json() == []
    assert client.get(path, headers=stranger).status_code == 404
    assert client.patch(path, headers=stranger, json={'name': 'Stolen'}).status_code == 404
    assert client.patch(path, headers=viewer, json={'name': 'No'}).status_code == 403
    response = client.patch(path, headers=editor, json={'name': 'Edited', 'circuit_json': {'qubits': 1, 'gates': []}})
    assert response.status_code == 200
    assert response.json()['permission'] == 'edit'
    assert client.get(path, headers=owner).json()['name'] == 'Edited'
    for headers in [editor, viewer, stranger]:
        assert client.delete(path, headers=headers).status_code == 404
        assert client.get(f'{path}/collaborators', headers=headers).status_code == 404
        assert client.post(f'{path}/collaborators', headers=headers, json={'email': 'stranger@example.com'}).status_code == 404


def test_invite_validation_and_revocation(client, sharing):
    path, owner, editor, viewer, stranger, members = sharing
    assert len(client.get(f'{path}/collaborators', headers=owner).json()) == 2
    for email, permission, expected in [
        ('OWNER@example.com', 'edit', 400), ('EDITOR@example.com', 'view', 409),
        ('missing@example.com', 'edit', 404), ('invalid', 'edit', 422),
        ('stranger@example.com', 'admin', 422),
    ]:
        assert client.post(f'{path}/collaborators', headers=owner, json={'email': email, 'permission': permission}).status_code == expected
    member_path = f"{path}/collaborators/{members['edit']}"
    for headers in [editor, viewer, stranger]:
        assert client.delete(member_path, headers=headers).status_code == 404
    assert client.delete(member_path, headers=owner).status_code == 204
    assert client.get(path, headers=editor).status_code == 404
    assert client.patch(path, headers=editor, json={'name': 'Revoked'}).status_code == 404
    assert client.get('/api/projects', headers=editor).json() == []


def test_delete_shared_project_removes_memberships(client, session, sharing):
    path, owner, editor, viewer, _, _ = sharing
    assert client.delete(path, headers=owner).status_code == 204
    assert session.exec(select(ProjectCollaborator)).all() == []
    for headers in [owner, editor, viewer]:
        assert client.get(path, headers=headers).status_code == 404
        assert client.get('/api/projects', headers=headers).json() == []


@pytest.mark.parametrize('field', ['name', 'circuit_json', 'sdk'])
def test_null_project_update_is_rejected(client, sharing, field):
    path, owner, *_ = sharing
    assert client.patch(path, headers=owner, json={field: None}).status_code == 422
    assert client.get(path, headers=owner).json()['name'] == 'Shared circuit'


def test_collaborator_cannot_be_removed_through_another_project(client, sharing):
    path, owner, _, _, _, members = sharing
    other = client.post('/api/projects', headers=owner, json={'name': 'Other', 'circuit_json': CIRCUIT}).json()
    assert client.delete(f"/api/projects/{other['id']}/collaborators/{members['edit']}", headers=owner).status_code == 404
    assert len(client.get(f'{path}/collaborators', headers=owner).json()) == 2
