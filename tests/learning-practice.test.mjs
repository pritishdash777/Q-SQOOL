import test from 'node:test';
import assert from 'node:assert/strict';
import { practiceState, missionFidelity, missions } from '../lib/learning-practice.ts';
const gate = (type, qubit = 0) => ({ type, qubit });
test('missions start unsolved and real circuits solve each target', () => {
  for (const mission of missions) assert.ok(missionFidelity(practiceState([]), mission.target) < 0.999);
  const solutions = [[gate('H')], [gate('H'), gate('Z'), gate('H')], [gate('H'), gate('CX')]];
  solutions.forEach((solution, i) => assert.ok(missionFidelity(practiceState(solution), missions[i].target) > 0.999999));
});
test('Bell grading checks relative phase, not just identical probabilities', () => {
  const wrong = practiceState([gate('H'), gate('CX'), gate('Z')]);
  assert.ok(missionFidelity(wrong, missions[2].target) < 1e-10);
});
test('CX can control either wire and unitary gates preserve normalization', () => {
  assert.deepEqual(practiceState([gate('X', 1), gate('CX', 1)]), [0, 0, 0, 1]);
  const state = practiceState([gate('H', 1), gate('CX', 1), gate('Z'), gate('H')]);
  assert.ok(Math.abs(state.reduce((sum, a) => sum + a * a, 0) - 1) < 1e-10);
});
test('quantum XOR preserves its control and computes the target for all four inputs', () => {
  for (const a of [0, 1]) for (const b of [0, 1]) {
    const gates = [...(a ? [gate('X', 0)] : []), ...(b ? [gate('X', 1)] : []), gate('CX', 0)];
    const state = practiceState(gates);
    assert.equal(state[(a ^ b) * 2 + a], 1);
    assert.deepEqual(practiceState([...gates, gate('CX', 0)]), practiceState(gates.slice(0, -1)));
  }
});
