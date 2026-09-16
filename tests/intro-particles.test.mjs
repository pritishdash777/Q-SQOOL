import test from 'node:test';
import assert from 'node:assert/strict';
import { startIntroParticles } from '../components/landing/intro-particles.ts';

test('intro particles finish, resize safely, and release animation resources', () => {
  for (const mobile of [false, true]) {
    let callback, completed = 0, arcs = 0;
    const listeners = new Map();
    const originals = new Map();
    const install = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); };
    install('matchMedia', () => ({ matches: mobile }));
    install('innerWidth', mobile ? 390 : 1440); install('innerHeight', 844); install('devicePixelRatio', 3);
    install('document', { documentElement: { dataset: { theme: mobile ? 'light' : 'dark' } } });
    install('window', { addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) });
    install('requestAnimationFrame', fn => { callback = fn; return 1; });
    install('cancelAnimationFrame', () => { callback = undefined; });
    install('performance', { now: () => 0 });
    const ctx = { setTransform() {}, clearRect() {}, beginPath() {}, arc() { arcs++; }, fill() {} };
    const canvas = { getContext: () => ctx };
    try {
      const stop = startIntroParticles(canvas, () => completed++);
      assert.equal(canvas.width, (mobile ? 390 : 1440) * 2);
      listeners.get('resize')();
      callback(2400);
      assert.equal(arcs, mobile ? 72 : 160);
      callback(4001);
      assert.equal(completed, 1);
      assert.equal(callback, undefined);
      assert.equal(listeners.size, 0);
      stop(); // Repeated cleanup is safe.
      const cancel = startIntroParticles(canvas, () => completed++);
      cancel();
      assert.equal(callback, undefined);
      assert.equal(listeners.size, 0);
      assert.equal(completed, 1);
      startIntroParticles({ getContext: () => null }, () => completed++);
      assert.equal(completed, 2);
    } finally {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  }
});
