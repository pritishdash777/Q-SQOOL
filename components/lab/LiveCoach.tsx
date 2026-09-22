"use client";

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@/components/progress/ProgressProvider";
import ChatText from "@/components/q-ai/ChatText";
import { circuitFingerprint, orderedGates, validateCircuit } from "@/lib/circuit";
import { requestChat, type ChatTurn } from "@/lib/q-ai-chat";
import { coachCircuitSchema, type LabContext } from "@/lib/lab-coach";
import type { AILevel, Circuit, ExecutionSnapshot } from "@/lib/quantum-types";

type Turn = ChatTurn & { proposal?: Circuit; fingerprint?: string };
export default function LiveCoach({ circuit, execution, onApply }: {
  circuit: Circuit; execution?: ExecutionSnapshot; onApply: (circuit: Circuit) => void;
}) {
  const { progress } = useProgress();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [level, setLevel] = useState<AILevel>("Beginner");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [updates, setUpdates] = useState(0);
  const request = useRef<AbortController | null>(null);
  const lastAuto = useRef(0);
  const sendLive = useRef<() => void>(() => {});
  const fingerprint = circuitFingerprint(circuit);
  const currentResult = execution?.fingerprint === fingerprint ? execution.result : undefined;
  const resultKey = JSON.stringify(currentResult ?? null);

  // Changing the circuit cancels old requests; old answers cannot mutate new work.
  useEffect(() => {
    request.current?.abort(); request.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset a canceled request when its circuit context changes.
    setBusy(false);
    return () => { request.current?.abort(); request.current = null; };
  }, [fingerprint, resultKey, level]);

  async function send(text: string, automatic = false) {
    if (!text.trim() || request.current || validateCircuit(circuit)) return;
    const controller = new AbortController(); request.current = controller;
    const messages: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(messages); setBusy(true); setError("");
    if (!automatic) setQuestion("");
    const context: LabContext = {
      circuit, level, completedModules: Object.values(progress?.modules ?? {}).filter(module => module.completed).map(module => module.moduleId).slice(0, 100),
      ...(currentResult?.counts && ["qiskit_aer", "cirq", "pennylane"].includes(currentResult.simulator ?? "") ? {
        result: { simulator: currentResult.simulator as "qiskit_aer" | "cirq" | "pennylane", counts: currentResult.counts },
      } : {}),
    };
    try {
      const answer = await requestChat(messages, "/composer", controller.signal, context);
      if (controller.signal.aborted || request.current !== controller) return;
      const proposal = coachCircuitSchema.safeParse(answer.proposal);
      setTurns([...messages, { role: "assistant", content: answer.text + (answer.truncated ? "\n\nResponse shortened. Ask me to continue." : ""),
        ...(proposal.success ? { proposal: proposal.data, fingerprint } : {}) }]);
    } catch (cause) {
      if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "Unable to connect. Retry your question."); setLive(false); }
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }
  useEffect(() => {
    sendLive.current = () => {
      if (request.current) return;
      lastAuto.current = Date.now(); setUpdates(count => count + 1);
      void send("Live update: what changed in my current circuit or result, and what should I try or predict next?", true);
    };
  });
  useEffect(() => {
    if (!live || updates >= 10) return;
    const timer = setTimeout(() => sendLive.current(), Math.max(1800, lastAuto.current + 12000 - Date.now()));
    return () => clearTimeout(timer);
    // Only circuit/result changes trigger feedback, never the coach's own answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, fingerprint, resultKey]);

  return <section className="border-b border-border p-4" aria-label="Live quantum AI coach">
    <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Live AI coach</h3>
      <button className={`rounded-lg border px-3 py-2 text-xs ${live ? "border-emerald-400 text-emerald-300" : "border-border"}`} aria-pressed={live}
        onClick={() => { setLive(!live); setUpdates(0); }}>Live {live ? "on" : "off"}</button></div>
    <p className="mt-2 text-xs text-muted-foreground">Uses your current circuit{currentResult ? " and latest run" : " · no run yet"}. Live feedback follows edits after a pause; up to 10 updates per session.</p>
    {live && updates >= 10 && <p className="mt-2 text-xs text-amber-200">Live updates paused to conserve AI usage. Toggle Live off/on to resume; chat still works.</p>}
    <label className="mt-3 block text-xs">Response style<select value={level} onChange={e => setLevel(e.target.value as AILevel)} className="inspector-input"><option>Beginner</option><option>Technical</option></select></label>
    <div className="mt-3 flex flex-wrap gap-2">{[
      ["Explain", "Explain my current circuit and give me one experiment to try."],
      ["Why this result?", "Why did I get this simulation result? Help me connect the counts to my gates."],
      ["Build XOR", "Build a reversible XOR circuit for inputs a=1, b=0. Give me a circuit to apply and ask me to predict the target measurement, then help me test other inputs."],
      ["Fix circuit", "Help fix my current circuit. If the intended goal is unclear, ask me first. Otherwise propose the corrected circuit."],
      ["Next step", "Use my actual completed lessons and this circuit to suggest one next learning experiment."],
    ].map(([label, prompt]) => <button key={label} disabled={busy} onClick={() => void send(prompt)} className="rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-40">{label}</button>)}</div>
    <div className="mt-3 max-h-[420px] space-y-4 overflow-y-auto break-words" aria-live="polite">
      {turns.map((turn, index) => <article key={index} className="rounded-lg border border-border p-3 text-sm"><p className="mb-2 text-xs text-secondary">{turn.role === "user" ? "You" : "q-ai"}</p><ChatText text={turn.content} />
        {turn.proposal && <div className="mt-3"><p className="text-xs text-amber-200">Proposed circuit · validated structure, not simulated</p>
          <p className="mt-2 text-xs">{turn.proposal.qubits} qubits · {turn.proposal.gates.length} gates</p>
          <ol className="mt-2 max-h-36 overflow-y-auto font-mono text-xs">{orderedGates(turn.proposal).map(g => <li key={g.id}>{g.column + 1}: {g.type} q{g.qubit}{g.target !== undefined ? ` → q${g.target}` : ""}{g.angle !== undefined ? ` (${g.angle.toFixed(3)} rad)` : ""}</li>)}</ol>
          <button disabled={turn.fingerprint !== fingerprint || busy} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-40" onClick={() => { if (turn.proposal && turn.fingerprint === fingerprint && !validateCircuit(turn.proposal)) { onApply(turn.proposal); document.getElementById("simulation-workspace")?.scrollIntoView({ behavior: "smooth" }); } }}>Apply to Composer</button>
          <p className="mt-2 text-xs text-muted-foreground">{turn.fingerprint !== fingerprint ? "Circuit changed. Ask for a fresh proposal." : "Review, apply, then Run to test your prediction. Undo is available in Composer."}</p>
        </div>}
      </article>)}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    <form className="mt-3" onSubmit={e => { e.preventDefault(); void send(question); }}>
      <textarea aria-label="Ask the live circuit coach" value={question} maxLength={4000} onChange={e => setQuestion(e.target.value)} placeholder="Ask, generate a circuit, or explain your prediction…" className="min-h-20 w-full rounded-lg border border-border bg-background p-2 text-sm" />
      <button disabled={busy || !question.trim()} className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground disabled:opacity-40">{busy ? "Thinking…" : "Ask q-ai"}</button>
      {busy && <button type="button" className="ml-3 text-xs underline" onClick={() => { request.current?.abort(); request.current = null; setBusy(false); }}>Stop</button>}
    </form>
  </section>;
}
