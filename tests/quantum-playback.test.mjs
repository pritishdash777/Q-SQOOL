import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayback, initialState, evolveGate, measureQubit, probabilityAt, blochVector } from '../lib/quantum-playback.ts';

const result = { name: 'Test', note: '', probabilities: {}, simulator: 'qiskit_aer' };
const gate = (type, qubit = 0, extra = {}) => ({ id: 1, type, qubit, column: 0, ...extra });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
const norm = state => { let sum = 0; for (let i = 0; i < state.length / 2; i++) sum += probabilityAt(state, i); return sum; };

test('all single-qubit gates preserve normalization and expected phase', () => {
  for (const type of ['H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ']) {
    const state = evolveGate(evolveGate(initialState(1), gate('H')), gate(type, 0, { angle: .73 }));
    close(norm(state), 1);
  }
  const y = evolveGate(initialState(1), gate('Y')); close(y[3], 1);
  const rx = evolveGate(initialState(1), gate('RX', 0, { angle: Math.PI })); close(rx[3], -1);
  const ry = evolveGate(initialState(1), gate('RY', 0, { angle: Math.PI })); close(ry[2], 1);
  const rz = evolveGate(initialState(1), gate('RZ', 0, { angle: Math.PI })); close(rz[1], -1);
  const plus = evolveGate(initialState(1), gate('H'));
  close(evolveGate(plus, gate('S'))[3], Math.SQRT1_2);
  close(evolveGate(plus, gate('T'))[2], .5); close(evolveGate(plus, gate('T'))[3], .5);
  close(blochVector(evolveGate(plus, gate('S')), 0).y, 1);
});

test('Hadamard interference cancels the |1> branch', () => {
  const plus = evolveGate(initialState(1), gate('H'));
  close(probabilityAt(plus, 0), .5);
  const interference = evolveGate(plus, gate('H'));
  close(probabilityAt(interference, 0), 1); close(probabilityAt(interference, 1), 0);
});

test('Bell state has correlated outcomes and mixed reduced qubits', () => {
  const state = evolveGate(evolveGate(initialState(2), gate('H')), gate('CX', 0, { target: 1 }));
  close(probabilityAt(state, 0), .5); close(probabilityAt(state, 3), .5);
  close(blochVector(state, 0).purity, .5);
  const measured = measureQubit(state, 0, .1);
  assert.equal(measured.outcome, 1); close(probabilityAt(measured.state, 3), 1);
  const cz = evolveGate(state, gate('CZ', 0, { target: 1 })); close(cz[6], -Math.SQRT1_2);
});

test('terminal measurement uses backend counts, ordering, and deterministic replay', () => {
  const circuit = { qubits: 2, gates: [gate('CX', 0, { id: 2, column: 1, target: 1 }), gate('H')] };
  const observed = { ...result, counts: { '00': 40, '11': 60 } };
  const a = buildPlayback(circuit, observed), b = buildPlayback(circuit, observed);
  assert.deepEqual(a, b); assert.equal(a.sampleSource, 'backend');
  assert.equal(a.frames[1].gate.type, 'H');
  assert.ok(['00', '11'].includes(a.frames.at(-1).classical));
  assert.equal(a.frames.filter(frame => frame.automatic).length, 2);
  const outcomes = new Set(Array.from({ length: 20 }, (_, replay) => buildPlayback(circuit, observed, replay).frames.at(-1).classical));
  assert.equal(outcomes.size, 2);
});

test('partial and repeated measurements preserve unmeasured amplitudes and classical bit order', () => {
  const circuit = { qubits: 2, gates: [gate('H', 1), gate('M', 0, { id: 2, column: 1 }), gate('M', 0, { id: 3, column: 2 })] };
  const model = buildPlayback(circuit, { ...result, counts: { '00': 100 } });
  assert.equal(model.frames.at(-1).classical, '00');
  close(probabilityAt(model.frames.at(-1).after, 0), .5);
  close(probabilityAt(model.frames.at(-1).after, 2), .5);
});

test('mid-circuit measurement is a local trajectory and later gates still execute', () => {
  const model = buildPlayback({ qubits: 1, gates: [gate('M'), gate('X', 0, { id: 2, column: 1 })] }, result);
  assert.equal(model.hasMidCircuitMeasurement, true); assert.equal(model.sampleSource, 'ideal');
  close(probabilityAt(model.frames.at(-1).after, 1), 1);
  assert.equal(model.frames.at(-1).classical, '0');
});

test('empty, five-qubit and unsupported circuits are bounded and safe', () => {
  const empty = buildPlayback({ qubits: 1, gates: [] }, result);
  assert.equal(empty.frames.at(-1).classical, '0');
  const five = buildPlayback({ qubits: 5, gates: [gate('X', 4)] }, result);
  assert.equal(five.frames.at(-1).classical, '10000');
  assert.match(buildPlayback({ qubits: 6, gates: [] }, result).notice, /1–5/);
  assert.ok(buildPlayback({ qubits: 1, gates: [gate('RX')] }, result).notice);
  assert.ok(buildPlayback({ qubits: 1, gates: [gate('CX', 0, { target: 0 })] }, result).notice);
});
