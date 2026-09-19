import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestJSON } from '../lib/api.ts';
import { getProgress, saveProgress, getStoredToken } from '../lib/auth-api.ts';
import { createEmptyProgress } from '../lib/progress-storage.ts';
import { loginWithGoogle, createGoogleChallenge, getGoogleSignInConfig, AUTH_CHANGED } from '../lib/auth-api.ts';

const storage = new Map();
globalThis.window = new EventTarget();
globalThis.sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };

test('Google sign-in works for guests, persists app auth and sends no bearer token to public endpoints', async () => {
  storage.clear();
  let authChanges = 0;
  const changed = () => authChanges++;
  window.addEventListener(AUTH_CHANGED, changed);
  const response = { access_token: 'google-app-session', token_type: 'bearer', user: { id: 'google-user', email: 'user@gmail.com', is_active: true }, is_new_user: true };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.equal(options.headers?.Authorization, undefined);
    return new Response(JSON.stringify(url.endsWith('/config') ? { enabled: true } : url.endsWith('/challenge') ? { client_id: 'client-id', nonce: 'nonce', expires_in: 300 } : response));
  };
  try {
    assert.equal((await getGoogleSignInConfig()).enabled, true);
    assert.equal((await createGoogleChallenge()).nonce, 'nonce');
    assert.deepEqual(await loginWithGoogle({ credential: 'id-token', nonce: 'nonce' }), response);
    assert.equal(getStoredToken(), 'google-app-session');
    assert.deepEqual(JSON.parse(calls[2].options.body), { credential: 'id-token', nonce: 'nonce' });
    assert.equal(authChanges, 1);
    assert.ok(![...storage.values()].some(value => value.includes('id-token')));
  } finally { window.removeEventListener(AUTH_CHANGED, changed); }
});

test('Google linking and verification failures never replace the current session', async () => {
  storage.set('q-sqool-access-token', 'existing');
  for (const status of [409, 401, 403, 503]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Google failure' }), { status });
    await assert.rejects(loginWithGoogle({ credential: 'token', nonce: 'nonce' }), error => error.status === status);
    assert.equal(getStoredToken(), 'existing');
  }
});

test('a late Google response cannot override a newer session or an aborted login', async () => {
  const data = { access_token: 'google-session', user: { id: 'google-user' }, is_new_user: false };
  for (const cancel of [false, true]) {
    storage.set('q-sqool-access-token', 'A');
    let finish;
    globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
    const controller = new AbortController();
    const pending = loginWithGoogle({ credential: 'token', nonce: 'nonce' }, controller.signal);
    if (cancel) controller.abort();
    else storage.set('q-sqool-access-token', 'B');
    finish(new Response(JSON.stringify(data)));
    await assert.rejects(pending);
    assert.equal(getStoredToken(), cancel ? 'A' : 'B');
  }
});

test('protected API helpers never send guest requests or saves with stale credentials', async () => {
  globalThis.fetch = () => assert.fail('fetch must not be called');
  storage.clear();
  await assert.rejects(getProgress(), /session changed/);
  storage.set('q-sqool-access-token', 'B');
  await assert.rejects(saveProgress(createEmptyProgress('A'), { token: 'A' }), /session changed/);
});

test('a delayed 401 for A cannot log B out', async () => {
  storage.set('q-sqool-access-token', 'A');
  let finish;
  globalThis.fetch = (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer A');
    return new Promise(resolve => { finish = resolve; });
  };
  const pending = getProgress({ token: 'A' });
  storage.set('q-sqool-access-token', 'B');
  finish(new Response(JSON.stringify({ detail: 'Expired' }), { status: 401 }));
  await assert.rejects(pending, /Expired/);
  assert.equal(getStoredToken(), 'B');
});

test('timeouts and cancellation include reading the response body', async () => {
  globalThis.fetch = (_url, { signal }) => Promise.resolve({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  });
  const keepAlive = setTimeout(() => {}, 1000);
  try { await assert.rejects(requestJSON('/test', {}, 10), /did not respond in time/); }
  finally { clearTimeout(keepAlive); }
  const controller = new AbortController();
  const pending = requestJSON('/test', { signal: controller.signal });
  await Promise.resolve(); controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
});

test('project and collaborator helpers preserve authorization, payloads and empty deletion responses', async () => {
  const { createProject, updateProject, deleteProject, addCollaborator, getCollaborators, removeCollaborator } = await import('../lib/auth-api.ts');
  storage.set('q-sqool-access-token', 'projects-token');
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return options.method === 'DELETE' ? new Response(null, { status: 204 }) : new Response(JSON.stringify({ id: 'project-1' }));
  };
  const circuit = { qubits: 1, gates: [] };
  await createProject('Example', circuit);
  await updateProject('project-1', { name: 'Renamed', circuit_json: circuit });
  await addCollaborator('project-1', 'user@example.com', 'view');
  await getCollaborators('project-1');
  assert.equal(await removeCollaborator('project-1', 42), undefined);
  assert.equal(await deleteProject('project-1'), undefined);
  assert.equal(calls.length, 6);
  for (const call of calls) assert.equal(call.options.headers.Authorization, 'Bearer projects-token');
  assert.deepEqual(JSON.parse(calls[1].options.body), { name: 'Renamed', circuit_json: circuit });
  assert.deepEqual(JSON.parse(calls[2].options.body), { email: 'user@example.com', permission: 'view' });
  assert.ok(calls[4].url.endsWith('/api/projects/project-1/collaborators/42'));
  globalThis.fetch = () => assert.fail('stale project mutation must not be sent');
  await assert.rejects(deleteProject('project-1', { token: 'old-account' }), /session changed/);
});
