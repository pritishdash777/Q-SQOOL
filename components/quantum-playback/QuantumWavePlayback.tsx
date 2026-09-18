"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, RotateCcw, Waves } from "lucide-react";
import type { Circuit, DemoResult } from "@/lib/quantum-types";
import { basisLabel, blochVector, buildPlayback, phaseAt, probabilityAt, stateSummary } from "@/lib/quantum-playback";
import { WaveCanvas, type WaveView } from "./WaveCanvas";
import "./quantum-wave-playback.css";

type Props = { circuit: Circuit; result: DemoResult; shots: number; onHighlight?: (ids: number[]) => void };

export function QuantumWavePlayback({ circuit, result, shots, onHighlight }: Props) {
  const root = useRef<HTMLElement>(null);
  const [replay, setReplay] = useState(0);
  const model = useMemo(() => buildPlayback(circuit, result, replay), [circuit, result, replay]);
  const [step, setStep] = useState(0), [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(1);
  const [view, setView] = useState<WaveView>("Waves"), [page, setPage] = useState(0);
  const [reduced, setReduced] = useState(true), [expanded, setExpanded] = useState(false);
  const [selectedBasis, setSelectedBasis] = useState(0);
  const frame = model.frames[step], final = step === model.frames.length - 1;
  const totalPages = Math.ceil(2 ** Math.min(circuit.qubits, 5) / 8);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches || Boolean(root.current?.closest('[data-motion="still"]')));
    update(); media.addEventListener("change", update);
    const observer = new MutationObserver(update);
    let ancestor: HTMLElement | null = root.current;
    while (ancestor) { observer.observe(ancestor, { attributes: true, attributeFilter: ["data-motion"] }); ancestor = ancestor.parentElement; }
    return () => { media.removeEventListener("change", update); observer.disconnect(); };
  }, []);
  useEffect(() => {
    onHighlight?.(frame?.gate && !frame.automatic ? [frame.gate.id] : []);
    return () => onHighlight?.([]);
  }, [frame, onHighlight]);

  const seek = (next: number) => { setPlaying(false); setStep(Math.max(0, Math.min(model.frames.length - 1, next))); };
  const restart = () => { setStep(0); setPlaying(!reduced); };
  const sampleAgain = () => { setReplay(value => value + 1); setStep(model.measurementStart); setPlaying(!reduced); };
  const observed = Object.entries(result.counts ?? result.probabilities).sort(([a], [b]) => a.localeCompare(b));
  const observedTotal = observed.reduce((sum, [, value]) => sum + value, 0) || 1;
  const gateNumber = model.frames.slice(0, step + 1).filter(item => item.gate && !item.automatic).length;
  const advance = () => {
    if (step < model.frames.length - 1) setStep(value => value + 1);
    else setPlaying(false);
  };

  return <section ref={root} id="quantum-wave-playback" className={`qw-lab ${expanded ? "qw-expanded" : ""}`} aria-labelledby="qw-title" data-reduced={reduced}>
    <header className="qw-header">
      <div><p className="qw-eyebrow"><Waves size={15} /> QUANTUM WAVE PLAYBACK <span>01 / OBSERVATORY</span></p><h2 id="qw-title">See what your circuit <em>just did.</em></h2><p className="qw-intro">Follow the amplitudes. Find the interference. Watch a possibility become a result.</p></div>
      <button className="qw-expand" type="button" onClick={() => setExpanded(value => !value)} aria-pressed={expanded} aria-label={expanded ? "Exit expanded playback" : "Expand playback"}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
    </header>
    {model.notice || !frame ? <p className="qw-notice" role="status">{model.notice || "Playback is unavailable for this circuit."}</p> : <>
      <div className="qw-journey" aria-label="Execution journey">{["Initial state", "Gate transformations", "Interference", "Measurement", "Distribution"].map((label, i) => {
        const active = i === (frame.kind === "initial" ? 0 : frame.kind === "measurement" ? 3 : final ? 4 : frame.gate?.type === "H" ? 2 : 1);
        return <span key={label} data-active={active}><i>{String(i + 1).padStart(2, "0")}</i>{label}</span>;
      })}</div>
      <div className="qw-layout">
        <div className="qw-stage">
          <div className="qw-stage-toolbar"><span><i className="qw-live-dot" /> {playing && !reduced && !final ? "PLAYING" : "STATE INSPECTOR"}</span><div role="group" aria-label="Playback visualization">{(["Waves", "Amplitudes", "Bloch"] as WaveView[]).map(item => <button key={item} type="button" aria-pressed={view === item} onClick={() => setView(item)}>{item}</button>)}</div></div>
          <div className="qw-scene">
            <WaveCanvas frame={frame} qubits={circuit.qubits} view={view} page={page} playing={playing && !final} speed={speed} still={reduced} onAdvance={advance} />
            {final && view === "Waves" && <div className="qw-finish"><span>ONE ILLUSTRATIVE SHOT</span><strong>{frame.classical}</strong><p>{model.sampleSource === "backend" ? "Sampled from your execution results" : "Sampled from ideal state evolution"}</p></div>}
          </div>
          <div className="qw-legend"><span><i /> {view === "Bloch" ? "Reduced state of each qubit · center = maximally mixed" : "Height = |amplitude| · hue / offset = phase"}</span>{totalPages > 1 && view !== "Bloch" && <div><button type="button" aria-label="Previous basis states" disabled={!page} onClick={() => setPage(value => value - 1)}><ChevronLeft size={14} /></button><span>States {page * 8 + 1}–{Math.min((page + 1) * 8, 2 ** circuit.qubits)}</span><button type="button" aria-label="Next basis states" disabled={page === totalPages - 1} onClick={() => setPage(value => value + 1)}><ChevronRight size={14} /></button></div>}</div>
          <div className="qw-transport">
            <div className="qw-transport-buttons"><button type="button" onClick={restart} aria-label="Restart playback"><RotateCcw size={17} /></button><button type="button" disabled={!step} onClick={() => seek(step - 1)} aria-label="Previous gate"><ChevronLeft size={18} /></button><button type="button" className="qw-play" disabled={reduced} onClick={() => { if (final) restart(); else setPlaying(value => !value); }} aria-label={playing && !final ? "Pause playback" : "Play playback"}>{playing && !final && !reduced ? <Pause size={17} /> : <Play size={17} />}</button><button type="button" disabled={final} onClick={() => seek(step + 1)} aria-label="Next gate"><ChevronRight size={18} /></button></div>
            <label className="qw-timeline"><span>{frame.automatic ? "Automatic readout" : final ? "Execution complete" : `Gate ${gateNumber} of ${circuit.gates.length}`}</span><input type="range" min={0} max={model.frames.length - 1} step={1} value={step} onChange={event => seek(Number(event.target.value))} aria-label="Execution timeline" aria-valuetext={frame.title} /></label>
            <label className="qw-speed"><span>Speed</span><select value={speed} disabled={reduced} onChange={event => setSpeed(Number(event.target.value))}><option value={.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
          </div>
          <div className="qw-gate-strip" role="group" aria-label="Gate timeline">{model.frames.map((item, index) => <button key={index} type="button" aria-pressed={step === index} onClick={() => seek(index)} title={item.title}><small>{String(index).padStart(2, "0")}</small>{item.kind === "initial" ? "|0⟩" : item.kind === "distribution" ? "RESULT" : item.automatic ? `M q${item.gate?.qubit}*` : `${item.gate?.type} q${item.gate?.qubit}`}</button>)}</div>
        </div>
        <aside className="qw-inspector">
          <div className="qw-inspector-title"><span>THE STATE, EXPLAINED</span><span>IDEAL MODEL</span></div>
          <div className="qw-step-description" aria-live="polite"><h3>{frame.title}</h3><p>{frame.explanation}</p>{frame.outcome !== undefined && <div className="qw-shot">q{frame.gate?.qubit} measured <strong>{frame.outcome}</strong><span>Classical register: {frame.classical}</span></div>}</div>
          <div className="qw-equations"><div><span>BEFORE</span><p>{stateSummary(frame.before, circuit.qubits)}</p></div><ArrowDown size={14} /><div><span>AFTER</span><p>{stateSummary(frame.after, circuit.qubits)}</p></div></div>
          <div className="qw-probabilities"><div className="qw-subtitle"><span>{final ? "EXECUTION DISTRIBUTION" : "BASIS PROBABILITIES"}</span><span>{final ? `${shots.toLocaleString()} shots` : "|amplitude|²"}</span></div>
            <div className="qw-probability-scroll">{(final ? observed.map(([bits, weight]) => ({ bits, p: weight / observedTotal, count: result.counts?.[bits] })) : Array.from({ length: 2 ** circuit.qubits }, (_, i) => ({ bits: basisLabel(i, circuit.qubits), p: probabilityAt(frame.after, i), count: undefined }))).map(({ bits, p, count }) => <div className="qw-prob-row" key={bits}><span>|{bits}⟩</span><div role="meter" aria-label={`Probability of ${bits}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, p * 100)}><i style={{ width: `${p * 100}%` }} /></div><span>{(p * 100).toFixed(1)}%{count !== undefined && <small>{count} shots</small>}</span></div>)}</div>
          </div>
          <label className="qw-basis-select">Inspect amplitude<select value={selectedBasis} onChange={event => setSelectedBasis(Number(event.target.value))}>{Array.from({ length: 2 ** circuit.qubits }, (_, i) => <option key={i} value={i}>|{basisLabel(i, circuit.qubits)}⟩</option>)}</select></label>
          <p className="qw-phase">{frame.after[selectedBasis * 2].toFixed(4)} {frame.after[selectedBasis * 2 + 1] < 0 ? "−" : "+"} {Math.abs(frame.after[selectedBasis * 2 + 1]).toFixed(4)}i <span>φ {probabilityAt(frame.after, selectedBasis) > 1e-12 ? `${(phaseAt(frame.after, selectedBasis) / Math.PI).toFixed(3)}π` : "undefined (zero amplitude)"}</span></p>
          {view === "Bloch" && <p className="qw-detail">Purity {Array.from({ length: circuit.qubits }, (_, q) => `q${q}: ${blochVector(frame.after, q).purity.toFixed(2)}`).join(" · ")}. A shorter vector reflects entanglement with the other qubits in this pure-state trajectory.</p>}
          <button type="button" className="qw-remeasure" onClick={sampleAgain}><RotateCcw size={15} /> Replay measurement <ArrowUpRight size={15} /></button>
        </aside>
      </div>
      <footer className="qw-footer"><span>Educational amplitude & phase visualization · basis order q{circuit.qubits - 1}…q0</span><span>{circuit.qubits} QUBITS <i /> {circuit.gates.length} GATES <i /> {shots.toLocaleString()} SHOTS</span></footer>
      <p className="qw-detail qw-disclosure">Waves depict complex amplitudes, not physical water waves. {model.hasMidCircuitMeasurement ? "Mid-circuit measurements follow a locally sampled ideal trajectory; the backend does not return individual measurement histories." : model.sampleSource === "backend" ? "Terminal outcomes are sampled from backend counts; intermediate amplitudes are calculated from your gates." : "Measurement follows a locally sampled ideal trajectory."} {reduced && "Reduced motion is enabled. Use the timeline or gate buttons to explore each static state."}</p>
    </>}
  </section>;
}
