from datetime import datetime, timedelta, timezone
import random

import pytest
from qiskit.quantum_info import Operator
from sqlmodel import select

from app.models import Circuit, CircuitGate
from app.optimizer import optimize_circuit, circuit_depth
from app.simulator import build_qiskit_circuit
from app.db_models import LearningActivity, LearningProgress, User


def gate(id, type, qubit, column, **extra):
    return CircuitGate(id=id, type=type, qubit=qubit, column=column, **extra)


def test_optimizer_timeline_order_and_full_operator_equivalence():
    rng = random.Random(140)
    for _ in range(35):
        gates = []
        for i in range(12):
            kind = rng.choice(['H', 'X', 'Y', 'Z', 'S', 'T', 'CX', 'CZ'])
            q = rng.randrange(3)
            gates.append(gate(i, kind, q, i, **({'target': (q + 1) % 3} if kind in ['CX', 'CZ'] else {})))
        # Include cancellation and a shuffled storage order, as produced by gate dragging.
        gates.extend([gate(30, 'X', 1, 30), gate(31, 'X', 1, 31)])
        rng.shuffle(gates)
        circuit = Circuit(qubits=3, gates=gates)
        result = optimize_circuit(circuit)
        before = build_qiskit_circuit(circuit).remove_final_measurements(inplace=False)
        after = build_qiskit_circuit(result['after']).remove_final_measurements(inplace=False)
        assert Operator(before).equiv(Operator(after))
        assert result['optimizedDepth'] <= result['originalDepth']
    assert circuit_depth(Circuit(qubits=3, gates=[gate(1, 'H', 0, 1), gate(2, 'CX', 0, 3, target=1)])) == 2


def test_measurement_is_not_cancelled_or_crossed():
    circuit = Circuit(qubits=1, gates=[gate(3, 'X', 0, 2), gate(1, 'X', 0, 0), gate(2, 'M', 0, 1)])
    after = optimize_circuit(circuit)['after']
    assert [g.type for g in after.gates] == ['X', 'M', 'X']
    assert [g.column for g in after.gates] == [0, 1, 2]


def test_optimization_http_output_is_valid_frontend_gate_shape(client):
    response = client.post('/api/optimize', json={'circuit': {'qubits': 1, 'gates': [
        {'id': 1, 'type': 'X', 'qubit': 0, 'column': 0},
        {'id': 2, 'type': 'X', 'qubit': 0, 'column': 1},
        {'id': 3, 'type': 'H', 'qubit': 0, 'column': 2},
    ]}})
    assert response.status_code == 200
    assert response.json()['after']['gates'] == [{'id': 3, 'type': 'H', 'qubit': 0, 'column': 0}]


def auth(client, email='audit@example.com'):
    result = client.post('/api/auth/register', json={'email': email, 'password': 'password123', 'full_name': 'Audit Learner'}).json()
    return result['user']['id'], {'Authorization': f"Bearer {result['access_token']}"}


def test_summary_activity_persistence_duplicate_updates_and_isolation(client, session):
    user, headers = auth(client)
    assert client.get('/api/progress/summary', headers=headers).json()['activity_days'] == []
    client.patch('/api/progress/modules/qubits', headers=headers, json={'progress': 100})
    record = session.exec(select(LearningProgress).where(LearningProgress.user_id == user)).one()
    earlier = datetime.now(timezone.utc) - timedelta(days=2)
    record.updated_at = earlier
    session.add(record); session.commit()
    for _ in range(3):
        client.patch('/api/progress/modules/qubits', headers=headers, json={'progress': 100})
    # Older clients may send a default zero quiz score while syncing unchanged data.
    client.patch('/api/progress/modules/qubits', headers=headers, json={'progress': 100, 'quiz_score': 0})
    summary = client.get('/api/progress/summary', headers=headers).json()
    assert summary['xp'] == 100
    assert len(summary['activity_days']) == 1
    assert len(session.exec(select(LearningActivity)).all()) == 1
    assert session.exec(select(LearningProgress)).one().updated_at.date() == earlier.date()
    _, other = auth(client, 'other-audit@example.com')
    assert client.get('/api/progress/summary', headers=other).json()['activity_days'] == []
    assert client.get('/api/progress/summary').status_code == 401


@pytest.mark.parametrize('gates', [
    [{'id': 1, 'type': 'RX', 'qubit': 0, 'column': 0}],
    [{'id': 1, 'type': 'CX', 'qubit': 0, 'target': 0, 'column': 0}],
    [{'id': 1, 'type': 'X', 'qubit': 9, 'column': 0}],
    [{'id': 1, 'type': 'X', 'qubit': 0, 'column': 100000}],
    [{'id': 1, 'type': 'H', 'qubit': 0, 'column': 0}] * 257,
    [{'id': 1, 'type': 'H', 'qubit': 0, 'column': 0}, {'id': 1, 'type': 'X', 'qubit': 0, 'column': 1}],
])
def test_validation_agrees_across_execution_optimization_and_project_saves(client, gates):
    circuit = {'qubits': 2, 'gates': gates}
    assert client.post('/api/simulate', json={'circuit': circuit, 'shots': 128}).status_code in [400, 422]
    assert client.post('/api/optimize', json={'circuit': circuit}).status_code in [400, 422]
    _, headers = auth(client)
    assert client.post('/api/projects', headers=headers, json={'name': 'Invalid', 'circuit_json': circuit}).status_code == 422


@pytest.mark.parametrize('gates,expected', [([], {'00'}), ([{'id': 1, 'type': 'X', 'qubit': 0, 'column': 0}], {'01'}), ([{'id': 1, 'type': 'H', 'qubit': 0, 'column': 0}, {'id': 2, 'type': 'CX', 'qubit': 0, 'target': 1, 'column': 1}], {'00', '11'})])
def test_real_http_simulation_contract(client, gates, expected):
    response = client.post('/api/simulate', json={'circuit': {'qubits': 2, 'gates': gates}, 'shots': 512, 'simulator': 'qiskit_aer'})
    assert response.status_code == 200
    data = response.json()
    assert set(data['counts']) == expected
    assert sum(data['counts'].values()) == 512
    assert sum(data['probabilities'].values()) == pytest.approx(1)


def test_disabled_password_account_cannot_receive_a_session(client, session):
    user_id, _ = auth(client, 'disabled@example.com')
    user = session.get(User, user_id)
    user.is_active = False
    session.add(user); session.commit()
    assert client.post('/api/auth/login', json={'email': 'disabled@example.com', 'password': 'password123'}).status_code == 403
