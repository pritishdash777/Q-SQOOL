"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Atom, Binary, Braces, Check, Compass, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Page } from "@/lib/quantum-types";
import "./landing-experience.css";

const steps = [
  { id: "prepare", label: "01 · Prepare", title: "Start with one possibility.", copy: "Both qubits begin in |0⟩. Before any gates are applied, the pair is in |00⟩: a single, predictable outcome.", code: "from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(2)\n# Initial state: |00⟩", probabilities: [100, 0, 0, 0] },
  { id: "superpose", label: "02 · Superpose", title: "Give the first qubit two paths.", copy: "A Hadamard gate creates equal amplitudes for |00⟩ and |10⟩. Here we write the first qubit on the left; the second is still in |0⟩.", code: "from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(2)\nqc.h(0)", probabilities: [50, 0, 50, 0] },
  { id: "entangle", label: "03 · Entangle", title: "Two qubits. One shared state.", copy: "CX flips the second qubit when the first is |1⟩. The resulting Bell state gives |00⟩ or |11⟩ with equal probability in an ideal measurement.", code: "from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(2)\nqc.h(0)\nqc.cx(0, 1)", probabilities: [50, 0, 0, 50] },
];

export function LandingExperience({ navigate }: { navigate: (page: Page) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [angle, setAngle] = useState(90);
  const [step, setStep] = useState("entangle");
  const probabilityOne = Math.sin(angle * Math.PI / 360) ** 2;
  const one = Math.round(probabilityOne * 100);
  const radians = angle * Math.PI / 180;

  useEffect(() => {
    const elements = root.current!.querySelectorAll<HTMLElement>(".landing-reveal");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.removeAttribute("data-waiting");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08 });
    elements.forEach(el => { el.setAttribute("data-waiting", "true"); observer.observe(el); });
    const revealAll = () => { elements.forEach(el => el.removeAttribute("data-waiting")); observer.disconnect(); };
    reduced.addEventListener("change", revealAll);
    return () => { revealAll(); reduced.removeEventListener("change", revealAll); };
  }, []);

  return <div ref={root} className="landing-experience">
    <div className="landing-signal-strip" aria-label="Explore quantum concepts">
      <span><Atom /> Superposition</span><span><Binary /> Entanglement</span><span><Braces /> Quantum circuits</span><span><Compass /> Your next discovery</span>
    </div>

    <section className="landing-section landing-reveal" aria-labelledby="qubit-title">
      <div className="landing-section-heading">
        <p className="landing-eyebrow">01 / A little less abstract</p>
        <h2 id="qubit-title">Don’t just read about it.<br /><span>Move a qubit.</span></h2>
        <p>One rotation. A whole spectrum of possibilities. Change the angle and see how the measurement probabilities respond.</p>
      </div>
      <div className="landing-qubit-panel">
        <div className="landing-qubit-visual">
          <span className="landing-panel-label"><span className="landing-status-dot" /> LIVE EXPLORER</span>
          <svg viewBox="0 0 360 340" role="img" aria-label={`Qubit state on the X-Z plane, rotated ${angle} degrees from zero`} className="landing-bloch">
            <defs><radialGradient id="landing-sphere-fill"><stop offset="0" stopColor="currentColor" stopOpacity=".13" /><stop offset="1" stopColor="currentColor" stopOpacity=".02" /></radialGradient></defs>
            <circle cx="180" cy="168" r="118" fill="url(#landing-sphere-fill)" stroke="currentColor" strokeOpacity=".3" />
            <ellipse cx="180" cy="168" rx="118" ry="34" fill="none" stroke="currentColor" strokeOpacity=".25" strokeDasharray="4 5" />
            <ellipse cx="180" cy="168" rx="42" ry="118" fill="none" stroke="currentColor" strokeOpacity=".15" />
            <path d="M 40 168 H 320 M 180 35 V 300" stroke="currentColor" strokeOpacity=".25" />
            <text x="180" y="24" textAnchor="middle">|0⟩</text><text x="180" y="326" textAnchor="middle">|1⟩</text><text x="328" y="173">x</text>
            <line x1="180" y1="168" x2={180 + 118 * Math.sin(radians)} y2={168 - 118 * Math.cos(radians)} className="landing-state-vector" />
            <circle cx={180 + 118 * Math.sin(radians)} cy={168 - 118 * Math.cos(radians)} r="7" className="landing-state-point" />
            <circle cx="180" cy="168" r="4" fill="currentColor" />
          </svg>
          <p className="landing-formula">|ψ⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩</p>
          <p className="landing-caption">A real-amplitude slice of the Bloch sphere</p>
        </div>
        <div className="landing-qubit-controls">
          <div className="landing-control-title"><span>Rotate your state</span><output htmlFor="landing-angle">{angle}°</output></div>
          <label htmlFor="landing-angle" className="landing-caption">Rotation angle θ</label>
          <input id="landing-angle" className="landing-angle" type="range" min="0" max="180" step="1" value={angle} onChange={event => setAngle(Number(event.target.value))} aria-valuetext={`${angle} degrees; zero ${100 - one} percent, one ${one} percent`} />
          <div className="landing-range-labels"><span>0° · |0⟩</span><span>90° · |+⟩</span><span>180° · |1⟩</span></div>
          <div className="landing-presets">{[[0, "Zero"], [90, "Balanced"], [180, "One"]].map(([value, label]) => <Button key={value} variant="outline" aria-pressed={angle === value} onClick={() => setAngle(Number(value))}>{label}</Button>)}</div>
          <div className="landing-probabilities" aria-label="Measurement probabilities">
            {[100 - one, one].map((probability, index) => <div key={index}>
              <div><span>Measure |{index}⟩</span><strong>{probability}%</strong></div>
              <div className="landing-meter" role="meter" aria-label={`Probability of ${index}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={probability}><span style={{ width: `${probability}%` }} /></div>
            </div>)}
          </div>
          <p className="landing-explanation">{angle === 0 ? "At the north pole, measurement always returns 0." : angle === 180 ? "At the south pole, measurement always returns 1." : angle === 90 ? "Equal probabilities, one coherent quantum state. Each measurement returns either 0 or 1." : "The amplitudes change continuously. Their squared magnitudes give the probabilities shown above."}</p>
          <Button variant="ghost" onClick={() => setAngle(90)}><RotateCcw /> Reset rotation</Button>
        </div>
      </div>
    </section>

    <section className="landing-section landing-reveal" aria-labelledby="journey-title">
      <div className="landing-section-heading"><p className="landing-eyebrow">02 / From intuition to implementation</p><h2 id="journey-title">Your first quantum<br /><span>“Oh, I get it.”</span></h2><p>Walk through a Bell-state circuit. Connect each gate to the code and the outcomes it creates.</p></div>
      <Tabs value={step} onValueChange={setStep} className="landing-journey">
        <TabsList className="landing-step-tabs" aria-label="Bell state preparation stages">{steps.map(item => <TabsTrigger key={item.id} value={item.id}>{item.label}</TabsTrigger>)}</TabsList>
        {steps.map(item => <TabsContent key={item.id} value={item.id} className="landing-step-content">
          <div className="landing-step-copy"><span className="landing-eyebrow">THE IDEA</span><h3>{item.title}</h3><p>{item.copy}</p><Button variant="outline" onClick={() => navigate("lab")}>Build in the lab <ArrowRight /></Button></div>
          <div className="landing-code-panel"><div className="landing-code-heading"><span><i /><i /><i /></span><span>bell_state.py · Qiskit</span><Check size={14} /></div><pre><code>{item.code}</code></pre><div className="landing-code-note">Illustrative code · ideal state probabilities</div></div>
          <div className="landing-outcomes"><div className="landing-panel-label">EXPECTED OUTCOMES</div><div className="landing-outcome-chart">{item.probabilities.map((p, i) => <div key={i}><span>{p}%</span><div className="landing-outcome-track"><div style={{ height: `${p}%` }} /></div><span>|{["00", "01", "10", "11"][i]}⟩</span></div>)}</div></div>
        </TabsContent>)}
      </Tabs>
    </section>

    <section className="landing-section landing-reveal" aria-labelledby="paths-title">
      <div className="landing-path-heading"><div className="landing-section-heading"><p className="landing-eyebrow">03 / Follow your curiosity</p><h2 id="paths-title">Choose your next leap.</h2></div><p>Start where you are.<br />Keep going where it gets interesting.</p></div>
      <div className="landing-paths">{[
        { number: "01", icon: Compass, title: "Find your footing", tag: "THE FOUNDATIONS", text: "Build intuition for qubits, measurement and superposition with guided lessons and conceptual checks.", action: "Explore the curriculum", page: "learning" as Page },
        { number: "02", icon: Atom, title: "Make something quantum", tag: "THE WORKBENCH", text: "Arrange gates, connect qubits and inspect your results. Turn a circuit idea into an experiment you can understand.", action: "Open Quantum Lab", page: "lab" as Page },
        { number: "03", icon: Braces, title: "Meet the algorithms", tag: "THE NEXT CHAPTER", text: "Explore the circuit patterns behind Bell states, Grover search and Deutsch–Jozsa. See what makes each one work.", action: "Discover algorithms", page: "algorithms" as Page },
      ].map(({ number, icon: Icon, title, tag, text, action, page }) => <article key={number} className="landing-path"><div className="landing-path-top"><Icon /><span>{number}</span></div><p className="landing-eyebrow">{tag}</p><h3>{title}</h3><p>{text}</p><Button variant="ghost" onClick={() => navigate(page)}>{action}<ArrowRight /></Button></article>)}</div>
    </section>

    <section className="landing-section landing-faq landing-reveal" aria-labelledby="faq-title">
      <div className="landing-section-heading"><p className="landing-eyebrow">Before you jump in</p><h2 id="faq-title">Curiosity is<br /><span>enough to start.</span></h2></div>
      <Accordion type="single" collapsible>{[
        ["Do I need a physics background?", "Start with the foundations. The lessons introduce qubits, amplitudes and measurement step by step. Comfort with basic algebra helps; you can build the rest as you go."],
        ["Is this a real quantum computer?", "Q-SQOOL uses classical simulation to help you explore quantum circuits. The landing-page explorers show ideal mathematical probabilities; they do not submit jobs to quantum hardware."],
        ["Can I move from visuals to code?", "Yes. Explore the visual Quantum Lab and the Code Lab to connect circuit operations with Qiskit, Cirq and OpenQASM workflows."],
      ].map(([question, answer], i) => <AccordionItem key={question} value={`question-${i}`}><AccordionTrigger>{question}</AccordionTrigger><AccordionContent>{answer}</AccordionContent></AccordionItem>)}</Accordion>
    </section>

    <section className="landing-final landing-reveal" aria-labelledby="final-title"><span className="landing-eyebrow"><Sparkles size={15} /> YOUR NEXT POSSIBILITY</span><h2 id="final-title">The future has qubits.<br /><span>So can your next idea.</span></h2><p>One lesson. One circuit. One discovery at a time.</p><Button size="lg" onClick={() => navigate("dashboard")}>Enter your workspace <ArrowRight /></Button></section>
    <footer className="landing-footer"><span>Q-SQOOL <span>/ Quantum, made approachable.</span></span><div><button onClick={() => navigate("learning")}>Learn</button><button onClick={() => navigate("lab")}>Build</button><a href="#top">Back to top ↑</a></div></footer>
  </div>;
}
