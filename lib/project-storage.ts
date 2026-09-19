import type { Circuit, LocalProject } from './quantum-types';

import { validateCircuit } from './circuit';

export function isCircuit(value: unknown): value is Circuit { return !validateCircuit(value); }

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
