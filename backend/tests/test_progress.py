import pytest
from fastapi.testclient import TestClient

def test_update_progress(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "progress@example.com",
        "password": "password123",
        "full_name": "Progress User"
    })
    token = register_res.json()["access_token"]
    
    response = client.put("/api/progress/module-1", json={
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
    
    response = client.put("/api/progress/module-1", json={
        "progress": 100
    }, headers={"Authorization": f"Bearer {token}"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["progress"] == 100
    assert data["completed"] == True

def test_get_progress(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "progress3@example.com",
        "password": "password123",
        "full_name": "Progress User 3"
    })
    token = register_res.json()["access_token"]
    
    client.put("/api/progress/module-1", json={"progress": 20}, headers={"Authorization": f"Bearer {token}"})
    client.put("/api/progress/module-2", json={"progress": 60}, headers={"Authorization": f"Bearer {token}"})
    
    response = client.get("/api/progress", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
