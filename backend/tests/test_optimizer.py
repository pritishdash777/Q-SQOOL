from backend.app.models import Circuit, CircuitGate
from backend.app.optimizer import optimize_circuit


def gate(id, type, qubit, column, target=None):
    return CircuitGate(
        id=id,
        type=type,
        qubit=qubit,
        column=column,
        target=target,
    )


def test_x_x_h_becomes_h():
    circuit = Circuit(
        qubits=1,
        gates=[
            gate(1, "X", 0, 0),
            gate(2, "X", 0, 1),
            gate(3, "H", 0, 2),
        ],
    )

    result = optimize_circuit(circuit)

    assert [g.type for g in result["after"].gates] == ["H"]
    assert result["gateIds"] == [1, 2]
    assert result["originalGateCount"] == 3
    assert result["optimizedGateCount"] == 1


def test_h_h_x_becomes_x():
    circuit = Circuit(
        qubits=1,
        gates=[
            gate(1, "H", 0, 0),
            gate(2, "H", 0, 1),
            gate(3, "X", 0, 2),
        ],
    )

    result = optimize_circuit(circuit)

    assert [g.type for g in result["after"].gates] == ["X"]


def test_z_z_becomes_empty():
    circuit = Circuit(
        qubits=1,
        gates=[
            gate(1, "Z", 0, 0),
            gate(2, "Z", 0, 1),
        ],
    )

    result = optimize_circuit(circuit)

    assert result["after"].gates == []
    assert result["gateIds"] == [1, 2]


def test_x_h_x_unchanged():
    circuit = Circuit(
        qubits=1,
        gates=[
            gate(1, "X", 0, 0),
            gate(2, "H", 0, 1),
            gate(3, "X", 0, 2),
        ],
    )

    result = optimize_circuit(circuit)

    assert [g.type for g in result["after"].gates] == ["X", "H", "X"]
    assert result["gateIds"] == []


def test_cx_cx_becomes_empty():
    circuit = Circuit(
        qubits=2,
        gates=[
            gate(1, "CX", 0, 0, target=1),
            gate(2, "CX", 0, 1, target=1),
        ],
    )

    result = optimize_circuit(circuit)

    assert result["after"].gates == []
    assert result["gateIds"] == [1, 2]


def test_reverse_cx_is_not_cancelled():
    circuit = Circuit(
        qubits=2,
        gates=[
            gate(1, "CX", 0, 0, target=1),
            gate(2, "CX", 1, 1, target=0),
        ],
    )

    result = optimize_circuit(circuit)

    assert len(result["after"].gates) == 2
    assert result["gateIds"] == []


def test_intervening_operation_prevents_cancellation():
    circuit = Circuit(
        qubits=2,
        gates=[
            gate(1, "X", 1, 0),
            gate(2, "CX", 0, 1, target=1),
            gate(3, "X", 1, 2),
        ],
    )

    result = optimize_circuit(circuit)

    assert len(result["after"].gates) == 3
    assert result["gateIds"] == []