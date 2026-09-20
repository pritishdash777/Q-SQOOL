"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Atom, ArrowUp, ChevronRight, RotateCcw, Sparkles, X } from "lucide-react";
import { applyTutorGate, getTutorReply, groverProbability, topicForPath, type TutorReply } from "@/lib/q-ai";
import styles from "./q-ai.module.css";

type Message = { id: number; role: "user" | "assistant"; reply: TutorReply };
const welcome: Message = { id: 0, role: "assistant", reply: { text: "Hey, I’m q-ai. Let’s make quantum click. ✨\n\nAsk about a gate or algorithm, then learn by trying it, walking through the steps, or testing yourself." } };

function Probability({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  return <div className={styles.probability}><span>{label}</span><div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${percent}%` }} /></div><span>{percent}%</span></div>;
}

function GateLab() {
  const [state, setState] = useState<[number, number]>([1, 0]);
  const [sequence, setSequence] = useState<string[]>([]);
  return <div className={styles.activity}>
    <strong>Try it · one qubit</strong><p>Apply gates and watch the state change.</p>
    <div className={styles.actions}>{(["H", "X", "Z"] as const).map(gate => <button key={gate} onClick={() => { setState(previous => applyTutorGate(previous, gate)); setSequence(previous => [...previous.slice(-11), gate]); }}>Apply {gate}</button>)}<button aria-label="Reset qubit" onClick={() => { setState([1, 0]); setSequence([]); }}><RotateCcw size={14} /></button></div>
    <div className={styles.state} aria-live="polite">{state[0].toFixed(3)} |0⟩ + ({state[1].toFixed(3)}) |1⟩</div>
    <Probability label="|0⟩" value={state[0] ** 2} /><Probability label="|1⟩" value={state[1] ** 2} />
    <small>{sequence.length ? `Recent gates: ${sequence.join(" → ")}` : "Start in |0⟩. Try H → Z → H."}</small>
  </div>;
}

function GroverLab() {
  const [iterations, setIterations] = useState(0);
  return <div className={styles.activity}><strong>Find one item among four</strong><p>See how extra iterations can overshoot the answer.</p><label className={styles.range}>Grover iterations: {iterations}<input type="range" min="0" max="4" value={iterations} onChange={event => setIterations(Number(event.target.value))} /></label><Probability label="Success" value={groverProbability(iterations)} /><small>Ideal circuit · one marked item · four candidates</small></div>;
}

function ReplyCard({ reply }: { reply: TutorReply }) {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<number>();
  const topic = reply.topic;
  return <>
    <p className={styles.text}>{reply.text}</p>
    {reply.demo === "gates" && <GateLab />}
    {reply.demo === "grover" && <GroverLab />}
    {topic && reply.mode === "steps" && <div className={styles.activity}><small>{topic.title} · Step {step + 1} of {topic.steps.length}</small><p aria-live="polite">{topic.steps[step]}</p><div className={styles.actions}><button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button><button onClick={() => setStep((step + 1) % topic.steps.length)}>{step === topic.steps.length - 1 ? "Start again" : "Next step"}<ChevronRight size={14} /></button></div></div>}
    {topic && reply.mode === "quiz" && <div className={styles.activity}><strong>{topic.quiz.question}</strong><div className={styles.answers}>{topic.quiz.options.map((option, index) => <button key={option} aria-pressed={answer === index} onClick={() => setAnswer(index)}>{option}</button>)}</div>{answer !== undefined && <p role="status">{answer === topic.quiz.answer ? "✓ Exactly! " : "Not quite. "}{topic.quiz.explanation}</p>}</div>}
    {topic && <Link className={styles.lessonLink} href={`/learn/${topic.id}`}>Explore the {topic.title} lesson <ChevronRight size={13} /></Link>}
  </>;
}

export default function QAIChatbot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [topicId, setTopicId] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages, open]);
  function close() { setOpen(false); launcherRef.current?.focus(); }
  function send(value: string) {
    const question = value.trim().slice(0, 500);
    if (!question) return;
    const reply = getTutorReply(question, topicId, pathname);
    if (reply.topic) setTopicId(reply.topic.id);
    const userId = nextId.current++;
    const assistantId = nextId.current++;
    setMessages(previous => [...previous, { id: userId, role: "user" as const, reply: { text: question } }, { id: assistantId, role: "assistant" as const, reply }].slice(-40));
    setInput("");
    inputRef.current?.focus();
  }
  const pageTopic = topicForPath(pathname);
  const suggestions = topicId ? ["Explain simpler", "Step by step", "Quiz me", "Show the math"] : [pageTopic ? `Explain ${pageTopic.title}` : "How does an H gate work?", "Grover’s algorithm", "Entanglement"];
  return <div className={styles.widget}>
    {open && <section id="q-ai-panel" className={styles.panel} role="dialog" aria-label="q-ai quantum tutor" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header className={styles.header}><span className={styles.avatar}><Atom size={23} /></span><div><strong>q-ai <span className={styles.online} /></strong><small>Your quantum companion</small></div><button aria-label="Start a new q-ai chat" title="New chat" onClick={() => { setMessages([welcome]); setTopicId(undefined); setInput(""); inputRef.current?.focus(); }}><RotateCcw size={17} /></button><button aria-label="Close q-ai" onClick={close}><X size={20} /></button></header>
      <div className={styles.strip}><Sparkles size={13} /> Explore it. Try it. Understand it.</div>
      <div ref={logRef} className={styles.messages} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">{messages.map(message => <article key={message.id} className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant}`}><small className={styles.author}>{message.role === "user" ? "You" : "q-ai"}</small>{message.role === "user" ? <p className={styles.text}>{message.reply.text}</p> : <ReplyCard reply={message.reply} />}</article>)}</div>
      <div className={styles.suggestions}>{suggestions.map(suggestion => <button key={suggestion} onClick={() => send(suggestion)}>{suggestion}</button>)}</div>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); send(input); }}><input ref={inputRef} aria-label="Ask q-ai a quantum question" placeholder="Ask about gates, algorithms…" value={input} maxLength={500} onChange={event => setInput(event.target.value)} autoComplete="off" /><button type="submit" aria-label="Send message" disabled={!input.trim()}><ArrowUp size={19} /></button></form>
      <footer className={styles.footer}>Guided by Q-SQOOL lessons · interactive, local answers</footer>
    </section>}
    <button ref={launcherRef} className={styles.launcher} aria-label={open ? "Close q-ai chatbot" : "Open q-ai chatbot"} aria-expanded={open} aria-controls="q-ai-panel" onClick={() => open ? close() : setOpen(true)}>{open ? <X size={22} /> : <Atom size={23} />}<span>q-ai</span>{!open && <span className={styles.launcherDot} />}</button>
  </div>;
}
