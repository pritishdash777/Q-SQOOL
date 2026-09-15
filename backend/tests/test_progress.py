import pytest
from fastapi.testclient import TestClient

def test_update_module_progress(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "progress@example.com",
        "password": "password123",
        "full_name": "Progress User"
    })
    token = register_res.json()["access_token"]
    
    response = client.patch("/api/progress/modules/module-1", json={
        "progress": 50,
        "quiz_score": 80
    }, headers={"Authorization": f"Bearer {token}"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["module_id"] == "module-1"
    assert data["progress"] == 50
    assert data["completed"] == False

def test_progress_completion(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "progress2@example.com",
        "password": "password123",
        "full_name": "Progress User 2"
    })
    token = register_res.json()["access_token"]
    
    response = client.patch("/api/progress/modules/module-1", json={
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
    
    client.patch("/api/progress/modules/module-1", json={"progress": 20}, headers={"Authorization": f"Bearer {token_1}"})
    client.patch("/api/progress/modules/module-2", json={"progress": 60}, headers={"Authorization": f"Bearer {token_1}"})
    
    # User 2
    register_res_2 = client.post("/api/auth/register", json={
        "email": "progress4@example.com",
        "password": "password123",
        "full_name": "Progress User 4"
    })
    token_2 = register_res_2.json()["access_token"]
    
    client.patch("/api/progress/modules/module-1", json={"progress": 90}, headers={"Authorization": f"Bearer {token_2}"})

    # Assert User 1 only sees their 2 modules
    response_1 = client.get("/api/progress", headers={"Authorization": f"Bearer {token_1}"})
    assert response_1.status_code == 200
    data_1 = response_1.json()
    assert len(data_1) == 2
    assert any(m["module_id"] == "module-1" and m["progress"] == 20 for m in data_1)
    
    # Assert User 2 only sees their 1 module
    response_2 = client.get("/api/progress", headers={"Authorization": f"Bearer {token_2}"})
    assert response_2.status_code == 200
    data_2 = response_2.json()
    assert len(data_2) == 1
    assert data_2[0]["module_id"] == "module-1"
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
        "lastVisitedPath": "/module-2/lesson-1",
        "modules": {
            "module-1": {
                "moduleId": "module-1",
                "completed": True,
                "percent": 100,
                "quizScore": 95,
                "completedLessons": ["lesson-1", "lesson-2"],
                "updatedAt": "2026-09-14T10:00:00Z"
            },
            "module-2": {
                "moduleId": "module-2",
                "completed": False,
                "percent": 10,
                "quizScore": None,
                "completedLessons": ["lesson-1"],
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
    assert profile_data["xp"] == 150
