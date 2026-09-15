"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronRight, Code2, Copy, Menu, Moon, Orbit, Pause, Play, Plus, Sparkles, Sun, X } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { QuantumSculpture } from "./QuantumSculpture";
import "./landing-page.css";

const concepts = [
  { title: "Superposition", label: "One qubit. More possibility.", formula: "cos(θ/2)|0⟩ + sin(θ/2)|1⟩", outcomes: ["0", "1"] },
  { title: "Entanglement", label: "Two qubits. One shared state.", formula: "cos(θ/2)|00⟩ + sin(θ/2)|11⟩", outcomes: ["00", "11"] },
  { title: "Interference", label: "Change a phase. Change the outcome.", formula: "cos(θ/2)|0⟩ − i sin(θ/2)|1⟩", outcomes: ["0", "1"] },
];
const stages = [
  { name: "Initialize", title: "Every possibility starts somewhere.", copy: "Two qubits, both prepared in zero. A clean starting point for your first quantum circuit.", probabilities: [100, 0, 0, 0], state: "|00⟩", code: "" },
  { name: "Superpose", title: "Make room for another outcome.", copy: "A Hadamard gate puts the first qubit into an equal superposition. Two possible outcomes, one coherent state.", probabilities: [50, 50, 0, 0], state: "(|00⟩ + |01⟩) / √2", code: "qc.h(0)" },
  { name: "Entangle", title: "Now, their stories are connected.", copy: "A controlled-X gate links the pair. In this Bell state, measuring both qubits gives 00 or 11, each with equal probability.", probabilities: [50, 0, 0, 50], state: "(|00⟩ + |11⟩) / √2", code: "qc.h(0)\nqc.cx(0, 1)" },
];
const paths = [
  { id: "01", name: "The curious beginner", subject: "Start with the strange.", copy: "Meet qubits, superposition, and the ideas that make quantum different.", href: "/learn/qubits", tag: "NO PHYSICS DEGREE REQUIRED", sketch: "beginner", lessons: "Start with Qubits", icon: Sparkles },
  { id: "02", name: "The hands-on builder", subject: "Put possibility to work.", copy: "Arrange gates, connect qubits, and bring your own circuit ideas to life.", href: "/composer", tag: "LESS THEORY. MORE TRYING.", sketch: "builder", lessons: "Open the Quantum Lab", icon: Orbit },
  { id: "03", name: "The next-level thinker", subject: "Go beyond the basics.", copy: "Explore Grover, quantum teleportation, QFT, and hybrid algorithms.", href: "/algorithms", tag: "FOLLOW THE INTERESTING QUESTIONS", sketch: "thinker", lessons: "Explore the algorithms", icon: Code2 },
];

function spotlight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse") return;
  const bounds = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
}

export function LandingPage() {
  const root = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { resolvedTheme, toggleTheme, mounted } = useTheme();
  const [mode, setMode] = useState(1);
  const [angle, setAngle] = useState(90);
  const [stage, setStage] = useState(2);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyState, setCopyState] = useState("");
  const still = paused || reduced;
  const probabilityOne = Math.round(Math.sin(angle * Math.PI / 360) ** 2 * 100);
  const concept = concepts[mode];
  const activeStage = stages[stage];
  const code = `from qiskit import QuantumCircuit\n\nqc = QuantumCircuit(2)${activeStage.code ? `\n${activeStage.code}` : ""}\n`;

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update(); preference.addEventListener("change", update);
    return () => { preference.removeEventListener("change", update); clearTimeout(copyTimer.current); };
  }, []);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const targets = element.querySelectorAll<HTMLElement>("[data-reveal]");
    if (still || !("IntersectionObserver" in window)) {
      targets.forEach(target => target.setAttribute("data-visible", "true"));
      return;
    }
    element.setAttribute("data-reveal-enabled", "true");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.setAttribute("data-visible", "true");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: "0px 0px 25px 0px" });
    targets.forEach(target => observer.observe(target));
    return () => observer.disconnect();
  }, [still]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const distance = document.documentElement.scrollHeight - innerHeight;
      root.current?.style.setProperty("--reading-progress", `${distance > 0 ? Math.min(1, scrollY / distance) : 0}`);
      root.current?.setAttribute("data-scrolled", String(scrollY > 20));
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll); update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", scroll); window.removeEventListener("resize", scroll); };
  }, []);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("Copied");
    } catch { setCopyState("Select the code to copy it manually."); }
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState(""), 2500);
  };

  return <main ref={root} id="top" className="q-home" data-motion={still ? "still" : "full"}>
    <a className="qh-skip" href="#qh-main">Skip to content</a>
    <div className="qh-reading-progress" aria-hidden="true" />
    <header className="qh-header">
      <div className="qh-nav-shell">
        <Link href="/" className="qh-brand" aria-label="Q-SQOOL home">
          <Image src="/q-sqool-mark.svg" width={43} height={40} alt="" priority />
          <span>Q-SQOOL<small>A SCHOOL OF POSSIBILITY</small></span>
        </Link>
        <nav className="qh-desktop-nav" aria-label="Landing navigation">
          <a href="#experience">The experience</a><a href="#playground">Your playground</a><a href="#paths">Find your path</a>
        </nav>
        <div className="qh-nav-actions">
          <button type="button" className="qh-icon-button qh-motion-toggle" onClick={() => setPaused(value => !value)} disabled={reduced}
            aria-pressed={still} aria-label={reduced ? "System reduced motion is enabled" : paused ? "Resume animations" : "Pause animations"}
            title={reduced ? "System reduced motion is enabled" : paused ? "Resume animations" : "Pause animations"}>
            {still ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button type="button" className="qh-icon-button" onClick={toggleTheme} disabled={!mounted}
            aria-label={!mounted ? "Theme loading" : `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}>
            {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/login" className="qh-sign-in">Sign in <ArrowUpRight size={14} /></Link>
          <button ref={menuButton} type="button" className="qh-icon-button qh-menu-toggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen} aria-controls="qh-mobile-navigation" onClick={() => setMenuOpen(value => !value)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {menuOpen && <nav id="qh-mobile-navigation" className="qh-mobile-nav" aria-label="Mobile landing navigation" onKeyDown={event => {
        if (event.key === "Escape") { setMenuOpen(false); menuButton.current?.focus(); }
      }}>
        {[["The experience", "#experience"], ["Your playground", "#playground"], ["Find your path", "#paths"]].map(([label, href]) =>
          <a key={href} href={href} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={18} /></a>)}
        <Link href="/login" onClick={() => setMenuOpen(false)}>Sign in <ArrowUpRight size={18} /></Link>
      </nav>}
    </header>

    <section id="qh-main" className="qh-hero qh-container" aria-labelledby="qh-title">
      <div className="qh-hero-copy">
        <p className="qh-eyebrow qh-hero-eyebrow"><span className="qh-live-dot" /> FOR THE CURIOUS. FOR WHAT’S NEXT.</p>
        <h1 id="qh-title"><span>Think quantum.</span><span>Build <em>beyond.</em></span></h1>
        <p className="qh-hero-description">The smallest things can change everything.<br className="qh-desktop-break" /> Learn quantum, build circuits, and turn<br className="qh-desktop-break" /> “what if” into your next discovery.</p>
        <div className="qh-hero-actions">
          <Link href="/composer" className="qh-button qh-button-primary">Enter the Quantum Lab <ArrowUpRight size={19} /></Link>
          <a href="#playground" className="qh-text-link"><span className="qh-play-ring"><Play size={12} fill="currentColor" /></span> See it in action</a>
        </div>
        <p className="qh-guest-note"><span className="qh-check-dot"><Check size={10} /></span>No setup. No account needed to explore.</p>
        <div className="qh-hero-index"><span className="qh-index-mark">01 / ∞</span><span>A small step into<br />a much bigger universe.</span><a href="#experience" aria-label="Explore the Q-SQOOL experience"><ArrowDown size={17} /></a></div>
      </div>
      <div className="qh-hero-lab">
        <div className="qh-scene-top"><span><i /> THE POSSIBILITY ENGINE</span><span>EXP. 00{mode + 1}</span></div>
        <div className="qh-sculpture">
          <div className="qh-sculpture-grid" aria-hidden="true" />
          <div className="qh-orbit-fallback" aria-hidden="true"><i /><i /><i /></div>
          <QuantumSculpture mode={mode} angle={angle} paused={still} />
          <span className="qh-scene-coordinate qh-coordinate-top" aria-hidden="true">ψ / SPACE OF POSSIBILITIES</span>
          <span className="qh-scene-coordinate qh-coordinate-bottom" aria-hidden="true">θ {String(angle).padStart(3, "0")}° &nbsp; · &nbsp; φ 000°</span>
          <div className="qh-orb-caption"><span className="qh-crosshair" aria-hidden="true">+</span><span>{concept.label}<small>Generative artwork · Move your cursor to explore</small></span></div>
        </div>
        <div className="qh-concept-controls">
          <div className="qh-concept-tabs" role="group" aria-label="Explore quantum concepts">{concepts.map((item, index) =>
            <button type="button" key={item.title} onClick={() => setMode(index)} aria-pressed={mode === index}><span>0{index + 1}</span>{item.title}</button>)}
          </div>
          <div className="qh-state-readout"><span className="qh-mono">|ψ⟩ = {concept.formula}</span><span className="qh-theory-badge">IDEAL MODEL</span></div>
          <div className="qh-angle-control"><label htmlFor="qh-angle">{mode === 2 ? "Phase" : "Rotation"} θ</label><input id="qh-angle" type="range" min="0" max="180" step="1" value={angle}
            onChange={event => setAngle(Number(event.target.value))} aria-valuetext={`${angle} degrees; ${100 - probabilityOne}% probability of ${concept.outcomes[0]}, ${probabilityOne}% probability of ${concept.outcomes[1]}`} /><output htmlFor="qh-angle">{angle}°</output></div>
          <div className="qh-state-probabilities">{[100 - probabilityOne, probabilityOne].map((value, index) =>
            <div key={index}><span>|{concept.outcomes[index]}⟩ <strong>{value}%</strong></span><div role="meter" aria-label={`Probability of ${concept.outcomes[index]}`} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${value}%` }} /></div></div>)}
          </div>
        </div>
      </div>
    </section>

    <div className="qh-toolkit qh-container"><span>BIG IDEAS. REAL TOOLS.</span><div><span className="qh-tool"><Orbit size={21} />Qiskit</span><span className="qh-tool qh-tool-cirq"><i aria-hidden="true" />Cirq</span><span className="qh-tool"><Code2 size={23} />OpenQASM</span></div><span className="qh-toolkit-note">From visual circuits to your code.</span></div>

    <section id="experience" className="qh-section qh-container" aria-labelledby="qh-experience-title">
      <div className="qh-section-heading" data-reveal>
        <div><p className="qh-eyebrow"><span>01</span> A DIFFERENT KIND OF CLASSROOM</p><h2 id="qh-experience-title">Less memorizing.<br /><em>More lightbulb moments.</em></h2></div>
        <p>Quantum shouldn’t live behind a wall of equations. See the idea. Change something. Watch it click.</p>
      </div>
      <div className="qh-feature-grid">
        <article className="qh-feature qh-feature-learn" data-reveal onPointerMove={spotlight}>
          <div className="qh-feature-top"><span className="qh-tag">01 / LEARN BY SEEING</span><Sparkles size={19} /></div>
          <div className="qh-wave-visual" aria-hidden="true"><span>|0⟩</span><svg viewBox="0 0 440 150"><path className="qh-wave-guide" d="M0 75H440" /><path className="qh-wave qh-wave-a" d="M-80 75 Q-25 -45 30 75 T140 75 T250 75 T360 75 T470 75 T580 75" /><path className="qh-wave qh-wave-b" d="M-80 75 Q-25 195 30 75 T140 75 T250 75 T360 75 T470 75 T580 75" /></svg><span>|1⟩</span><i>Small shifts. Entirely new outcomes.</i></div>
          <h3>Make the abstract<br />feel <em>obvious.</em></h3><p>Build intuition for superposition, measurement, and entanglement, one interactive lesson at a time.</p>
          <Link href="/learn" className="qh-card-link">Explore the curriculum <ArrowUpRight size={19} /></Link>
        </article>
        <article className="qh-feature qh-feature-build" data-reveal onPointerMove={spotlight}>
          <div className="qh-feature-top"><span className="qh-tag">02 / BUILD BY DOING</span><Orbit size={19} /></div>
          <div className="qh-mini-circuit" aria-hidden="true"><div><span>q₀</span><i /><b>H</b><i /><b className="qh-control-dot">●</b><i /></div><div><span>q₁</span><i /><b className="qh-ghost-gate">I</b><i /><b className="qh-target-gate">⊕</b><i /></div><small>One Hadamard. One connection. A Bell state.</small></div>
          <h3>Your ideas.<br /><em>Now with qubits.</em></h3><p>A visual workbench for real experiments. Place gates, run a simulation, and see your circuit come to life.</p>
          <Link href="/composer" className="qh-card-link">Meet your new workbench <ArrowUpRight size={19} /></Link>
        </article>
      </div>
    </section>

    <section id="playground" className="qh-playground-section" aria-labelledby="qh-playground-title">
      <div className="qh-container">
        <div className="qh-section-heading" data-reveal><div><p className="qh-eyebrow"><span>02</span> A LITTLE EXPERIMENT</p><h2 id="qh-playground-title">Don’t take our word for it.<br /><em>Take a quantum leap.</em></h2></div><p>Three steps. Two qubits. Your first encounter with entanglement. Go on, press something.</p></div>
        <div className="qh-playground" data-reveal>
          <div className="qh-playground-toolbar"><span><span className="qh-live-dot" /> THE BELL STATE EXPERIMENT</span><span>INTERACTIVE PREVIEW <span className="qh-status-pill">READY</span></span></div>
          <div className="qh-playground-layout">
            <div className="qh-experiment-story">
              <div className="qh-stage-buttons" role="group" aria-label="Bell state experiment stages">{stages.map((item, index) => <button type="button" key={item.name} onClick={() => setStage(index)} aria-pressed={stage === index}><span>0{index + 1}</span>{item.name}<ChevronRight size={15} /></button>)}</div>
              <div className="qh-stage-copy" aria-live="polite"><span className="qh-tag">STEP 0{stage + 1}</span><h3>{activeStage.title}</h3><p>{activeStage.copy}</p></div>
              <Link href="/composer" className="qh-text-link">Keep experimenting <ArrowUpRight size={17} /></Link>
            </div>
            <div className="qh-experiment-live">
              <div className="qh-circuit-label"><span>YOUR CIRCUIT</span><span>2 QUBITS</span></div>
              <svg className="qh-live-circuit" viewBox="0 0 460 174" role="img" aria-label={`Two-qubit circuit: ${stage === 0 ? "initialized to zero" : stage === 1 ? "Hadamard on qubit zero" : "Hadamard on qubit zero, then controlled-X from qubit zero to qubit one"}`}>
                <text x="18" y="54">q₀</text><text x="18" y="124">q₁</text>
                <path className="qh-wire" d="M62 49H433M62 119H433" />
                <path className="qh-wire-active" d="M62 49H433" />
                {stage > 0 && <g className="qh-gate-appear"><rect x="151" y="29" width="40" height="40" rx="9" /><text className="qh-gate-text" x="171" y="54">H</text></g>}
                {stage > 1 && <g className="qh-gate-appear"><path className="qh-cx-line" d="M300 49V119" /><circle className="qh-cx-dot" cx="300" cy="49" r="6" /><circle className="qh-cx-target" cx="300" cy="119" r="14" /><path className="qh-cx-line" d="M291 119H309M300 110V128" /></g>}
                <text className="qh-wire-output" x="445" y="53">ψ</text><text className="qh-wire-output" x="445" y="123">ψ</text>
              </svg>
              <div className="qh-state-equation">|ψ⟩ = {activeStage.state}</div>
              <div className="qh-outcome-heading"><span>EXPECTED PROBABILITIES</span><span>Basis order: q₁q₀</span></div>
              <div className="qh-outcomes" aria-label="Ideal measurement probabilities">{activeStage.probabilities.map((value, index) => <div className="qh-outcome" key={index}><div className="qh-outcome-column"><i style={{ height: `${value}%` }} /><strong>{value}%</strong></div><span>|{["00", "01", "10", "11"][index]}⟩</span></div>)}</div>
              <p className="qh-experiment-note">Ideal mathematical preview. Run your own circuits with Qiskit Aer in the Quantum Lab.</p>
            </div>
            <div className="qh-code-window"><div className="qh-code-toolbar"><span><i /><i /><i /></span><span>bell_state.py</span><button type="button" onClick={copyCode} aria-label="Copy Bell state code" title="Copy code">{copyState === "Copied" ? <Check size={15} /> : <Copy size={15} />}</button></div>
              <pre tabIndex={0} aria-label="Qiskit code for the selected stage"><code><span><b>from</b> qiskit <b>import</b> (</span><span>    QuantumCircuit)</span><span> </span><span><i>qc</i> = QuantumCircuit(<em>2</em>)</span>{stage > 0 && <span className="qh-code-added"><i>qc</i>.h(<em>0</em>)</span>}{stage > 1 && <span className="qh-code-added"><i>qc</i>.cx(<em>0</em>, <em>1</em>)</span>}</code></pre>
              <p className="qh-code-comment"># A whole new way<br /># to connect the dots.</p>
              <div className="qh-code-footer"><Code2 size={14} /><span aria-live="polite">{copyState || "Same idea. A few lines of code."}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="paths" className="qh-section qh-container" aria-labelledby="qh-paths-title">
      <div className="qh-section-heading" data-reveal><div><p className="qh-eyebrow"><span>03</span> YOUR NEXT CHAPTER</p><h2 id="qh-paths-title">Every curious mind<br />has <em>a starting point.</em></h2></div><p>No perfect prerequisites. No single right path. Just find the thing that makes you want to know more.</p></div>
      <div className="qh-path-grid">{paths.map(({ id, name, subject, copy, href, tag, sketch, lessons, icon: Icon }, index) =>
        <Link href={href} className={`qh-path qh-path-${sketch}`} key={id} data-reveal onPointerMove={spotlight} style={{ "--reveal-delay": `${index * 70}ms` } as CSSProperties}>
          <div className="qh-path-header"><span>{id} /</span><ArrowUpRight size={22} /></div>
          <div className={`qh-path-sketch qh-sketch-${sketch}`} aria-hidden="true">{sketch === "beginner" ? <><i /><i /><span>?</span><b>+</b></> : sketch === "builder" ? <><span>H</span><i /><span>⊕</span><i /><span>M</span></> : <><i /><i /><i /><span>∞</span></>}</div>
          <p className="qh-tag">{tag}</p><h3>{name}</h3><strong>{subject}</strong><p>{copy}</p><span className="qh-path-action"><Icon size={16} />{lessons}<ArrowRight size={16} /></span>
        </Link>)}
      </div>
      <div className="qh-path-footnote" data-reveal><span><i /> Built to take you from “what’s a qubit?” to “look what I built.”</span><Link href="/learn">View all 11 modules <ArrowUpRight size={15} /></Link></div>
    </section>

    <section className="qh-faq-section qh-container" aria-labelledby="qh-faq-title">
      <div data-reveal><p className="qh-eyebrow">A FEW CLASSICAL QUESTIONS</p><h2 id="qh-faq-title">Good questions.<br /><em>Clear answers.</em></h2><p>Let’s get the uncertainty out of the way.</p></div>
      <div className="qh-faq-list" data-reveal>{[
        ["Do I need to know quantum physics?", "No. Start with the foundations and build your intuition one idea at a time. Basic algebra helps; the lessons introduce qubits, amplitudes, and measurement as you go."],
        ["Is this running on a quantum computer?", "Q-SQOOL uses Qiskit Aer, a classical simulator, to execute circuits in the Quantum Lab. The interactive examples on this page show ideal mathematical probabilities. The particle sculpture is generative artwork."],
        ["Can I explore without an account?", "Yes. The lessons and Quantum Lab are open to guests. Create an account when you want to save your learning progress across sessions and devices."],
        ["Can I take my circuits into code?", "Yes. The Code Lab connects visual circuits with Qiskit, Cirq, and OpenQASM. You can inspect, copy, and export code as you explore."],
      ].map(([question, answer], index) => <details key={question} className="qh-faq-item"><summary><span className="qh-faq-number">0{index + 1}</span>{question}<Plus size={19} /></summary><p>{answer}</p></details>)}</div>
    </section>

    <section className="qh-finale" aria-labelledby="qh-finale-title">
      <div className="qh-finale-orbits" aria-hidden="true"><i /><i /><i /><span /></div>
      <div className="qh-container" data-reveal><p className="qh-eyebrow"><span className="qh-live-dot" /> THE NEXT POSSIBILITY IS YOURS</p><h2 id="qh-finale-title">The future is<br /><em>not a spectator sport.</em></h2><p>Learn Quantum. Build Circuits. Shape the Future.</p><Link href="/dashboard" className="qh-button qh-button-primary">Let’s build something quantum <ArrowUpRight size={20} /></Link><span className="qh-finale-note">Your curiosity is the only thing you need to bring.</span></div>
    </section>

    <footer className="qh-footer qh-container"><div className="qh-footer-top"><Link href="/" className="qh-brand" aria-label="Q-SQOOL home"><Image src="/q-sqool-mark.svg" width={36} height={34} alt="" /><span>Q-SQOOL<small>SMALL PARTICLES. BIG POSSIBILITIES.</small></span></Link><nav aria-label="Footer navigation"><Link href="/learn">Learn</Link><Link href="/composer">Build</Link><Link href="/code-lab">Code</Link><Link href="/login">Join in <ArrowUpRight size={13} /></Link></nav><a href="#top" className="qh-back-top" aria-label="Back to top"><ArrowUpRight size={21} /></a></div><div className="qh-footer-bottom"><span>Made for minds that don’t stop at “what if.”</span><span>Q-SQOOL / A SCHOOL OF POSSIBILITY</span></div></footer>
  </main>;
}
