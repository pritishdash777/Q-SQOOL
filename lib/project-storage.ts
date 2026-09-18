import type { Circuit, LocalProject } from './quantum-types';

const gates = new Set(['X', 'Y', 'Z', 'H', 'S', 'T', 'RX', 'RY', 'RZ', 'CX', 'CZ', 'M']);

export function isCircuit(value: unknown): value is Circuit {
  if (!value || typeof value !== 'object') return false;
  const circuit = value as Circuit;
  if (!Number.isInteger(circuit.qubits) || circuit.qubits < 1 || circuit.qubits > 5 || !Array.isArray(circuit.gates)) return false;
  const ids = new Set<number>();
  return circuit.gates.every(gate => {
    if (!gate || !Number.isInteger(gate.id) || ids.has(gate.id) || !gates.has(gate.type) ||
      !Number.isInteger(gate.qubit) || gate.qubit < 0 || gate.qubit >= circuit.qubits ||
      !Number.isInteger(gate.column) || gate.column < 0) return false;
    ids.add(gate.id);
    if (gate.type === 'CX' || gate.type === 'CZ') {
      if (!Number.isInteger(gate.target) || gate.target! < 0 || gate.target! >= circuit.qubits || gate.target === gate.qubit) return false;
    }
    return gate.angle === undefined || Number.isFinite(gate.angle);
  });
}

export function projectStorageKey(userId: string): string {
  return `q-sqool-projects:v2:${userId}`;
}

export function readLocalProjects(storage: Pick<Storage, 'getItem'>, userId: string): LocalProject[] {
  const saved = storage.getItem(projectStorageKey(userId));
  // Legacy projects have no account owner. Never adopt them into a signed-in account.
  const raw = saved ?? (userId === 'guest' ? storage.getItem('q-sqool-projects') : null);
  const projects: unknown = JSON.parse(raw || '[]');
  if (!Array.isArray(projects)) throw new Error('Local project data could not be read.');
  return projects.filter((project): project is LocalProject =>
    project && !project.cloudId && (typeof project.id === 'string' || typeof project.id === 'number') &&
    typeof project.name === 'string' && typeof project.updatedAt === 'string' && isCircuit(project.circuit) &&
    Array.isArray(project.versions) && project.versions.every((version: { circuit?: unknown }) => version && isCircuit(version.circuit))
  );
}

export function copyLocalProject(project: Pick<LocalProject, 'name' | 'circuit'>, label = 'Copy'): LocalProject {
  const now = new Date().toISOString();
  const circuit = structuredClone(project.circuit);
  return {
    id: crypto.randomUUID(), name: `${project.name} (${label})`.slice(0, 100), updatedAt: now, circuit,
    versions: [{ id: Date.now(), savedAt: now, circuit }],
  };
}
