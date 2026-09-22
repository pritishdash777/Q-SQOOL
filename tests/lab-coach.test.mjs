import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProposal, labContextSchema } from '../lib/lab-coach.ts';
import { createChatHandler } from '../lib/q-ai-server.ts';
import { generateCode, parseCode } from '../lib/circuit-code.ts';
import { simulateCircuit } from '../lib/api.ts';

const circuit = { qubits: 2, gates: [{ id: 1, type: 'X', qubit: 0, column: 0 }, { id: 2, type: 'CX', qubit: 0, target: 1, column: 1 }] };
const context = { circuit, level: 'Beginner', completedModules: ['qubits'], result: { simulator: 'cirq', counts: { '11': 32 } } };
test('coach validates proposals and rejects invalid controls and excessive qubit counts', () => {
  assert.deepEqual(extractProposal('Try this.\n```circuit\n' + JSON.stringify(circuit) + '\n```').proposal, circuit);
  for (const bad of [{ ...circuit, qubits: 6 }, { qubits: 2, gates: [{ id: 1, type: 'CX', qubit: 0, target: 0, column: 0 }] }]) {
    assert.equal(extractProposal('```circuit\n' + JSON.stringify(bad) + '\n```').proposal, undefined);
  }
  assert.match(extractProposal('```circuit\nnot json\n```').text, /failed validation/);
  assert.equal(labContextSchema.safeParse(context).success, true);
});
test('coach server supplies current circuit/result/progress and returns an applicable proposal', async () => {
  const handler = createChatHandler({ config: () => ({ apiKey: 'test', model: 'test' }), fetch: async (_url, options) => {
    const sent = JSON.parse(options.body);
    assert.match(sent.messages[0].content, /"simulator":"cirq"/);
    assert.match(sent.messages[0].content, /"completedModules":\["qubits"\]/);
    return Response.json({ choices: [{ message: { content: 'Predict the target.\n```circuit\n' + JSON.stringify(circuit) + '\n```' }, finish_reason: 'stop' }] });
  } });
  const response = await handler(new Request('https://test.example/api/q-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Build XOR' }], lab: context }) }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).proposal, circuit);
});
test('PennyLane export includes executable gate and measurement semantics and never imports arbitrary Python', () => {
  const code = generateCode(circuit, 'PennyLane');
  assert.match(code, /qml.PauliX\(wires=0\)/);
  assert.match(code, /qml.CNOT\(wires=\[0, 1\]\)/);
  assert.match(code, /wires = \[1,0\]/);
  assert.match(code, /Counter/);
  assert.equal(parseCode(code, 'PennyLane').circuit, undefined);
  assert.match(parseCode(code, 'PennyLane').warning, /not supported/);
});
test('selected SDK is sent and mismatched backend responses are rejected', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(JSON.parse(options.body).simulator, 'cirq');
      return Response.json({ success: true, simulator: 'cirq', shots: 8, counts: { '11': 8 } });
    };
    assert.deepEqual((await simulateCircuit(circuit, 8, undefined, 'cirq')).probabilities, { '11': 1 });
    globalThis.fetch = async () => Response.json({ success: true, simulator: 'qiskit_aer', shots: 8, counts: { '11': 8 } });
    await assert.rejects(simulateCircuit(circuit, 8, undefined, 'pennylane'), /invalid simulation counts/);
  } finally { globalThis.fetch = original; }
});
test('structured JSON responses extract circuit proposals without exposing raw JSON', () => {
  assert.deepEqual(extractProposal(JSON.stringify({ text: 'Predict the target.', circuit })), { text: 'Predict the target.', proposal: circuit });
  assert.deepEqual(extractProposal(JSON.stringify({ text: 'Try changing the input.', circuit: null })), { text: 'Try changing the input.' });
  assert.equal(extractProposal(JSON.stringify({ text: 'Invalid proposal.', circuit: { qubits: 8, gates: [] } })).proposal, undefined);
});
