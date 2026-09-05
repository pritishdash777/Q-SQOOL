import math

import pytest

from backend.app.models import Circuit, CircuitGate
from backend.app.simulator import SimulationError, simulate_circuit


def gate(id, type, qubit, column, target=None, angle=None):
    return CircuitGate(
        id=id,
        type=type,
        qubit=qubit,
        column=column,
        target=target,
        angle=angle,
    )


def clean_counts(counts):
    """
    Qiskit may return measurement keys such as:
    '1 0' instead of '1'
    '00 00' instead of '00'

    Remove spaces so the tests use the logical bitstring.
    """
    return {
        state.replace(" ", ""): count
        for state, count in counts.items()
    }


def clean_probabilities(probabilities):
    """Remove Qiskit's classical-register spacing from probability keys."""
    return {
        state.replace(" ", ""): probability
        for state, probability in probabilities.items()
    }


def test_empty_circuit():
    circuit = Circuit(
        qubits=1,
        gates=[],
    )

    result = simulate_circuit(circuit, 100)

    assert result["success"] is True
    assert sum(result["counts"].values()) == 100


def test_single_x():
    circuit = Circuit(
        qubits=1,
        gates=[
            gate(1, "X", 0, 0),
        ],
    )

    result = simulate_circuit(circuit, 100)

    assert result["success"] is True

    counts = clean_counts(result["counts"])

    assert counts.get("1", 0) == 100


def test_single_h():
    circuit = Circuit(
        qubits=1,
        gates=[
            gate(1, "H", 0, 0),
        ],
    )

    result = simulate_circuit(circuit, 1000)

    assert result["success"] is True

    probabilities = clean_probabilities(result["probabilities"])

    probability_one = probabilities.get("1", 0.0)

    # H|0> should produce approximately 50% |0> and 50% |1>.
    assert 0.35 <= probability_one <= 0.65


def test_bell_state():
    circuit = Circuit(
        qubits=2,
        gates=[
            gate(1, "H", 0, 0),
            gate(2, "CX", 0, 1, target=1),
        ],
    )

    result = simulate_circuit(circuit, 1000)

    assert result["success"] is True

    counts = clean_counts(result["counts"])

    # Bell state should produce approximately:
    # |00> -> 50%
    # |11> -> 50%
    assert counts.get("00", 0) > 350
    assert counts.get("11", 0) > 350

    # Other states should occur rarely/never.
    assert counts.get("01", 0) < 100
    assert counts.get("10", 0) < 100


def test_invalid_qubit():
    circuit = Circuit(
        qubits=2,
        gates=[
            gate(99, "X", 5, 0),
        ],
    )

    with pytest.raises(SimulationError) as error:
        simulate_circuit(circuit, 100)

    assert error.value.code == "INVALID_QUBIT"
    assert error.value.gate_id == 99


def test_invalid_cx_target():
    circuit = Circuit(
        qubits=2,
        gates=[
            gate(4, "CX", 0, 0, target=5),
        ],
    )

    with pytest.raises(SimulationError) as error:
        simulate_circuit(circuit, 100)

    assert error.value.code == "INVALID_TARGET"
    assert error.value.gate_id == 4


def test_rotation_angle():
    circuit = Circuit(
        qubits=1,
        gates=[
            gate(
                1,
                "RX",
                0,
                0,
                angle=math.pi / 2,
            ),
        ],
    )

    result = simulate_circuit(circuit, 1000)

    assert result["success"] is True

    probabilities = clean_probabilities(result["probabilities"])

    probability_one = probabilities.get("1", 0.0)

    # RX(pi/2)|0> gives approximately 50% |0> and 50% |1>.
    assert 0.35 <= probability_one <= 0.65


def test_shots_above_limit():
    circuit = Circuit(
        qubits=1,
        gates=[],
    )

    with pytest.raises(SimulationError) as error:
        simulate_circuit(circuit, 4097)

    assert error.value.code == "INVALID_SHOTS"