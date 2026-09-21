import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendedModules } from '../lib/learning-summary.ts';
import { createEmptyProgress } from '../lib/progress-storage.ts';
import { learningTrack } from '../lib/learning-tracks.ts';
const ids = (progress, role, score) => recommendedModules(progress, role, score).map(module => module.id);
test('switching role changes recommendations immediately for a new learner', () => {
  const progress = createEmptyProgress('guest');
  assert.deepEqual(ids(progress, 'Student'), ['qubits', 'superposition', 'gates']);
  assert.deepEqual(ids(progress, 'Researcher'), ['entanglement', 'qft', 'measurement']);
  assert.deepEqual(ids(progress, 'Professional'), ['circuits', 'vqe-qaoa', 'grover']);
  assert.equal(progress.xp, 0);
});
test('assessment adds foundations without erasing role differences', () => {
  const p = createEmptyProgress('guest');
  assert.equal(ids(p, 'Researcher', 0)[0], 'qubits');
  assert.equal(ids(p, 'Professional', 0)[0], 'qubits');
  assert.notDeepEqual(ids(p, 'Researcher', 0), ids(p, 'Professional', 0));
});
test('recorded completed lessons are excluded and unfinished work can resume', () => {
  const p = createEmptyProgress('guest');
  p.modules.qubits = { completed: true, percent: 100 };
  p.modules.measurement = { completed: false, percent: 30 };
  assert.ok(!ids(p, 'Student').includes('qubits'));
  assert.equal(ids(p, 'Student')[0], 'measurement');
  assert.equal(learningTrack('unknown').role, 'Student');
});
