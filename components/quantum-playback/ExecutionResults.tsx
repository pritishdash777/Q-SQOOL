import type { Circuit, DemoResult } from "@/lib/quantum-types";

export function ExecutionResults({ result, circuit, shots }: { result: DemoResult; circuit: Circuit; shots: number }) {
  const rows = Object.entries(result.counts || {}).sort(([a], [b]) => a.localeCompare(b));
  return <div className="mt-4">
    <p className="mb-3 text-xs text-muted-foreground">Sampled measurement frequencies · {shots} shots · bit order q{circuit.qubits - 1}…q0</p>
    <div className="max-h-72 overflow-auto rounded-xl border border-border"><table className="w-full text-left text-sm"><caption className="sr-only">Qiskit Aer measurement counts</caption><thead><tr><th className="p-3">Outcome</th><th className="p-3">Count</th><th className="p-3">Frequency</th></tr></thead><tbody>{rows.map(([state, count]) => <tr key={state} className="border-t border-border"><td className="p-3 font-mono">|{state}⟩</td><td className="p-3">{count}</td><td className="p-3"><span>{(count / shots * 100).toFixed(1)}%</span><div className="mt-1 h-2 rounded-full bg-foreground/10"><div style={{ width: `${count / shots * 100}%` }} className="h-full rounded-full bg-secondary" /></div></td></tr>)}</tbody></table></div>
    <p className="mt-3 text-xs text-muted-foreground">These are sampled counts, not state amplitudes. The playback below calculates an ideal trajectory from the gates.</p>
  </div>;
}
