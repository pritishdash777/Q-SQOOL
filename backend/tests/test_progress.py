import pytest
from fastapi.testclient import TestClient

def test_update_module_progress(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "progress@example.com",
        "password": "password123",
        "full_name": "Progress User"
    })
    token = register_res.json()["access_token"]
    
    response = client.patch("/api/progress/modules/qubits", json={
        "progress": 50,
        "quiz_score": 80
    }, headers={"Authorization": f"Bearer {token}"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["module_id"] == "qubits"
    assert data["progress"] == 50
    assert data["completed"] == False

def test_progress_completion(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "progress2@example.com",
        "password": "password123",
        "full_name": "Progress User 2"
    })
    token = register_res.json()["access_token"]
    
    response = client.patch("/api/progress/modules/qubits", json={
        "progress": 100
    }, headers={"Authorization": f"Bearer {token}"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["progress"] == 100
    assert data["completed"] == True

def test_get_progress_and_isolation(client: TestClient):
    # User 1
    register_res_1 = client.post("/api/auth/register", json={
        "email": "progress3@example.com",
        "password": "password123",
        "full_name": "Progress User 3"
    })
    token_1 = register_res_1.json()["access_token"]
    
    client.patch("/api/progress/modules/qubits", json={"progress": 20}, headers={"Authorization": f"Bearer {token_1}"})
    client.patch("/api/progress/modules/gates", json={"progress": 60}, headers={"Authorization": f"Bearer {token_1}"})
    
    # User 2
    register_res_2 = client.post("/api/auth/register", json={
        "email": "progress4@example.com",
        "password": "password123",
        "full_name": "Progress User 4"
    })
    token_2 = register_res_2.json()["access_token"]
    
    client.patch("/api/progress/modules/qubits", json={"progress": 90}, headers={"Authorization": f"Bearer {token_2}"})

    # Assert User 1 only sees their 2 modules
    response_1 = client.get("/api/progress", headers={"Authorization": f"Bearer {token_1}"})
    assert response_1.status_code == 200
    data_1 = response_1.json()
    assert len(data_1) == 2
    assert any(m["module_id"] == "qubits" and m["progress"] == 20 for m in data_1)
    
    # Assert User 2 only sees their 1 module
    response_2 = client.get("/api/progress", headers={"Authorization": f"Bearer {token_2}"})
    assert response_2.status_code == 200
    data_2 = response_2.json()
    assert len(data_2) == 1
    assert data_2[0]["module_id"] == "qubits"
    assert data_2[0]["progress"] == 90

def test_bulk_sync_progress(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "progress5@example.com",
        "password": "password123",
        "full_name": "Progress User 5"
    })
    token = register_res.json()["access_token"]

    sync_payload = {
        "xp": 150,
        "completedModules": 1,
        "lastVisitedPath": "/learn/gates",
        "modules": {
            "qubits": {
                "moduleId": "qubits",
                "completed": True,
                "percent": 100,
                "quizScore": 95,
                "completedLessons": ["qubits:step-1", "qubits:step-2", "qubits"],
                "updatedAt": "2026-09-14T10:00:00Z"
            },
            "gates": {
                "moduleId": "gates",
                "completed": False,
                "percent": 10,
                "quizScore": None,
                "completedLessons": ["gates:step-1"],
                "updatedAt": "2026-09-14T10:05:00Z"
            }
        }
    }

    # Bulk PUT
    response = client.put("/api/progress", json=sync_payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200

    # Verify via GET
    get_res = client.get("/api/progress", headers={"Authorization": f"Bearer {token}"})
    assert get_res.status_code == 200
    data = get_res.json()
    assert len(data) == 2

    # Verify Profile updates
    profile_res = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})
    assert profile_res.status_code == 200
    profile_data = profile_res.json()
    assert profile_data["xp"] == 100


def account(client, email):
    response = client.post("/api/auth/register", json={
        "email": email, "password": "password123", "full_name": "Test Learner",
    })
    assert response.status_code == 201
    return response.json()["user"]["id"], {"Authorization": f"Bearer {response.json()['access_token']}"}


def payload(module_id="qubits", lessons=None, percent=100):
    return {"xp": 999999, "completedModules": 999, "modules": {module_id: {
        "moduleId": module_id, "completed": percent == 100, "percent": percent,
        "completedLessons": lessons if lessons is not None else [module_id],
        "updatedAt": "2000-01-01T00:00:00Z",
    }}}


def test_duplicate_completion_does_not_award_duplicate_xp(client):
    _, headers = account(client, "duplicate@example.com")
    for _ in range(3):
        response = client.put("/api/progress", json=payload(lessons=["qubits", "qubits"]), headers=headers)
        assert response.status_code == 200
        assert response.json()["xp"] == 100
        assert response.json()["modules"][0]["completed_lessons"] == ["qubits"]
    # The other write endpoint uses the same completion records and reward policy.
    assert client.patch("/api/progress/modules/qubits", json={"progress": 100}, headers=headers).status_code == 200
    assert client.get("/api/profile", headers=headers).json()["xp"] == 100
    assert len(client.get("/api/progress", headers=headers).json()) == 1


def test_stale_and_empty_saves_preserve_completed_lessons(client):
    _, headers = account(client, "stale@example.com")
    assert client.put("/api/progress", json=payload(lessons=["qubits:step-1"], percent=23), headers=headers).status_code == 200
    assert client.put("/api/progress", json=payload(lessons=["qubits:step-2"], percent=47), headers=headers).status_code == 200
    client.put("/api/progress", json=payload(), headers=headers)
    stale = client.put("/api/progress", json=payload(lessons=[], percent=0), headers=headers)
    assert stale.status_code == 200
    client.put("/api/progress", json={"modules": {}, "xp": 0}, headers=headers)
    result = client.get("/api/progress", headers=headers).json()[0]
    assert result["progress"] == 100
    assert result["completed"] is True
    assert result["completed_lessons"] == ["qubits", "qubits:step-1", "qubits:step-2"]
    client.patch("/api/progress/modules/qubits", json={"progress": 0, "completed": False}, headers=headers)
    assert client.get("/api/profile", headers=headers).json()["xp"] == 100


def test_bulk_sync_uses_authenticated_owner_and_requires_auth(client):
    _, a_headers = account(client, "owner-a@example.com")
    b_id, b_headers = account(client, "owner-b@example.com")
    data = {**payload(), "userId": b_id}
    assert client.put("/api/progress", json=data).status_code == 401
    assert client.put("/api/progress", json=data, headers=a_headers).status_code == 200
    assert client.get("/api/progress", headers=b_headers).json() == []
    assert client.get("/api/profile", headers=b_headers).json()["xp"] == 0
    assert client.get("/api/profile", headers=a_headers).json()["xp"] == 100


def test_invalid_completion_ids_cannot_award_xp(client):
    _, headers = account(client, "invalid@example.com")
    for data in [payload("invented"), payload(lessons=["invented"]), payload(lessons=["gates"])]:
        assert client.put("/api/progress", json=data, headers=headers).status_code == 422
    assert client.patch("/api/progress/modules/invented", json={"progress": 100}, headers=headers).status_code == 422
    assert client.get("/api/profile", headers=headers).json()["xp"] == 0
    assert client.get("/api/progress", headers=headers).json() == []


def test_profile_xp_ignores_legacy_arbitrary_total(client, session):
    from sqlmodel import select
    from app.db_models import Profile
    user_id, headers = account(client, "legacy@example.com")
    profile = session.exec(select(Profile).where(Profile.user_id == user_id)).one()
    profile.xp = 999999
    session.add(profile)
    session.commit()
    assert client.get("/api/profile", headers=headers).json()["xp"] == 0
