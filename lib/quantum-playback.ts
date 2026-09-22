import type { Circuit, CircuitGate, DemoResult, GateName } from "./quantum-types";

// Qiskit conventions: q0 is the least-significant bit; rotations use radians.
// Complex amplitudes are interleaved [real0, imaginary0, real1, imaginary1, ...].
export type QuantumState = Float64Array;
export type PlaybackFrame = {
  kind: "initial" | "gate" | "measurement" | "distribution";
  title: string;
  explanation: string;
  before: QuantumState;
  after: QuantumState;
  gate?: CircuitGate;
  automatic?: boolean;
  outcome?: number;
  classical: string;
};
export type PlaybackModel = {
  qubits: number;
  frames: PlaybackFrame[];
  measurementStart: number;
  sampleSource: "backend" | "ideal";
  hasMidCircuitMeasurement: boolean;
  notice?: string;
};
export const MAX_PLAYBACK_QUBITS = 5;
// Bound snapshot memory for circuits much larger than the interactive editor.
export const MAX_PLAYBACK_GATES = 2048;
const EPSILON = 1e-12;
const descriptions: Record<GateName, string> = {
  H: "Add and subtract paired amplitudes: coherent paths can reinforce or cancel.",
  X: "Exchange the amplitudes of basis states that differ at this qubit.",
  Y: "Exchange paired amplitudes with opposite quarter-turn phase shifts.",
  Z: "Turn the phase of the |1⟩ component by π; probabilities stay the same.",
  S: "Turn the phase of the |1⟩ component by π/2; probabilities stay the same.",
  T: "Turn the phase of the |1⟩ component by π/4; probabilities stay the same.",
  RX: "Rotate about X, mixing paired amplitudes with an imaginary coefficient.",
  RY: "Rotate about Y, transferring amplitude between paired basis states.",
  RZ: "Rotate opposite phases on |0⟩ and |1⟩; probabilities stay the same.",
  CX: "Exchange target amplitudes only where the control bit is 1; this can create entanglement.",
  CZ: "Turn phase by π only where both control and target bits are 1.",
  M: "Sample this qubit and renormalize the surviving branches of one ideal shot.",
};

export const basisLabel = (index: number, qubits: number) => index.toString(2).padStart(qubits, "0");
export const probabilityAt = (state: QuantumState, index: number) => state[index * 2] ** 2 + state[index * 2 + 1] ** 2;
export const phaseAt = (state: QuantumState, index: number) => probabilityAt(state, index) < EPSILON ? 0 : Math.atan2(state[index * 2 + 1], state[index * 2]);

export function initialState(qubits: number): QuantumState {
  const state = new Float64Array(2 ** qubits * 2);
  state[0] = 1;
  return state;
}

// Row-major, interleaved complex 2x2 matrix.
export function gateMatrix(type: Exclude<GateName, "M" | "CX" | "CZ">, angle = 0): number[] {
  const c = Math.cos(angle / 2), s = Math.sin(angle / 2), h = Math.SQRT1_2;
  switch (type) {
    case "H": return [h, 0, h, 0, h, 0, -h, 0];
    case "X": return [0, 0, 1, 0, 1, 0, 0, 0];
    case "Y": return [0, 0, 0, -1, 0, 1, 0, 0];
    case "Z": return [1, 0, 0, 0, 0, 0, -1, 0];
    case "S": return [1, 0, 0, 0, 0, 0, 0, 1];
    case "T": return [1, 0, 0, 0, 0, 0, h, h];
    case "RX": return [c, 0, 0, -s, 0, -s, c, 0];
    case "RY": return [c, 0, -s, 0, s, 0, c, 0];
    case "RZ": return [c, -s, 0, 0, 0, 0, c, s];
  }
}

export function evolveGate(state: QuantumState, gate: CircuitGate): QuantumState {
  const next = state.slice();
  const mask = 1 << (gate.type === "CX" || gate.type === "CZ" ? gate.target! : gate.qubit);
  if (gate.type === "M") throw new Error("Measurements require a sampled outcome.");
  const matrix = gate.type === "CX" ? gateMatrix("X") : gate.type === "CZ" ? gateMatrix("Z") : gateMatrix(gate.type, gate.angle);
  for (let zero = 0; zero < state.length / 2; zero++) {
    if (zero & mask) continue;
    if ((gate.type === "CX" || gate.type === "CZ") && !(zero & (1 << gate.qubit))) continue;
    const one = zero | mask;
    for (let row = 0; row < 2; row++) {
      const output = (row ? one : zero) * 2;
      next[output] = next[output + 1] = 0;
      for (let column = 0; column < 2; column++) {
        const input = (column ? one : zero) * 2, m = (row * 2 + column) * 2;
        next[output] += matrix[m] * state[input] - matrix[m + 1] * state[input + 1];
        next[output + 1] += matrix[m] * state[input + 1] + matrix[m + 1] * state[input];
      }
    }
  }
  return next;
}

export function measureQubit(state: QuantumState, qubit: number, random: number, forced?: number) {
  let probabilityOne = 0;
  for (let i = 0; i < state.length / 2; i++) if (i & (1 << qubit)) probabilityOne += probabilityAt(state, i);
  const outcome = forced ?? (random < probabilityOne ? 1 : 0);
  const probability = outcome ? probabilityOne : 1 - probabilityOne;
  if (probability < EPSILON) throw new Error("The selected measurement has zero ideal probability.");
  const next = state.slice(), scale = 1 / Math.sqrt(probability);
  for (let i = 0; i < state.length / 2; i++) {
    const keep = Number(Boolean(i & (1 << qubit))) === outcome;
    next[2 * i] = keep ? state[2 * i] * scale : 0;
    next[2 * i + 1] = keep ? state[2 * i + 1] * scale : 0;
  }
  return { state: next, outcome };
}

export function blochVector(state: QuantumState, qubit: number) {
  let x = 0, y = 0, z = 0;
  const mask = 1 << qubit;
  for (let zero = 0; zero < state.length / 2; zero++) {
    if (zero & mask) continue;
    const one = zero | mask, a = zero * 2, b = one * 2;
    x += 2 * (state[a] * state[b] + state[a + 1] * state[b + 1]);
    y += 2 * (state[a] * state[b + 1] - state[a + 1] * state[b]);
    z += probabilityAt(state, zero) - probabilityAt(state, one);
  }
  return { x, y, z, purity: Math.min(1, (1 + x * x + y * y + z * z) / 2) };
}

export function stateSummary(state: QuantumState, qubits: number) {
  const terms = Array.from({ length: state.length / 2 }, (_, i) => i).filter(i => probabilityAt(state, i) > EPSILON);
  const text = terms.slice(0, 3).map(i => {
    const re = state[2 * i], im = state[2 * i + 1];
    const value = Math.abs(im) < EPSILON ? re.toFixed(3) : `(${re.toFixed(3)}${im < 0 ? "" : "+"}${im.toFixed(3)}i)`;
    return `${value}|${basisLabel(i, qubits)}⟩`;
  }).join(" + ");
  return text + (terms.length > 3 ? ` + ${terms.length - 3} more` : "");
}

function randomSource(circuit: Circuit, replay: number) {
  let seed = 2166136261;
  for (const char of JSON.stringify(circuit)) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  seed = (seed + Math.imul(replay, 2654435761)) >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
}

function validate(circuit: Circuit) {
  if (!Number.isInteger(circuit.qubits) || circuit.qubits < 1 || circuit.qubits > MAX_PLAYBACK_QUBITS) return "Exact playback supports 1–5 qubits.";
  if (circuit.gates.length > MAX_PLAYBACK_GATES) return `Playback supports up to ${MAX_PLAYBACK_GATES} gates; execution results remain available above.`;
  for (const g of circuit.gates) {
    if (!(g.type in descriptions) || !Number.isInteger(g.qubit) || g.qubit < 0 || g.qubit >= circuit.qubits) return "This circuit contains a gate or qubit unsupported by playback.";
    if ((g.type === "CX" || g.type === "CZ") && (g.target === undefined || !Number.isInteger(g.target) || g.target < 0 || g.target >= circuit.qubits || g.target === g.qubit)) return "A controlled gate needs a different, valid target qubit.";
    if (["RX", "RY", "RZ"].includes(g.type) && !Number.isFinite(g.angle)) return "Rotation angles must be finite values in radians.";
  }
}

export function buildPlayback(circuit: Circuit, result: DemoResult, replay = 0): PlaybackModel {
  const notice = validate(circuit);
  const model: PlaybackModel = { qubits: circuit.qubits, frames: [], measurementStart: 0, sampleSource: "ideal", hasMidCircuitMeasurement: false, notice };
  if (notice) return model;
  const gates = [...circuit.gates].sort((a, b) => a.column - b.column || a.id - b.id);
  const firstMeasurement = gates.findIndex(g => g.type === "M");
  model.hasMidCircuitMeasurement = firstMeasurement >= 0 && gates.slice(firstMeasurement).some(g => g.type !== "M");
  const automatic = firstMeasurement < 0;
  const operations = automatic ? [...gates, ...Array.from({ length: circuit.qubits }, (_, qubit): CircuitGate => ({ id: -qubit - 1, type: "M", qubit, column: Infinity }))] : gates;
  const random = randomSource(circuit, replay);
  let state = initialState(circuit.qubits), classical = 0;
  const label = () => basisLabel(classical, circuit.qubits);
  model.frames.push({ kind: "initial", title: "Initialize", explanation: "Every qubit starts in |0⟩. The register has one nonzero amplitude.", before: state, after: state, classical: label() });
  let sampledBits: number | undefined;
  for (const [index, gate] of operations.entries()) {
    const before = state;
    let outcome: number | undefined;
    if (gate.type === "M") {
      if (!model.measurementStart) {
        model.measurementStart = model.frames.length;
        // Counts describe classical bits, not a statevector. Only use them to choose
        // a terminal shot; mid-circuit measurement histories are not returned by Aer.
        if (!model.hasMidCircuitMeasurement && ["qiskit_aer", "cirq", "pennylane"].includes(result.simulator ?? "")) {
          const measuredMask = operations.filter(g => g.type === "M").reduce((mask, g) => mask | (1 << g.qubit), 0);
          const observed = result.counts ?? result.probabilities;
          const candidates = Object.entries(observed).filter(([bits, weight]) => {
            if (!new RegExp(`^[01]{${circuit.qubits}}$`).test(bits) || !Number.isFinite(weight) || weight <= 0) return false;
            const value = parseInt(bits, 2);
            if (value & ~measuredMask) return false;
            let p = 0;
            for (let basis = 0; basis < state.length / 2; basis++) if ((basis & measuredMask) === value) p += probabilityAt(state, basis);
            return p > EPSILON;
          });
          let remaining = random() * candidates.reduce((total, [, weight]) => total + weight, 0);
          for (const [bits, weight] of candidates) {
            remaining -= weight;
            if (remaining < 0) { sampledBits = parseInt(bits, 2); model.sampleSource = "backend"; break; }
          }
        }
      }
      const measured = measureQubit(state, gate.qubit, random(), sampledBits === undefined ? undefined : Number(Boolean(sampledBits & (1 << gate.qubit))));
      state = measured.state; outcome = measured.outcome;
      classical = (classical & ~(1 << gate.qubit)) | (outcome << gate.qubit);
    } else state = evolveGate(state, gate);
    const auto = automatic && index >= gates.length;
    model.frames.push({ kind: gate.type === "M" ? "measurement" : "gate", gate, automatic: auto,
      title: `${gate.type} · q${gate.qubit}${gate.target !== undefined ? ` → q${gate.target}` : ""}${gate.angle !== undefined ? ` · ${(gate.angle / Math.PI).toFixed(2)}π` : ""}`,
      explanation: `${descriptions[gate.type]}${auto ? " Added automatically by the simulator." : ""}`,
      before, after: state, outcome, classical: label() });
  }
  model.frames.push({ kind: "distribution", title: "From one shot to many", explanation: "One playback follows one ideal shot. The histogram shows all shots returned by your circuit execution.", before: state, after: state, classical: label() });
  return model;
}
