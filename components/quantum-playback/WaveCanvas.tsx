"use client";

import { useEffect, useRef } from "react";
import { basisLabel, blochVector, phaseAt, probabilityAt, type PlaybackFrame } from "@/lib/quantum-playback";

export type WaveView = "Waves" | "Amplitudes" | "Bloch";
type Props = { frame: PlaybackFrame; qubits: number; view: WaveView; page: number; playing: boolean; speed: number; still: boolean; onAdvance: () => void };
const TAU = Math.PI * 2;
const color = (phase: number, alpha = 1) => `hsla(${165 + (phase + Math.PI) / TAU * 125}, 85%, 72%, ${alpha})`;

export function WaveCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const settings = useRef(props);
  useEffect(() => { settings.current = props; canvas.current?.dispatchEvent(new Event("wave-update")); }, [props]);

  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext("2d");
    if (!element || !ctx) return;
    let width = 1, height = 1, raf = 0, last = 0, elapsed = 0, clock = 0, visible = false;
    let previousFrame = settings.current.frame;
    const before = previousFrame.before.slice(), after = previousFrame.after.slice();
    const line = (x: number, y: number, endX: number, endY: number, stroke: string, thickness = 1) => {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.strokeStyle = stroke; ctx.lineWidth = thickness; ctx.stroke();
    };
    const text = (value: string, x: number, y: number, fill = "#a5b6ca", size = 10) => {
      ctx.fillStyle = fill; ctx.font = `${size}px ui-monospace, monospace`; ctx.fillText(value, x, y);
    };
    const draw = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) { last = 0; return; }
      const { frame, qubits, view, page, playing, speed, still, onAdvance } = settings.current;
      const delta = last ? Math.min(50, now - last) : 0; last = now;
      if (frame !== previousFrame) { elapsed = 0; previousFrame = frame; }
      if (playing && !still) { elapsed += delta * speed; clock += delta * speed / 1000; }
      const blend = still ? 1 : 1 - Math.exp(-Math.max(delta, 16) / 90);
      let settling = false;
      for (let i = 0; i < before.length; i++) {
        const a = frame.before[i] - before[i], b = frame.after[i] - after[i];
        if (Math.abs(a) + Math.abs(b) > .001) settling = true;
        before[i] += a * blend; after[i] += b * blend;
      }
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#080f1c"; ctx.fillRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width * .48, height * .48, 0, width * .48, height * .48, width * .6);
      glow.addColorStop(0, "#172039"); glow.addColorStop(1, "#080f1c"); ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
      for (let x = 24; x < width; x += 32) for (let y = 24; y < height; y += 32) {
        ctx.fillStyle = "#26354b"; ctx.fillRect(x, y, 1, 1);
      }
      // Qubit rail keeps controlled operations legible above the joint-state lanes.
      const railWidth = Math.min(width - 80, 300), railLeft = (width - railWidth) / 2;
      if (frame.gate?.target !== undefined) {
        const start = railLeft + (frame.gate.qubit + .5) * railWidth / qubits;
        const end = railLeft + (frame.gate.target + .5) * railWidth / qubits;
        line(start, 32, end, 32, "#9e8fff", 2);
      }
      for (let q = 0; q < qubits; q++) {
        const x = railLeft + (q + .5) * railWidth / qubits;
        const active = q === frame.gate?.qubit || q === frame.gate?.target;
        ctx.fillStyle = active ? "#aaa0ff" : "#243249"; ctx.beginPath(); ctx.arc(x, 32, active ? 5 : 3, 0, TAU); ctx.fill();
        text(`q${q}`, x - 6, 54, active ? "#ded9ff" : "#91a4be");
      }
      if (view === "Bloch") {
        const cols = Math.min(qubits, width < 500 ? 2 : 3), rows = Math.ceil(qubits / cols);
        const cellW = width / cols, cellH = (height - 90) / rows;
        for (let q = 0; q < qubits; q++) {
          const cx = (q % cols + .5) * cellW, cy = 75 + (Math.floor(q / cols) + .5) * cellH;
          const radius = Math.min(cellW * .31, cellH * .32, 105), v = blochVector(after, q);
          ctx.strokeStyle = "#475776"; ctx.lineWidth = 1;
          for (const squash of [1, .34]) { ctx.beginPath(); ctx.ellipse(cx, cy, radius, radius * squash, 0, 0, TAU); ctx.stroke(); }
          ctx.beginPath(); ctx.ellipse(cx, cy, radius * .35, radius, -.3, 0, TAU); ctx.stroke();
          line(cx, cy - radius, cx, cy + radius, "#394865");
          const px = cx + radius * (v.x * .85 + v.y * .42), py = cy + radius * (v.y * .28 - v.z * .9);
          line(cx, cy, px, py, "#79eed6", 2.5); ctx.fillStyle = "#bcfff1"; ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill();
          text("|0⟩", cx + 8, cy - radius, "#a9bbd2"); text("|1⟩", cx + 8, cy + radius, "#a9bbd2");
          text(`q${q} · ${v.purity < .999 ? "mixed" : "pure"}`, cx - 38, cy + radius + 24, "#c7d7e9");
        }
      } else {
        const count = Math.min(8, 2 ** qubits - page * 8), left = width < 500 ? 54 : 76, right = width - (width < 500 ? 54 : 76);
        const gateX = left + (right - left) * .45, rowH = (height - 128) / count;
        text(view === "Waves" ? "INPUT" : "AMPLITUDE", left, 83); text(view === "Waves" ? "OUTPUT" : "PHASE", right - 40, 83);
        if (view === "Waves") {
          ctx.fillStyle = "rgba(163,146,255,.06)"; ctx.fillRect(gateX - 16, 96, 32, height - 125);
          line(gateX, 96, gateX, height - 29, "rgba(182,164,255,.35)");
        }
        for (let lane = 0; lane < count; lane++) {
          const index = page * 8 + lane, y = 107 + (lane + .5) * rowH;
          const p = probabilityAt(after, index), phase = phaseAt(after, index);
          text(`|${basisLabel(index, qubits)}⟩`, 10, y + 3, "#c4d2e5", width < 500 ? 9 : 11);
          line(left, y, right, y, "#26334a");
          if (view === "Amplitudes") {
            const barW = (right - left) * .8;
            ctx.fillStyle = "#202d43"; ctx.fillRect(left, y - 6, barW, 12);
            ctx.fillStyle = color(phase); ctx.fillRect(left, y - 6, Math.sqrt(p) * barW, 12);
            text(p > 1e-10 ? `${(phase / Math.PI).toFixed(2)}π` : "—", right - 22, y + 4, "#c2baff");
          } else {
            const maxHeight = Math.min(29, rowH * .32);
            for (let ribbon = 0; ribbon < 3; ribbon++) {
              ctx.beginPath();
              for (let x = left; x <= right; x += 2) {
                const mix = Math.max(0, Math.min(1, (x - gateX + 24) / 48));
                const re = before[index * 2] * (1 - mix) + after[index * 2] * mix;
                const im = before[index * 2 + 1] * (1 - mix) + after[index * 2 + 1] * mix;
                const theta = (x - left) / (right - left) * TAU * 3 - clock * 2 + ribbon * .13;
                const py = y - (re * Math.sin(theta) + im * Math.cos(theta)) * maxHeight * (1 - ribbon * .15);
                if (x === left) ctx.moveTo(x, py); else ctx.lineTo(x, py);
              }
              ctx.strokeStyle = color(phase, ribbon === 0 ? .95 : .22); ctx.lineWidth = ribbon === 0 ? 1.7 : 4; ctx.stroke();
            }
            // Tracers follow the same complex-valued wave, with no random particles.
            if (p > 1e-8) for (let dot = 0; dot < 3; dot++) {
              const x = gateX + 26 + ((clock * .13 + dot / 3) % 1) * Math.max(1, right - gateX - 26);
              const theta = (x - left) / (right - left) * TAU * 3 - clock * 2;
              const py = y - (after[index * 2] * Math.sin(theta) + after[index * 2 + 1] * Math.cos(theta)) * maxHeight;
              ctx.fillStyle = color(phase, .85); ctx.beginPath(); ctx.arc(x, py, 1.5 + Math.sqrt(p), 0, TAU); ctx.fill();
            }
            const gate = frame.gate;
            if (gate && ["H", "X", "Y", "RX", "RY", "CX"].includes(gate.type)) {
              const paired = index ^ (1 << (gate.type === "CX" ? gate.target! : gate.qubit));
              const enabled = gate.type !== "CX" || Boolean(index & (1 << gate.qubit));
              if (enabled && paired >= page * 8 && paired < page * 8 + count && probabilityAt(before, index) > 1e-8) {
                const pairedY = 107 + (paired - page * 8 + .5) * rowH;
                const transfer = gate.type === "RX" || gate.type === "RY" ? Math.abs(Math.sin(gate.angle! / 2)) : gate.type === "H" ? Math.SQRT1_2 : 1;
                ctx.beginPath(); ctx.moveTo(gateX - 35, y); ctx.bezierCurveTo(gateX, y, gateX, pairedY, gateX + 35, pairedY);
                ctx.strokeStyle = color(phaseAt(before, index), transfer * .5); ctx.lineWidth = 1.5; ctx.stroke();
              }
            }
          }
          text(`${(p * 100).toFixed(1)}%`, right + 8, y + 3, p > .001 ? "#b4f7e5" : "#8b9ab0", 10);
        }
        if (frame.kind === "measurement" && playing && !still) {
          const progress = Math.min(1, elapsed / 1800);
          line(left + (right - left) * progress, 98, left + (right - left) * progress, height - 24, `rgba(133,255,225,${.5 * (1 - progress)})`, 2);
        }
      }
      if (playing && !still && elapsed >= 1900) { elapsed = 0; onAdvance(); }
      if ((playing && !still) || settling) raf = requestAnimationFrame(draw);
    };
    const schedule = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); };
    const update = () => { last = 0; schedule(); };
    const resize = () => {
      const bounds = element.getBoundingClientRect(); width = bounds.width; height = bounds.height;
      const dpr = Math.min(devicePixelRatio || 1, 2); element.width = width * dpr; element.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); schedule();
    };
    const visibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } last = 0; schedule(); };
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) { cancelAnimationFrame(raf); raf = 0; }
      last = 0; schedule();
    });
    const observer = new ResizeObserver(resize); observer.observe(element); intersection.observe(element); resize();
    element.addEventListener("wave-update", update); document.addEventListener("visibilitychange", visibility);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); intersection.disconnect(); element.removeEventListener("wave-update", update); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  return <canvas ref={canvas} className="qw-canvas" aria-hidden="true" />;
}
