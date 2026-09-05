from __future__ import annotations
import time
from typing import Optional

from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator

from .models import Circuit


MAX_QUBITS = 5
MAX_SHOTS = 4096


class SimulationError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        gate_id: Optional[int] = None,
    ):
        self.code = code
        self.message = message
        self.gate_id = gate_id
        super().__init__(message)


def build_qiskit_circuit(circuit: Circuit) -> QuantumCircuit:
    if circuit.qubits > MAX_QUBITS:
        raise SimulationError(
            "INVALID_QUBITS",
            f"Maximum supported qubits is {MAX_QUBITS}.",
        )

    # Only create quantum bits here.
    # Classical bits will be created exactly once below.
    qc = QuantumCircuit(circuit.qubits, circuit.qubits)

    measurement_exists = False

    # Execute gates in column order.
    sorted_gates = sorted(
        circuit.gates,
        key=lambda g: (g.column, g.id),
    )

    for gate in sorted_gates:
        gate_id = gate.id
        qubit = gate.qubit

        # Validate main qubit.
        if qubit >= circuit.qubits:
            raise SimulationError(
                "INVALID_QUBIT",
                f"Qubit {qubit} does not exist.",
                gate_id,
            )

        # Validate controlled-gate target.
        if gate.type in {"CX", "CZ"}:
            if gate.target is None:
                raise SimulationError(
                    "INVALID_TARGET",
                    f"{gate.type} requires a target qubit.",
                    gate_id,
                )

            if gate.target >= circuit.qubits:
                raise SimulationError(
                    "INVALID_TARGET",
                    f"Target qubit {gate.target} does not exist.",
                    gate_id,
                )

            if qubit == gate.target:
                raise SimulationError(
                    "INVALID_TARGET",
                    f"{gate.type} control and target qubits must be different.",
                    gate_id,
                )

        try:
            if gate.type == "X":
                qc.x(qubit)

            elif gate.type == "Y":
                qc.y(qubit)

            elif gate.type == "Z":
                qc.z(qubit)

            elif gate.type == "H":
                qc.h(qubit)

            elif gate.type == "S":
                qc.s(qubit)

            elif gate.type == "T":
                qc.t(qubit)

            elif gate.type == "RX":
                if gate.angle is None:
                    raise SimulationError(
                        "INVALID_ANGLE",
                        "RX requires an angle in radians.",
                        gate_id,
                    )
                qc.rx(gate.angle, qubit)

            elif gate.type == "RY":
                if gate.angle is None:
                    raise SimulationError(
                        "INVALID_ANGLE",
                        "RY requires an angle in radians.",
                        gate_id,
                    )
                qc.ry(gate.angle, qubit)

            elif gate.type == "RZ":
                if gate.angle is None:
                    raise SimulationError(
                        "INVALID_ANGLE",
                        "RZ requires an angle in radians.",
                        gate_id,
                    )
                qc.rz(gate.angle, qubit)

            elif gate.type == "CX":
                qc.cx(qubit, gate.target)

            elif gate.type == "CZ":
                qc.cz(qubit, gate.target)

            elif gate.type == "M":
                qc.measure(qubit, qubit)
                measurement_exists = True

            else:
                raise SimulationError(
                    "UNSUPPORTED_GATE",
                    f"Unsupported gate: {gate.type}.",
                    gate_id,
                )

        except SimulationError:
            raise

        except Exception as exc:
            raise SimulationError(
                "INVALID_GATE",
                str(exc),
                gate_id,
            ) from exc

    # Automatically measure all qubits only when the user
    # did not explicitly add any measurement gates.
    if not measurement_exists:
        for qubit in range(circuit.qubits):
            qc.measure(qubit, qubit)

    return qc


def simulate_circuit(circuit: Circuit, shots: int) -> dict:
    if shots < 1 or shots > MAX_SHOTS:
        raise SimulationError(
            "INVALID_SHOTS",
            f"Shots must be between 1 and {MAX_SHOTS}.",
        )

    qc = build_qiskit_circuit(circuit)

    simulator = AerSimulator()

    start = time.perf_counter()

    result = simulator.run(
        qc,
        shots=shots,
    ).result()

    raw_counts = result.get_counts()

    execution_ms = max(
        1,
        round((time.perf_counter() - start) * 1000),
    )

    # Qiskit can return spaces when multiple classical registers
    # are present. Remove spaces to keep the API response simple.
    counts = {
        state.replace(" ", ""): count
        for state, count in raw_counts.items()
    }

    probabilities = {
        state: count / shots
        for state, count in counts.items()
    }

    return {
        "success": True,
        "name": "Quantum circuit",
        "simulator": "qiskit_aer",
        "shots": shots,
        "counts": counts,
        "probabilities": probabilities,
        "executionMs": execution_ms,
        "note": "Circuit executed using Qiskit Aer.",
    }