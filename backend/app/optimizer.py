from __future__ import annotations
from copy import deepcopy

from .models import Circuit, CircuitGate
from .simulator import build_qiskit_circuit


def circuit_depth(circuit: Circuit) -> int:
    layers = [0] * circuit.qubits
    for gate in sorted(circuit.gates, key=lambda gate: (gate.column, gate.id)):
        wires = _gate_qubits(gate)
        layer = 1 + max(layers[q] for q in wires)
        for q in wires:
            layers[q] = layer
    return max(layers, default=0)


SELF_INVERSE_GATES = {"X", "Y", "Z", "H"}


def _gate_qubits(gate: CircuitGate) -> set[int]:
    """Return every qubit affected by a gate."""
    qubits = {gate.qubit}

    if gate.type in {"CX", "CZ"} and gate.target is not None:
        qubits.add(gate.target)

    return qubits


def _same_operation(first: CircuitGate, second: CircuitGate) -> bool:
    """Check whether two gates form a safe cancellation pair."""
    if first.type != second.type:
        return False

    if first.type in SELF_INVERSE_GATES:
        return first.qubit == second.qubit

    if first.type in {"CX", "CZ"}:
        return (
            first.qubit == second.qubit
            and first.target == second.target
        )

    return False


def _has_intervening_operation(
    gates: list[CircuitGate],
    first_index: int,
    second_index: int,
) -> bool:
    """Check whether an operation affects either qubit between a pair."""
    involved_qubits = _gate_qubits(gates[first_index])

    for index in range(first_index + 1, second_index):
        if _gate_qubits(gates[index]) & involved_qubits:
            return True

    return False


def optimize_circuit(circuit: Circuit) -> dict:
    """
    Safely remove adjacent-equivalent self-inverse gate pairs.

    Supported cancellations:
    X-X, Y-Y, Z-Z, H-H
    CX-CX, CZ-CZ with identical control/target.
    """

    build_qiskit_circuit(circuit)  # Apply the same validation as execution.
    original_gates = sorted(deepcopy(circuit.gates), key=lambda gate: (gate.column, gate.id))
    remaining = list(original_gates)
    removed_ids: list[int] = []

    changed = True

    while changed:
        changed = False

        for i in range(len(remaining)):
            first = remaining[i]

            if first.type not in SELF_INVERSE_GATES | {"CX", "CZ"}:
                continue

            for j in range(i + 1, len(remaining)):
                second = remaining[j]

                if _has_intervening_operation(remaining, i, j):
                    break

                if _same_operation(first, second):
                    removed_ids.extend([first.id, second.id])
                    del remaining[j]
                    del remaining[i]
                    changed = True
                    break

            if changed:
                break

    # Recalculate columns while preserving every surviving gate ID.
    optimized_gates = [
        gate.model_copy(deep=True)
        for gate in remaining
    ]

    if removed_ids:
        layers = [0] * circuit.qubits
        for gate in optimized_gates:
            wires = _gate_qubits(gate)
            gate.column = max(layers[q] for q in wires)
            for q in wires:
                layers[q] = gate.column + 1

    optimized_circuit = Circuit(
        qubits=circuit.qubits,
        gates=optimized_gates,
    )

    original_count = len(original_gates)
    optimized_count = len(optimized_gates)

    if original_count == 0:
        reduction_percent = 0.0
    else:
        reduction_percent = round(
            ((original_count - optimized_count) / original_count) * 100,
            2,
        )

    if optimized_count < original_count:
        title = "Circuit optimized"
        text = (
            f"Removed {original_count - optimized_count} "
            f"redundant gate(s) safely."
        )
        warning = (
            "Only mathematically safe self-inverse gate "
            "cancellations were applied."
        )
    else:
        title = "No safe optimization found"
        text = "No supported redundant gate patterns were found."
        warning = (
            "The circuit was left unchanged because no safe "
            "optimization was available."
        )

    return {
        "title": title,
        "text": text,
        "gateIds": removed_ids,
        "before": circuit.model_copy(deep=True),
        "after": optimized_circuit,
        "originalGateCount": original_count,
        "optimizedGateCount": optimized_count,
        "reductionPercent": reduction_percent,
        "originalDepth": circuit_depth(circuit),
        "optimizedDepth": circuit_depth(optimized_circuit),
        "warning": warning,
    }
