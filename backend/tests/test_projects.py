import pytest
from fastapi.testclient import TestClient

def test_project_crud(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "project@example.com",
        "password": "password123",
        "full_name": "Project User"
    })
    token = register_res.json()["access_token"]
    
    # Create
    circuit_json = {
        "qubits": 2,
        "gates": [
            {"id": 1, "type": "H", "qubit": 0, "column": 0},
            {"id": 2, "type": "CX", "qubit": 0, "target": 1, "column": 1}
        ]
    }
    
    create_res = client.post("/api/projects", json={
        "name": "My Bell State",
        "circuit_json": circuit_json
    }, headers={"Authorization": f"Bearer {token}"})
    
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]
    
    # Get List
    get_res = client.get("/api/projects", headers={"Authorization": f"Bearer {token}"})
    assert get_res.status_code == 200
    assert len(get_res.json()) == 1
    
    # Update
    update_res = client.patch(f"/api/projects/{project_id}", json={
        "name": "Updated Bell State"
    }, headers={"Authorization": f"Bearer {token}"})
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Bell State"
    
    # Delete
    delete_res = client.delete(f"/api/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert delete_res.status_code == 204
    
    # Verify Deletion
    get_res2 = client.get(f"/api/projects/{project_id}", headers={"Authorization": f"Bearer {token}"})
    assert get_res2.status_code == 404

def test_invalid_circuit_json(client: TestClient):
    register_res = client.post("/api/auth/register", json={
        "email": "project2@example.com",
        "password": "password123",
        "full_name": "Project User 2"
    })
    token = register_res.json()["access_token"]
    
    invalid_circuit = {
        "qubits": 0, # invalid, minimum 1
        "gates": []
    }
    
    create_res = client.post("/api/projects", json={
        "name": "Invalid",
        "circuit_json": invalid_circuit
    }, headers={"Authorization": f"Bearer {token}"})
    
    assert create_res.status_code == 422
