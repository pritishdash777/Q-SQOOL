import math
import pytest
from backend.app.models import Circuit, CircuitGate
from backend.app.simulator import simulate_circuit, SimulationError


def circuit(n, operations):
    return Circuit(qubits=n, gates=[CircuitGate(id=i, column=i, type=op[0], qubit=op[1],
        **({'target': op[2]} if op[0] in {'CX', 'CZ'} else {'angle': op[2]} if op[0] in {'RX', 'RY', 'RZ'} else {})) for i, op in enumerate(operations)])


@pytest.mark.parametrize('sdk', ['qiskit_aer', 'cirq', 'pennylane'])
@pytest.mark.parametrize('n,ops,expected', [
    (1, [], '0'), (5, [('X', 0)], '00001'),
    (2, [('X', 0), ('CX', 0, 1)], '11'),
    (2, [('X', 0), ('X', 1), ('CX', 0, 1)], '01'),
    (2, [('X', 0), ('M', 1)], '00'),
    (1, [('X', 0), ('M', 0), ('X', 0)], '1'),
    (1, [('X', 0), ('M', 0), ('X', 0), ('M', 0)], '0'),
    (1, [('H', 0), ('Z', 0), ('H', 0)], '1'),
    (1, [('RX', 0, math.pi)], '1'), (1, [('RY', 0, math.pi)], '1'),
    (2, [('H', 0), ('X', 1), ('CZ', 1, 0), ('H', 0)], '11'),
    (1, [('H', 0), ('S', 0), ('S', 0), ('H', 0)], '1'),
    (1, [('H', 0), ('T', 0), ('T', 0), ('T', 0), ('T', 0), ('H', 0)], '1'),
    (1, [('Y', 0)], '1'), (1, [('H', 0), ('RZ', 0, math.pi), ('H', 0)], '1'),
])
def test_native_sdk_semantics(sdk, n, ops, expected):
    result = simulate_circuit(circuit(n, ops), 32, sdk)
    assert result['simulator'] == sdk
    assert result['counts'] == {expected: 32}


@pytest.mark.parametrize('sdk', ['qiskit_aer', 'cirq', 'pennylane'])
def test_bell_and_mid_circuit_measurements(sdk):
    for ops in [[('H', 0), ('CX', 0, 1)], [('H', 0), ('M', 0), ('CX', 0, 1), ('M', 1)]]:
        counts = simulate_circuit(circuit(2, ops), 512, sdk)['counts']
        assert set(counts) == {'00', '11'}
        assert sum(counts.values()) == 512
        assert 170 < counts['00'] < 342


@pytest.mark.parametrize('sdk', ['qiskit_aer', 'cirq', 'pennylane'])
def test_one_shot_and_invalid_controls(sdk):
    assert sum(simulate_circuit(circuit(1, [('H', 0), ('M', 0)]), 1, sdk)['counts'].values()) == 1
    with pytest.raises(SimulationError):
        simulate_circuit(circuit(2, [('CX', 0, 0)]), 16, sdk)
