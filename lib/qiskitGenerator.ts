import { QuantumGateNode } from './quantumSimulator';

/**
 * Generates an executable Qiskit Python script directly from the visual circuit state.
 */
export function generateQiskitCode(numWires: number, gates: QuantumGateNode[]): string {
  let code = `from qiskit import QuantumCircuit, Aer, execute\n\n`;
  code += `# Initialize a quantum circuit with ${numWires} qubits and ${numWires} classical bits\n`;
  code += `qc = QuantumCircuit(${numWires}, ${numWires})\n\n`;

  // Sort gates chronologically left-to-right
  const sortedGates = [...gates].sort((a, b) => a.stepIndex - b.stepIndex);

  if (sortedGates.length === 0) {
    code += `# Add gates to see Qiskit code update in real-time\n`;
  } else {
    sortedGates.forEach((node) => {
      switch (node.gate) {
        case 'H':
          code += `qc.h(${node.wireIndex})\n`;
          break;
        case 'X':
          code += `qc.x(${node.wireIndex})\n`;
          break;
        case 'Z':
          code += `qc.z(${node.wireIndex})\n`;
          break;
        case 'CX':
          if (node.targetWireIndex !== undefined) {
            code += `qc.cx(${node.wireIndex}, ${node.targetWireIndex})\n`;
          }
          break;
      }
    });
  }

  code += `\n# Measure all qubits\n`;
  code += `qc.measure(range(${numWires}), range(${numWires}))\n`;

  return code;
}