"""Native SDK execution; classical output always c[n-1]...c[0]."""
from collections import Counter
from time import perf_counter

from .models import Circuit
from .simulator import SimulationError


def simulate_sdk(circuit: Circuit, shots: int, backend: str) -> dict:
    start = perf_counter()
    try:
        if backend == "cirq":
            counts = run_cirq(circuit, shots)
        elif backend == "pennylane":
            counts = run_pennylane(circuit, shots)
        else:
            raise SimulationError("UNSUPPORTED_BACKEND", "Choose Qiskit Aer, Cirq or PennyLane.")
    except ImportError as exc:
        raise SimulationError("BACKEND_UNAVAILABLE", f"{backend} is not installed on the server. Redeploy the backend with the updated requirements.") from exc
    except SimulationError:
        raise
    except Exception as exc:
        raise SimulationError("SIMULATION_FAILED", f"{backend} could not execute this circuit. Try fewer gates or shots.") from exc
    return {
        "success": True, "name": "Quantum circuit", "simulator": backend,
        "shots": shots, "counts": dict(counts),
        "probabilities": {bits: count / shots for bits, count in counts.items()},
        "executionMs": max(1, round((perf_counter() - start) * 1000)),
        "note": f"Executed using {backend}. Ideal simulation; q0 is the rightmost bit. Unmeasured classical bits remain zero.",
    }


def run_cirq(circuit: Circuit, shots: int):
    import cirq
    q = cirq.LineQubit.range(circuit.qubits)
    native = cirq.Circuit()
    last = {}
    for g in sorted(circuit.gates, key=lambda g: (g.column, g.id)):
        if g.type == "M":
            key = f"m{g.id}"
            op = cirq.measure(q[g.qubit], key=key)
            last[g.qubit] = key
        elif g.type in {"RX", "RY", "RZ"}:
            op = getattr(cirq, g.type.lower())(g.angle)(q[g.qubit])
        elif g.type in {"CX", "CZ"}:
            op = getattr(cirq, "CNOT" if g.type == "CX" else "CZ")(q[g.qubit], q[g.target])
        else:
            op = getattr(cirq, g.type)(q[g.qubit])
        native.append(op, strategy=cirq.InsertStrategy.NEW)
    if not last:
        for i in range(circuit.qubits):
            last[i] = f"auto{i}"
            native.append(cirq.measure(q[i], key=last[i]))
    samples = cirq.Simulator().run(native, repetitions=shots).measurements
    return Counter("".join(str(int(samples[last[q]][s, 0])) if q in last else "0"
                           for q in reversed(range(circuit.qubits))) for s in range(shots))


def run_pennylane(circuit: Circuit, shots: int):
    import pennylane as qml
    import numpy as np
    gates = sorted(circuit.gates, key=lambda g: (g.column, g.id))
    measured = sorted({g.qubit for g in gates if g.type == "M"}, reverse=True)
    wires = list(reversed(range(circuit.qubits)))
    device = qml.device("default.qubit", wires=wires)
    names = {"X": "PauliX", "Y": "PauliY", "Z": "PauliZ", "H": "Hadamard", "CX": "CNOT"}

    @qml.set_shots(shots)
    @qml.qnode(device, mcm_method="tree-traversal")
    def execute():
        last = {}
        for g in gates:
            if g.type == "M":
                last[g.qubit] = qml.measure(g.qubit)
            elif g.type in {"RX", "RY", "RZ"}:
                getattr(qml, g.type)(g.angle, wires=g.qubit)
            else:
                getattr(qml, names.get(g.type, g.type))(wires=[g.qubit, g.target] if g.target is not None else g.qubit)
        if measured:
            return qml.sample([last[q] for q in measured])
        return qml.sample(wires=wires)

    samples = np.asarray(execute()).reshape(shots, len(measured) or circuit.qubits)
    positions = {q: i for i, q in enumerate(measured or wires)}
    return Counter("".join(str(int(row[positions[q]])) if q in positions else "0" for q in wires) for row in samples)
