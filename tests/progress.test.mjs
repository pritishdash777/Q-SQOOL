import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProgressSession } from '../lib/progress-sync.ts';
import { createEmptyProgress, mergeProgress, remoteProgress, normalizeProgress, getLocalProgress, saveLocalProgress, lessonPath } from '../lib/progress-storage.ts';
import { safeNextPath } from '../lib/navigation.ts';

const record = (module_id, lessons = [module_id], progress = 100) => ({
  module_id, completed_lessons: lessons, progress, completed: progress === 100, quiz_score: null, updated_at: '2026-01-01',
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture({ local = createEmptyProgress('A'), records = [] } = {}) {
  const calls = [], writes = [], publications = [];
  const api = {
    getLocalProgress: () => structuredClone(local),
    saveLocalProgress: (id, progress) => { writes.push([id, structuredClone(progress)]); return true; },
    getCurrentUser: async () => ({ id: local.userId }),
    getProfile: async () => ({}),
    getProgress: async () => records,
    saveProgress: async (progress, options) => {
      calls.push({ progress, options });
      return { xp: progress.xp, modules: Object.values(progress.modules).map(module => record(module.moduleId, module.completedLessons, module.percent)) };
    },
  };
  api.getProgressSummary = async options => ({ modules: await api.getProgress(options), last_visited_path: (await api.getProfile(options)).last_visited_path, activity_days: [] });
  const session = new ProgressSession(local.userId, local.userId === 'guest' ? null : 'token-A', state => publications.push(state), api);
  return { session, api, calls, writes, publications };
}

test('guest progress never requests protected endpoints', async () => {
  const f = fixture({ local: createEmptyProgress('guest') });
  for (const key of ['getCurrentUser', 'getProfile', 'getProgress', 'saveProgress']) f.api[key] = () => assert.fail(key);
  await f.session.refresh();
  f.session.update('qubits', { completed: true, percent: 100, completedLessons: ['qubits'] });
  await f.session.flush();
  assert.equal(f.session.state.syncStatus, 'local');
  assert.equal(f.session.state.progress.xp, 100);
  f.session.stop();
});

test('initial empty cache loads saved progress without PUT', async () => {
  const f = fixture({ records: [record('qubits')] });
  await f.session.refresh();
  assert.equal(f.session.state.progress.xp, 100);
  assert.equal(f.session.state.progress.modules.qubits.completed, true);
  assert.equal(f.calls.length, 0);
  f.session.stop();
});

test('merge unions stable lesson IDs regardless of timestamps and rejects account mixing', () => {
  const local = remoteProgress('A', [record('qubits', ['qubits:step-1'], 23)]);
  const remote = remoteProgress('A', [record('qubits', ['qubits:step-2'], 47)]);
  local.updatedAt = '2099-01-01'; remote.updatedAt = '2000-01-01';
  const merged = mergeProgress(local, remote);
  assert.deepEqual(merged.modules.qubits.completedLessons, ['qubits:step-1', 'qubits:step-2']);
  assert.equal(merged.modules.qubits.percent, 47);
  assert.throws(() => mergeProgress(local, createEmptyProgress('B')), /across accounts/);
});

test('previously local-only completions are uploaded before reporting synced', async () => {
  const f = fixture({ local: remoteProgress('A', [record('qubits')]) });
  await f.session.refresh();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].options.token, 'token-A');
  assert.equal(f.session.state.syncStatus, 'synced');
  f.session.stop();
});

test('logout cancels a debounced save and preserves pending cache', async () => {
  const f = fixture(); await f.session.refresh();
  f.session.update('qubits', { completed: true, percent: 100 });
  f.session.stop();
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.equal(f.calls.length, 0);
  assert.equal(f.writes.at(-1)[1].pendingSync, true);
});

test('late save from account A cannot acknowledge or publish after switching to B', async () => {
  const f = fixture(); await f.session.refresh();
  const request = deferred(); f.api.saveProgress = () => request.promise;
  f.session.update('qubits', { completed: true, percent: 100 });
  const saving = f.session.flush(); f.session.stop();
  const count = f.publications.length;
  const b = fixture({ local: createEmptyProgress('B') }); await b.session.refresh();
  request.resolve({ xp: 100, modules: [record('qubits')] }); await saving;
  assert.equal(f.publications.length, count);
  assert.equal(f.writes.at(-1)[1].pendingSync, true);
  assert.deepEqual(b.session.state.progress.modules, {});
  b.session.stop();
});

test('acknowledging an older save retains edits made in flight', async () => {
  const f = fixture(); await f.session.refresh();
  const first = deferred(), second = deferred(); let count = 0;
  f.api.saveProgress = () => ++count === 1 ? first.promise : second.promise;
  f.session.update('qubits', { completedLessons: ['qubits:step-1'], percent: 23 });
  const saving = f.session.flush();
  f.session.update('qubits', { completedLessons: ['qubits:step-2'], percent: 47 });
  first.resolve({ xp: 0, modules: [record('qubits', ['qubits:step-1'], 23)] }); await tick();
  assert.equal(count, 2);
  assert.equal(f.session.state.progress.pendingSync, true);
  assert.deepEqual(f.session.state.progress.modules.qubits.completedLessons, ['qubits:step-1', 'qubits:step-2']);
  second.resolve({ xp: 0, modules: [record('qubits', ['qubits:step-1', 'qubits:step-2'], 47)] }); await saving;
  assert.equal(f.session.state.progress.pendingSync, false);
  f.session.stop();
});

test('offline cached progress remains available and retries without losing completions', async () => {
  const local = remoteProgress('A', [record('qubits')]); local.pendingSync = true;
  const f = fixture({ local });
  f.api.getCurrentUser = async () => { throw new Error('offline'); };
  await f.session.refresh();
  assert.equal(f.session.state.progress.xp, 100);
  assert.equal(f.session.state.progress.pendingSync, true);
  assert.equal(f.session.state.syncStatus, 'offline');
  f.api.getCurrentUser = async () => ({ id: 'A' });
  f.api.getProgress = async () => [record('gates')];
  await f.session.refresh();
  assert.equal(f.session.state.progress.xp, 200);
  assert.equal(f.session.state.syncStatus, 'synced');
  f.session.stop();
});

test('duplicate completion and corrupt XP do not inflate rewards', () => {
  const progress = remoteProgress('A', [record('qubits', ['qubits', 'qubits'])]);
  progress.xp = 999999;
  assert.equal(normalizeProgress(progress).xp, 100);
  assert.equal(mergeProgress(progress, progress).completedModules, 1);
});

test('browser caches are scoped and legacy shared progress stays guest-only', () => {
  globalThis.window = {};
  const storage = new Map([['q-sqool-learning', JSON.stringify({ progress: { qubits: 100 } })]]);
  globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  assert.equal(getLocalProgress('guest').xp, 100);
  assert.equal(getLocalProgress('A').xp, 0);
  assert.equal(saveLocalProgress('B', remoteProgress('A', [record('qubits')])), false);
  assert.equal(getLocalProgress('B').xp, 0);
});

test('resume and auth redirects accept existing local routes only', () => {
  assert.equal(lessonPath('/learn/qubits'), '/learn/qubits');
  for (const path of ['/learn/missing', '//evil.test', '/module-2/lesson-1']) assert.equal(lessonPath(path), '/learn');
  for (const path of ['//evil.test', '/\\evil.test', 'https://evil.test', '/login', '/learn/missing']) assert.equal(safeNextPath(path), '/dashboard');
  assert.equal(safeNextPath('/composer'), '/composer');
});
