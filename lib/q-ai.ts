import { learningModules, type LearningModule } from "./curriculum";

export type TutorReply = {
  text: string;
  topic?: LearningModule;
  mode?: "steps" | "quiz";
  demo?: "gates" | "grover";
};

const aliases: Record<string, string[]> = {
  qubits: ["qubit", "qubits", "bloch", "amplitude", "amplitudes"],
  superposition: ["superposition", "interference"],
  measurement: ["measurement", "measure", "measuring", "born rule", "shots", "probability"],
  gates: ["gate", "gates", "unitary", "rotation", "rotations", "pauli"],
  entanglement: ["entanglement", "entangled", "bell", "cnot", "cx", "controlled not"],
  circuits: ["circuit", "circuits", "depth"],
  "deutsch-jozsa": ["deutsch", "jozsa", "balanced", "constant function"],
  grover: ["grover", "search", "oracle", "diffusion", "amplification"],
  teleportation: ["teleportation", "teleport"],
  qft: ["qft", "fourier", "phase estimation"],
  "vqe-qaoa": ["vqe", "qaoa", "variational", "optimization", "hybrid"],
};
const gateDetails: Record<string, string> = {
  h: "H (Hadamard) mixes amplitudes: |0⟩ → (|0⟩ + |1⟩)/√2. Try H below: both measurement outcomes become 50%. Apply H again and interference returns you to |0⟩ with certainty.",
  x: "X is a bit flip: |0⟩ ↔ |1⟩. Try X below and watch the probabilities swap. Applying X twice returns the original state.",
  z: "Z is a phase flip: it leaves |0⟩ unchanged and multiplies the |1⟩ amplitude by −1. Probabilities alone cannot show that sign. Try H → Z → H: the phase change becomes a certain |1⟩ outcome! Compare with H → H.",
  y: "Y combines a bit flip with a phase change: Y|0⟩ = i|1⟩ and Y|1⟩ = −i|0⟩. The complex phase matters when amplitudes interfere. Like X and Z, applying Y twice gives the identity.",
  s: "S adds a quarter-turn of relative phase: S|0⟩ = |0⟩ and S|1⟩ = i|1⟩. Two S gates equal Z. The phase becomes visible through later interference, not a direct computational-basis measurement.",
  t: "T adds a π/4 relative phase to |1⟩ and leaves |0⟩ unchanged. Two T gates equal S. Combined with Clifford gates, T enables universal quantum computation.",
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']s\b/g, "").replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function contains(text: string, phrase: string) {
  return ` ${text} `.includes(` ${normalize(phrase)} `);
}
export function topicForPath(path: string) {
  const slug = path.split("/").filter(Boolean).at(-1);
  return learningModules.find(topic => topic.id === slug);
}

export function getTutorReply(input: string, previousId?: string, path = ""): TutorReply {
  const query = normalize(input);
  const mode = /\b(quiz|test me|challenge me)\b/.test(query) ? "quiz" : /\b(step|steps|walkthrough|walk me)\b/.test(query) ? "steps" : undefined;
  const gate = Object.keys(gateDetails).find(key => contains(query, `${key} gate`) || contains(query, `gate ${key}`) || query === key)
    ?? (contains(query, "hadamard") ? "h" : undefined);
  const ranked = learningModules.map(topic => ({ topic, score: (aliases[topic.id] ?? []).reduce((score, alias) => score + (contains(query, alias) ? alias.length : 0), 0) })).sort((a, b) => b.score - a.score);
  const followUp = /\b(why|simpler|simple|again|example|math|formula|next|this|it|more|quiz|steps|step|walkthrough)\b/.test(query);
  const topic = gate ? learningModules.find(item => item.id === "gates") : ranked[0]?.score > 0 ? ranked[0].topic : followUp ? learningModules.find(item => item.id === previousId) ?? topicForPath(path) : undefined;
  if (!topic) {
    if (/\b(hi|hello|hey)\b/.test(query)) return { text: "Hi! I’m q-ai, your interactive quantum study companion. Pick a concept, experiment with gates, or ask for a walkthrough. What would you like to explore?" };
    if (/\balgorithms?\b/.test(query)) return { text: "Let’s work through an algorithm together. Try Grover for search, Deutsch–Jozsa for interference, QFT for phases, teleportation, or VQE/QAOA for hybrid optimization. Choose one, then ask for steps or a quiz." };
    return { text: "I don’t have a guided explanation for that yet. I can help with H/X/Y/Z/S/T gates, entanglement, qubits, measurement, circuits, Grover, Deutsch–Jozsa, QFT, teleportation, and VQE/QAOA. Name a topic and we’ll explore it together." };
  }
  const demo = ["gates", "superposition", "qubits", "measurement"].includes(topic.id) ? "gates" : topic.id === "grover" ? "grover" : undefined;
  const text = mode === "quiz" ? `Let’s check your understanding of ${topic.title.toLowerCase()}. Choose an answer below.`
    : mode === "steps" ? `Let’s build up ${topic.title.toLowerCase()}, one step at a time.`
    : gate ? gateDetails[gate]
    : /\b(math|formula)\b/.test(query) ? `${topic.math}\n\n${topic.keyPoints.join("\n")}`
    : /\bwhy\b/.test(query) ? `${topic.why}\n\nKeep in mind: ${topic.keyPoints[0]}`
    : /\b(simple|simpler)\b/.test(query) ? `${topic.summary}\n\nStart here: ${topic.steps[0]}\n\n${topic.keyPoints[0]}`
    : `${topic.concept}\n\n${topic.keyPoints[0]}`;
  return { text, topic, mode, demo: mode ? undefined : demo };
}

export function applyTutorGate(state: [number, number], gate: "H" | "X" | "Z"): [number, number] {
  const [a, b] = state;
  if (gate === "X") return [b, a];
  if (gate === "Z") return [a, -b];
  return [(a + b) / Math.SQRT2, (a - b) / Math.SQRT2];
}
export function groverProbability(iterations: number) {
  return Math.sin((2 * iterations + 1) * Math.asin(1 / 2)) ** 2;
}
