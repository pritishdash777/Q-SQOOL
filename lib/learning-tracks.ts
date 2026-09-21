export const learningTracks = {
  Student: {
    role: "Student", title: "Understand it, then build it", focus: "Build strong foundations",
    description: "Start with a single qubit, make predictions, and use small circuits to explain what you observe.",
    order: ["qubits", "superposition", "gates", "measurement", "entanglement", "circuits", "deutsch-jozsa", "grover", "teleportation", "qft", "vqe-qaoa"],
    task: "Predict every XOR input pair before running the circuit.", experiment: "/experiments/xor", action: "Start the XOR experiment",
  },
  Researcher: {
    role: "Researcher", title: "Follow the amplitudes and the evidence", focus: "Explore theory and experiments",
    description: "Prioritise entanglement, phase and measurement. Derive a prediction, test it, then explain the assumptions behind the result.",
    order: ["entanglement", "qft", "measurement", "superposition", "teleportation", "deutsch-jozsa", "qubits", "gates", "grover", "circuits", "vqe-qaoa"],
    task: "Prepare a Bell state, then change its relative phase. Explain why the probabilities can stay the same.", experiment: "/challenges", action: "Investigate a Bell pair",
  },
  Professional: {
    role: "Professional", title: "Turn concepts into working circuits", focus: "Apply quantum workflows",
    description: "Focus on circuit design, search and hybrid optimisation. Compare assumptions, implementation cost and practical limitations.",
    order: ["circuits", "vqe-qaoa", "grover", "gates", "measurement", "qubits", "superposition", "entanglement", "qft", "teleportation", "deutsch-jozsa"],
    task: "Build a small circuit, export its code, and ask q-ai to review the gate order and resource costs.", experiment: "/composer", action: "Build in the Composer",
  },
};
export function learningTrack(role: string) {
  return learningTracks[role as keyof typeof learningTracks] ?? learningTracks.Student;
}
