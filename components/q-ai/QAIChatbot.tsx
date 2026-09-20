"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Atom, ArrowUp, ChevronRight, RotateCcw, Sparkles, Square, LoaderCircle, X } from "lucide-react";
import { applyTutorGate, getTutorReply, groverProbability, topicForPath, type TutorReply } from "@/lib/q-ai";
import { requestChat, QUESTION_LIMIT, type ChatTurn } from "@/lib/q-ai-chat";
import ChatText from "./ChatText";
import { QAI_ASK_EVENT } from "@/lib/q-ai-actions";
import styles from "./q-ai.module.css";

type Message = { id: number; role: "user" | "assistant"; reply: TutorReply; truncated?: boolean };
const welcome: Message = { id: 0, role: "assistant", reply: { text: "Hey, I’m q-ai. Let’s make quantum click. ✨\n\nAsk me about quantum computing—from your first qubit to algorithms, hardware, error correction, and code. We can work through examples together." } };

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

function ReplyCard({ reply, onNavigate }: { reply: TutorReply; onNavigate: () => void }) {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState<number>();
  const topic = reply.topic;
  return <>
    <ChatText text={reply.text} />
    {reply.experiment === "xor" && <div className={styles.activity}><strong>Try this as an experiment</strong><p>Choose a and b, predict the result, then step through a quantum XOR circuit.</p><Link className={styles.lessonLink} href="/experiments/xor" onClick={onNavigate}>Open the interactive XOR lab →</Link></div>}
    {reply.demo === "gates" && <GateLab />}
    {reply.demo === "grover" && <GroverLab />}
    {topic && reply.mode === "steps" && <div className={styles.activity}><small>{topic.title} · Step {step + 1} of {topic.steps.length}</small><p aria-live="polite">{topic.steps[step]}</p><div className={styles.actions}><button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button><button onClick={() => setStep((step + 1) % topic.steps.length)}>{step === topic.steps.length - 1 ? "Start again" : "Next step"}<ChevronRight size={14} /></button></div></div>}
    {topic && reply.mode === "quiz" && <div className={styles.activity}><strong>{topic.quiz.question}</strong><div className={styles.answers}>{topic.quiz.options.map((option, index) => <button key={option} aria-pressed={answer === index} onClick={() => setAnswer(index)}>{option}</button>)}</div>{answer !== undefined && <p role="status">{answer === topic.quiz.answer ? "✓ Exactly! " : "Not quite. "}{topic.quiz.explanation}</p>}</div>}
    {topic && <Link className={styles.lessonLink} href={`/learn/${topic.id}`} onClick={onNavigate}>Explore the {topic.title} lesson <ChevronRight size={13} /></Link>}
  </>;
}

export default function QAIChatbot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [configured, setConfigured] = useState<boolean>();
  const [connected, setConnected] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const pending = useRef<AbortController | null>(null);
  const retry = useRef<{ turns: ChatTurn[]; question: string; page: string } | null>(null);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const controller = new AbortController();
    fetch("/api/q-ai", { signal: controller.signal, cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => { if (!controller.signal.aborted) setConfigured(data.configured === true); })
      .catch(() => {});
    return () => controller.abort();
  }, [open]);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => { if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages, busy, error, open]);
  function close() { setOpen(false); launcherRef.current?.focus(); }
  function stop() {
    pending.current?.abort();
    pending.current = null;
    setBusy(false);
    setError("Response stopped. You can retry or ask another question.");
  }
  function reset() {
    pending.current?.abort();
    pending.current = null;
    retry.current = null;
    setBusy(false); setError(undefined); setMessages([welcome]); setInput("");
    inputRef.current?.focus();
  }
  async function answer(turns: ChatTurn[], question: string, page: string) {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    retry.current = { turns, question, page };
    setBusy(true); setError(undefined);
    try {
      const response = await requestChat(turns, page, controller.signal);
      if (pending.current !== controller || controller.signal.aborted) return;
      // The model writes every answer. Local knowledge only selects optional experiments.
      const activity = getTutorReply(question, undefined, page);
      const reply: TutorReply = { text: response.text, demo: activity.demo, topic: activity.topic, experiment: activity.experiment };
      const id = nextId.current++;
      setMessages(previous => [...previous, { id, role: "assistant" as const, reply, truncated: response.truncated }].slice(-40));
      setConnected(true); setConfigured(true); retry.current = null;
    } catch (caught) {
      if (pending.current !== controller || controller.signal.aborted) return;
      setConnected(false);
      setError(caught instanceof Error ? caught.message : "q-ai couldn’t answer. Please retry.");
    } finally {
      if (pending.current === controller) { pending.current = null; setBusy(false); }
    }
  }
  function send(value: string) {
    const question = value.trim();
    if (!question || question.length > QUESTION_LIMIT || pending.current) return;
    const turns: ChatTurn[] = messages.filter(message => message.id !== 0).map(message => ({ role: message.role, content: message.reply.text }));
    turns.push({ role: "user", content: question });
    const id = nextId.current++;
    setMessages(previous => [...previous, { id, role: "user" as const, reply: { text: question } }].slice(-40));
    setInput("");
    void answer(turns, question, pathname);
    inputRef.current?.focus();
  }
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });
  useEffect(() => {
    const ask = (event: Event) => {
      const question = (event as CustomEvent<unknown>).detail;
      if (typeof question !== "string" || !question.trim()) return;
      setOpen(true);
      if (pending.current) setInput(question.slice(0, QUESTION_LIMIT));
      else sendRef.current(question.slice(0, QUESTION_LIMIT));
    };
    window.addEventListener(QAI_ASK_EVENT, ask);
    return () => window.removeEventListener(QAI_ASK_EVENT, ask);
  }, []);
  const pageTopic = topicForPath(pathname);
  const suggestions = messages.length > 1 ? ["Explain simpler", "Step by step", "Quiz me", "Show the math"] : [pageTopic ? `Explain ${pageTopic.title}` : "Explain Shor’s algorithm", "Help me write Qiskit code", "Quantum error correction"];
  return <div className={styles.widget}>
    {open && <section id="q-ai-panel" className={styles.panel} role="dialog" aria-label="q-ai quantum tutor" onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
      <header className={styles.header}><span className={styles.avatar}><Atom size={23} /></span><div><strong>q-ai {connected && <span className={styles.online} />}</strong><small>{busy ? "Thinking through your question…" : "Your quantum AI companion"}</small></div><button aria-label="Start a new q-ai chat" title="New chat" onClick={reset}><RotateCcw size={17} /></button><button aria-label="Close q-ai" onClick={close}><X size={20} /></button></header>
      <div className={styles.strip}><Sparkles size={13} /> Explore it. Try it. Understand it.</div>
      {configured === false && <div className={styles.notice} role="status">AI answers aren’t connected yet. The site owner needs to finish setup. You can still explore the gate lab below.</div>}
      <div ref={logRef} className={styles.messages} role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
        {messages.map(message => <article key={message.id} className={`${styles.message} ${message.role === "user" ? styles.user : styles.assistant}`}><small className={styles.author}>{message.role === "user" ? "You" : "q-ai"}</small>{message.role === "user" ? <p className={styles.text}>{message.reply.text}</p> : <ReplyCard reply={message.reply} onNavigate={close} />}{message.truncated && <button className={styles.continue} disabled={busy} onClick={() => send("Continue from where your answer stopped.")}>Continue answer <ChevronRight size={13} /></button>}</article>)}
        {busy && <p className={styles.thinking} role="status"><LoaderCircle size={15} /> q-ai is thinking…</p>}
        {error && <div className={styles.error} role="alert"><p>{error}</p><button disabled={busy} onClick={() => { const last = retry.current; if (last) void answer(last.turns, last.question, last.page); }}>Retry answer</button></div>}
        <details className={styles.lab}><summary>Open the interactive gate lab</summary><GateLab /></details>
      </div>
      <div className={styles.suggestions}>{suggestions.map(suggestion => <button key={suggestion} disabled={busy} onClick={() => send(suggestion)}>{suggestion}</button>)}</div>
      <form className={styles.form} onSubmit={event => { event.preventDefault(); send(input); }}><textarea ref={inputRef} aria-label="Ask q-ai a quantum question" placeholder="Ask anything about quantum computing…" value={input} maxLength={QUESTION_LIMIT} rows={2} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(input); } }} />{busy ? <button type="button" aria-label="Stop response" onClick={stop}><Square size={16} /></button> : <button type="submit" aria-label="Send message" disabled={!input.trim()}><ArrowUp size={19} /></button>}</form>
      <footer className={styles.footer}>Powered by Groq · Messages sent to AI · Answers may be imperfect</footer>
    </section>}
    <button ref={launcherRef} className={styles.launcher} aria-label={open ? "Close q-ai chatbot" : "Open q-ai chatbot"} aria-expanded={open} aria-controls="q-ai-panel" onClick={() => open ? close() : setOpen(true)}>{open ? <X size={22} /> : <Atom size={23} />}<span>q-ai</span></button>
  </div>;
}
