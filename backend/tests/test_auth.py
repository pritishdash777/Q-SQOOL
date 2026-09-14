import pytest
from fastapi.testclient import TestClient

def test_register_user(client: TestClient):
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "password123",
        "full_name": "Test User"
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "test@example.com"

def test_register_duplicate_user(client: TestClient):
    client.post("/api/auth/register", json={
        "email": "test2@example.com",
        "password": "password123",
        "full_name": "Test User"
    })
    response = client.post("/api/auth/register", json={
        "email": "test2@example.com",
        "password": "password123",
        "full_name": "Test User"
    })
    assert response.status_code == 409

def test_login_user(client: TestClient):
    client.post("/api/auth/register", json={
        "email": "test3@example.com",
        "password": "password123",
        "full_name": "Test User"
    })
    response = client.post("/api/auth/login", json={
        "email": "test3@example.com",
        "password": "password123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

def test_login_wrong_password(client: TestClient):
    client.post("/api/auth/register", json={
        "email": "test4@example.com",
        "password": "password123",
        "full_name": "Test User"
    })
    response = client.post("/api/auth/login", json={
        "email": "test4@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401

def test_get_me(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "test5@example.com",
        "password": "password123",
        "full_name": "Test User"
    })
    token = register_res.json()["access_token"]
    
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "test5@example.com"
