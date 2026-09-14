import pytest
from fastapi.testclient import TestClient

def test_get_profile(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "profile@example.com",
        "password": "password123",
        "full_name": "Profile User"
    })
    token = register_res.json()["access_token"]
    
    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Profile User"
    assert data["user_role"] == "Student"

def test_get_profile_unauthorized(client: TestClient):
    response = client.get("/api/profile")
    assert response.status_code == 401

def test_update_profile(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "profile2@example.com",
        "password": "password123",
        "full_name": "Profile User 2"
    })
    token = register_res.json()["access_token"]
    
    response = client.patch("/api/profile", json={
        "full_name": "Updated Name",
        "bio": "New bio"
    }, headers={"Authorization": f"Bearer {token}"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"
    assert data["bio"] == "New bio"
    
    # check if update persists
    get_res = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})
    assert get_res.json()["full_name"] == "Updated Name"
