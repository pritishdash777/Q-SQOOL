import type { Circuit } from "./quantum-types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ||
  (typeof window === "undefined" || ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://127.0.0.1:8000" : "https://q-sqool-api.onrender.com");

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJSON<T>(endpoint: string, options: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, signal });
    const data = res.status === 204 ? undefined : await res.json();
    if (!res.ok) {
      throw new ApiError(typeof data?.detail === "string" ? data.detail : data?.error?.message ||
        (res.status >= 500 ? "Backend unavailable. Please retry." : `Request failed (${res.status}).`), res.status);
    }
    return data as T;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timeout.aborted) throw new ApiError("The backend did not respond in time. Please retry.", 0);
    if (error instanceof ApiError) throw error;
    throw new ApiError("Cannot reach the Q-SQOOL backend. Check your connection and retry.", 0);
  }
}

export async function checkHealth(): Promise<boolean> {
  try { await requestJSON("/health", {}, 5000); return true; } catch { return false; }
}

export async function simulateCircuit(circuit: Circuit, shots: number, signal?: AbortSignal) {
  const result = await requestJSON<import("./quantum-types").DemoResult & { success: boolean; shots: number }>("/api/simulate", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuit, shots, simulator: "qiskit_aer" }), signal,
  });
  signal?.throwIfAborted();
  const counts = result.counts;
  if (!result.success || result.simulator !== "qiskit_aer" || result.shots !== shots || !counts ||
    Object.entries(counts).some(([bits, count]) => bits.length !== circuit.qubits || !/^[01]+$/.test(bits) || !Number.isInteger(count) || count < 0) ||
    Object.values(counts).reduce((sum, value) => sum + value, 0) !== shots) {
    throw new ApiError("The backend returned invalid simulation counts. Please retry.", 502);
  }
  return { ...result, probabilities: Object.fromEntries(Object.entries(counts).map(([bits, count]) => [bits, count / shots])) };
}

export function optimizeCircuit(circuit: Circuit, signal?: AbortSignal) {
  return requestJSON<import("./quantum-types").AIAnalysis>("/api/optimize", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuit }), signal,
  });
}
