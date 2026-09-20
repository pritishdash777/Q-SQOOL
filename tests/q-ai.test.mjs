import test from 'node:test';
import assert from 'node:assert/strict';
import { getTutorReply, applyTutorGate, groverProbability } from '../lib/q-ai.ts';

test('phase becomes observable through interference', () => {
  const state = ['H', 'Z', 'H'].reduce(applyTutorGate, [1, 0]);
  assert.ok(Math.abs(state[0]) < 1e-12);
  assert.ok(Math.abs(state[1] ** 2 - 1) < 1e-12);
  const twice = ['H', 'H'].reduce(applyTutorGate, [1, 0]);
  assert.ok(Math.abs(twice[0] ** 2 - 1) < 1e-12);
});
test('Grover overshoots after the optimal iteration for four candidates', () => {
  assert.ok(Math.abs(groverProbability(0) - 0.25) < 1e-12);
  assert.ok(Math.abs(groverProbability(1) - 1) < 1e-12);
  assert.ok(Math.abs(groverProbability(2) - 0.25) < 1e-12);
});
test('recognizes gates and preserves topic for follow-up requests', () => {
  assert.match(getTutorReply('How does an H gate work?').text, /Hadamard/);
  assert.equal(getTutorReply('Grover’s algorithm').demo, 'grover');
  const quiz = getTutorReply('Quiz me', 'grover');
  assert.equal(quiz.mode, 'quiz');
  assert.equal(quiz.topic.id, 'grover');
  assert.equal(getTutorReply('Step by step', undefined, '/learn/entanglement').topic.id, 'entanglement');
  assert.equal(getTutorReply('Tell me about measurement', 'grover').topic.id, 'measurement');
});
test('unsupported questions do not pretend to be answered', () => {
  assert.equal(getTutorReply('What is the weather?', 'grover').topic, undefined);
  assert.match(getTutorReply('What is the weather?').text, /don’t have a guided explanation/);
});

test('XOR questions hand off to an interactive experiment', () => {
  assert.equal(getTutorReply('How do I solve XOR with a quantum circuit?').experiment, 'xor');
  assert.equal(getTutorReply('Explain exclusive OR').experiment, 'xor');
});
