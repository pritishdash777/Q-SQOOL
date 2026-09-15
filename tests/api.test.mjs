import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestJSON } from '../lib/api.ts';
import { getProgress, saveProgress, getStoredToken } from '../lib/auth-api.ts';
import { createEmptyProgress } from '../lib/progress-storage.ts';

const storage = new Map();
globalThis.window = new EventTarget();
globalThis.sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };

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
