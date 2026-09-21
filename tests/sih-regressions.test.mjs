import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCode, parseCode } from '../lib/circuit-code.ts';
import { circuitDepth, orderedGates, validateCircuit } from '../lib/circuit.ts';
import { analyseCircuit } from '../lib/circuit-guidance.ts';
import { learningSummary, recommendedModules } from '../lib/learning-summary.ts';
import { createEmptyProgress, mergeProgress, remoteProgress } from '../lib/progress-storage.ts';
import { simulateCircuit } from '../lib/api.ts';
const gate = (id, type, qubit, column, extra = {}) => ({ id, type, qubit, column, ...extra });

test('depth counts dependencies, disjoint gates, targets and measurements, not empty columns', () => {
  assert.equal(circuitDepth({ qubits: 3, gates: [gate(1, 'H', 0, 1), gate(2, 'CX', 0, 3, { target: 1 })] }), 2);
  assert.equal(circuitDepth({ qubits: 3, gates: [gate(1, 'H', 0, 9), gate(2, 'X', 2, 10), gate(3, 'CX', 0, 20, { target: 1 }), gate(4, 'M', 1, 21)] }), 3);
  assert.equal(circuitDepth({ qubits: 1, gates: [] }), 0);
});

for (const sdk of ['Qiskit', 'Cirq', 'OpenQASM']) test(`${sdk} roundtrip preserves full-precision angles, controls, order and repeated measurements`, () => {
  const circuit = { qubits: 3, gates: [gate(9, 'CX', 1, 5, { target: 0 }), gate(2, 'RY', 1, 0, { angle: Math.PI / 7 }), gate(5, 'M', 0, 6), gate(11, 'M', 0, 7), gate(10, 'CZ', 2, 5, { target: 0 }), gate(4, 'RZ', 0, 1, { angle: 1e-8 })] };
  const parsed = parseCode(generateCode(circuit, sdk), sdk);
  assert.equal(parsed.warning, undefined);
  const operation = ({ type, qubit, target, angle }) => ({ type, qubit, target, angle });
  assert.deepEqual(parsed.circuit.gates.map(operation), orderedGates(circuit).map(operation));
});

test('unsupported syntax, remapped readout, partial edits and invalid circuits never yield a partial import', () => {
  const base = generateCode({ qubits: 2, gates: [gate(1, 'H', 0, 0)] }, 'Qiskit');
  for (const extra of ['qc.swap(0, 1)', 'qc.h(1); qc.x(0)', 'qc.rx(pi/2, 0)', 'qc.rx(1e, 0)', 'qc.measure(0, 1)', 'qc.x(7)', 'qc.cx(0, 0)', 'qc.h(']) {
    assert.equal(parseCode(base + '\n' + extra, 'Qiskit').circuit, undefined, extra);
  }
  assert.ok(validateCircuit({ qubits: 6, gates: [] }));
  assert.ok(validateCircuit({ qubits: 1, gates: [gate(1, 'RX', 0, 0)] }));
  assert.ok(validateCircuit({ qubits: 1, gates: [gate(1, 'X', 0, 9999)] }));
  assert.ok(validateCircuit({ qubits: 1, gates: Array.from({ length: 257 }, (_, i) => gate(i, 'X', 0, 0)) }));
});

test('guidance does not remove measurement after a state-changing gate or invent a Bell output', () => {
  const circuit = { qubits: 2, gates: [gate(1, 'M', 0, 0), gate(2, 'X', 0, 1), gate(3, 'M', 0, 2)] };
  assert.equal(analyseCircuit(circuit, 'Detect Errors', 'Technical').after, circuit);
  const reverse = { qubits: 2, gates: [gate(1, 'H', 0, 2), gate(2, 'CX', 0, 0, { target: 1 })] };
  assert.ok(!analyseCircuit(reverse, 'Explain', 'Technical').text.includes('prepare a Bell'));
  assert.ok(analyseCircuit({ qubits: 1, gates: [] }, 'Detect Errors', 'Beginner').text.includes('automatically measures'));
});

test('progress summary uses UTC activity and real completion, and recommendations follow learning tracks', () => {
  const p = createEmptyProgress('A');
  assert.equal(learningSummary(p).streak, 0);
  assert.deepEqual(recommendedModules(p).map(m => m.id), ['qubits', 'superposition', 'gates']);
  p.activityDays = ['2026-09-17', '2026-09-18'];
  assert.equal(learningSummary(p, new Date('2026-09-19T18:29:59Z')).streak, 2);
  assert.equal(learningSummary(p, new Date('2026-09-20T00:00:00Z')).streak, 0);
  p.modules.qubits = { moduleId: 'qubits', completed: true, percent: 100, completedLessons: ['qubits'], updatedAt: '' };
  p.xp = 9999;
  const s = learningSummary(p);
  assert.equal(s.xp, 100); assert.equal(s.mastery, Math.round(100 / s.total));
  assert.deepEqual(recommendedModules(p).map(m => m.id), ['superposition', 'gates', 'measurement']);
});

test('server resume wins over clean stale cache while pending edits retain their destination', () => {
  const local = createEmptyProgress('A'); local.lastVisitedPath = '/learn/qubits';
  const remote = remoteProgress('A', [], '/learn/gates');
  assert.equal(mergeProgress(local, remote).lastVisitedPath, '/learn/gates');
  local.pendingSync = true;
  assert.equal(mergeProgress(local, remote).lastVisitedPath, '/learn/qubits');
});

test('stale simulation responses and invalid/fabricated counts are rejected', async () => {
  const circuit = { qubits: 1, gates: [] };
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const controller = new AbortController();
  const pending = simulateCircuit(circuit, 128, controller.signal);
  controller.abort();
  finish(new Response(JSON.stringify({ success: true, simulator: 'qiskit_aer', shots: 128, counts: { '0': 128 } })));
  await assert.rejects(pending);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, simulator: 'qiskit_aer', shots: 128, counts: { '0': 12 } }));
  await assert.rejects(simulateCircuit(circuit, 128), /invalid simulation counts/);
});
