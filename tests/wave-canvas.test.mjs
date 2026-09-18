import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as model from '../lib/quantum-playback.ts';

test('wave renderer supports mobile, all views, reduced motion, visibility and cleanup', () => {
  const source = ts.transpileModule(readFileSync(new URL('../components/quantum-playback/WaveCanvas.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const width of [340, 1000]) for (const view of ['Waves', 'Amplitudes', 'Bloch']) for (const still of [false, true]) {
    const effects = [], listeners = new Map(), frames = new Map();
    let intersect, nextId = 1, disconnected = 0, advances = 0;
    const ctx = new Proxy({}, { get: (_, name) => name === 'createRadialGradient' ? () => ({ addColorStop() {} }) : (...args) => {
      for (const arg of args) if (typeof arg === 'number') assert.ok(Number.isFinite(arg), `Nonfinite ${String(name)}`);
    }, set: () => true });
    const element = { getContext: () => ctx, getBoundingClientRect: () => ({ width, height: 410 }), dispatchEvent: event => listeners.get(event.type)?.(),
      addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: event => listeners.delete(event) };
    const document = { hidden: false, addEventListener: (event, fn) => listeners.set(event, fn), removeEventListener: event => listeners.delete(event) };
    const sandbox = { exports: {}, document, devicePixelRatio: 3, Float64Array, Event,
      require: name => name === 'react' ? { useRef: value => ({ current: value === null ? element : value }), useEffect: fn => effects.push(fn) } : name === 'react/jsx-runtime' ? { jsx: () => null } : model,
      requestAnimationFrame: fn => { const id = nextId++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
      ResizeObserver: class { observe() {} disconnect() { disconnected++; } },
      IntersectionObserver: class { constructor(fn) { intersect = fn; } observe() {} disconnect() { disconnected++; } },
    };
    vm.runInNewContext(source, sandbox);
    const playback = model.buildPlayback({ qubits: 2, gates: [{ id: 1, type: 'H', qubit: 0, column: 0 }] }, { name: '', note: '', probabilities: {} });
    sandbox.exports.WaveCanvas({ frame: playback.frames[1], qubits: 2, view, page: 0, playing: true, speed: 1, still, onAdvance: () => advances++ });
    const cleanup = effects.map(fn => fn()).filter(Boolean);
    assert.equal(frames.size, 0, 'offscreen initialization does not animate');
    intersect([{ isIntersecting: true }]);
    const tick = time => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); };
    tick(1);
    assert.equal(element.width, width * 2, 'pixel ratio is capped');
    if (still) assert.equal(frames.size, 0, 'reduced motion draws once');
    else { for (let i = 1; i < 50; i++) tick(i * 50 + 1); assert.ok(advances > 0); }
    document.hidden = true; listeners.get('visibilitychange')(); assert.equal(frames.size, 0);
    document.hidden = false; listeners.get('visibilitychange')(); assert.equal(frames.size, 1);
    intersect([{ isIntersecting: false }]); assert.equal(frames.size, 0);
    cleanup.forEach(fn => fn()); assert.equal(listeners.size, 0); assert.equal(disconnected, 2);
  }
});
