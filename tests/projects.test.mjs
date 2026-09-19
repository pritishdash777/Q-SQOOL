import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyLocalProject, isCircuit, projectStorageKey, readLocalProjects } from '../lib/project-storage.ts';

const circuit = { qubits: 2, gates: [{ id: 1, type: 'H', qubit: 0, column: 0 }] };
const local = { id: 1, name: 'Bell', circuit, versions: [], updatedAt: '2026-09-18' };

test('local project caches are account scoped and legacy cloud links are never adopted', () => {
  const values = new Map([
    ['q-sqool-projects', JSON.stringify([local, { ...local, id: 2, cloudId: 'someone-elses-project' }])],
    [projectStorageKey('A'), JSON.stringify([{ ...local, name: 'Private A' }])],
  ]);
  const storage = { getItem: key => values.get(key) ?? null };
  assert.deepEqual(readLocalProjects(storage, 'guest'), [local]);
  assert.equal(readLocalProjects(storage, 'A')[0].name, 'Private A');
  assert.deepEqual(readLocalProjects(storage, 'B'), []);
  values.set(projectStorageKey('guest'), '[]');
  assert.deepEqual(readLocalProjects(storage, 'guest'), []); // Deleted legacy drafts stay deleted.
});

test('duplicates and forks have independent circuits and no cloud identity or permissions', () => {
  const shared = { ...local, cloudId: 'original', permission: 'view' };
  const copy = copyLocalProject(shared);
  const fork = copyLocalProject(shared, 'Fork');
  assert.notEqual(copy.id, fork.id);
  assert.equal(copy.cloudId, undefined);
  assert.equal(copy.permission, undefined);
  copy.circuit.gates[0].type = 'X';
  assert.equal(shared.circuit.gates[0].type, 'H');
  assert.equal(fork.circuit.gates[0].type, 'H');
});

test('imports reject malformed circuits, invalid wires, duplicate IDs and unknown gates', () => {
  assert.equal(isCircuit(circuit), true);
  assert.equal(isCircuit({ qubits: 5, gates: [] }), true);
  for (const invalid of [null, {}, { qubits: 0, gates: [] }, { qubits: 6, gates: [] },
    { ...circuit, gates: [null] }, { ...circuit, gates: [...circuit.gates, ...circuit.gates] },
    { ...circuit, gates: [{ ...circuit.gates[0], type: 'UNKNOWN' }] },
    { ...circuit, gates: [{ ...circuit.gates[0], qubit: 2 }] },
    { ...circuit, gates: [{ ...circuit.gates[0], type: 'CX', target: 0 }] },
    { ...circuit, gates: [{ ...circuit.gates[0], angle: Infinity }] },
  ]) assert.equal(isCircuit(invalid), false);
});
