"use client";

import { useId, useState } from "react";
import { RotateCcw } from "lucide-react";
import "./bloch-explorer.css";

type Vector = [number, number, number];
const radians = (degrees: number) => degrees * Math.PI / 180;
const tidy = (value: number) => (Math.abs(value) < .0005 ? 0 : value).toFixed(3);
const presets = [
  { label: "|0⟩", theta: 0, phi: 0 }, { label: "|1⟩", theta: 180, phi: 0 },
  { label: "|+⟩", theta: 90, phi: 0 }, { label: "|−⟩", theta: 90, phi: 180 },
  { label: "|+i⟩", theta: 90, phi: 90 }, { label: "|−i⟩", theta: 90, phi: 270 },
];

// Fixed orthographic camera: changing the state never rotates the coordinate axes.
function project([x, y, z]: Vector) {
  const yaw = radians(34), pitch = radians(22);
  const horizontal = x * Math.cos(yaw) - y * Math.sin(yaw);
  const depth = x * Math.sin(yaw) + y * Math.cos(yaw);
  return { x: 250 + horizontal * 166, y: 222 + (depth * Math.sin(pitch) - z * Math.cos(pitch)) * 166,
    depth: depth * Math.cos(pitch) + z * Math.sin(pitch) };
}

function curve(points: Vector[], front: boolean) {
  let drawing = false;
  return points.map(point => {
    const projected = project(point);
    if ((projected.depth >= 0) !== front) { drawing = false; return ""; }
    const command = drawing ? "L" : "M";
    drawing = true;
    return `${command}${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
  }).join(" ");
}

const circles: Vector[][] = [
  ...[-60, -30, 0, 30, 60].map(latitude => Array.from({ length: 181 }, (_, i): Vector => {
    const a = i * Math.PI / 90, elevation = radians(latitude);
    return [Math.cos(elevation) * Math.cos(a), Math.cos(elevation) * Math.sin(a), Math.sin(elevation)];
  })),
  ...[0, 45, 90, 135].map(longitude => Array.from({ length: 181 }, (_, i): Vector => {
    const a = i * Math.PI / 90, azimuth = radians(longitude);
    return [Math.cos(a) * Math.cos(azimuth), Math.cos(a) * Math.sin(azimuth), Math.sin(a)];
  })),
];

export function BlochExplorer() {
  const [theta, setTheta] = useState(65);
  const [phi, setPhi] = useState(40);
  const id = useId().replace(/:/g, "");
  const t = radians(theta), p = radians(phi);
  const vector: Vector = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const tip = project(vector), base = project([vector[0], vector[1], 0]);
  const alpha = Math.cos(t / 2), betaReal = Math.sin(t / 2) * Math.cos(p), betaImaginary = Math.sin(t / 2) * Math.sin(p);
  const probabilities = [alpha ** 2 * 100, Math.sin(t / 2) ** 2 * 100];
  const selected = presets.find(preset => preset.theta === theta && (theta === 0 || theta === 180 || preset.phi === phi % 360));
  const choose = (nextTheta: number, nextPhi: number) => { setTheta(nextTheta); setPhi(nextPhi); };

  return <section id="bloch-sphere" className="qh-section qh-container qh-bloch-section" aria-labelledby={`${id}-title`}>
    <div className="qh-section-heading" data-reveal>
      <div><p className="qh-eyebrow"><span>04</span> ONE LAST POSSIBILITY TO EXPLORE</p><h2 id={`${id}-title`}>Your qubit.<br /><em>Your point of view.</em></h2></div>
      <p>Change the angles. Watch the state move. Explore every pure single-qubit state on the Bloch sphere.</p>
    </div>
    <div className="qh-bloch-panel" data-reveal>
      <div className="qh-bloch-display">
        <div className="qh-bloch-topline"><span><i className="qh-live-dot" /> LIVE BLOCH SPHERE</span><span>{selected?.label || "CUSTOM STATE"}</span></div>
        <svg viewBox="0 0 500 452" className="qh-bloch-svg" role="img" aria-label={`Bloch sphere: theta ${theta} degrees, phi ${phi} degrees. State vector x ${tidy(vector[0])}, y ${tidy(vector[1])}, z ${tidy(vector[2])}.`}>
          <defs>
            <radialGradient id={`${id}-sphere`} cx="36%" cy="27%" r="78%"><stop offset="0" stopColor="var(--qh-purple)" stopOpacity=".13" /><stop offset=".7" stopColor="var(--qh-mint)" stopOpacity=".04" /><stop offset="1" stopColor="var(--qh-purple)" stopOpacity=".09" /></radialGradient>
            <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="var(--qh-purple)" /></marker>
          </defs>
          <circle cx="250" cy="222" r="166" fill={`url(#${id}-sphere)`} className="qh-bloch-outline" />
          {circles.map((points, index) => <path key={`back-${index}`} d={curve(points, false)} className={`qh-bloch-grid qh-bloch-grid-back ${index === 2 ? "qh-bloch-equator" : ""}`} />)}
          {([[[1, 0, 0], "x"], [[0, 1, 0], "y"], [[0, 0, 1], "z"]] as [Vector, string][]).map(([axis, label]) => {
            const positive = project(axis.map(value => value * 1.17) as Vector), negative = project(axis.map(value => value * -1.1) as Vector);
            return <g key={label}><line x1={negative.x} y1={negative.y} x2={positive.x} y2={positive.y} className="qh-bloch-axis" /><text x={positive.x + (label === "z" ? 14 : 0)} y={positive.y + (label === "z" ? 5 : 20)} className="qh-bloch-axis-label">{label}</text></g>;
          })}
          {circles.map((points, index) => <path key={`front-${index}`} d={curve(points, true)} className={`qh-bloch-grid ${index === 2 ? "qh-bloch-equator" : ""}`} />)}
          <path d={`M250 222L${base.x} ${base.y}L${tip.x} ${tip.y}`} className="qh-bloch-projection" />
          <circle cx={base.x} cy={base.y} r="3" className="qh-bloch-base" />
          <line x1="250" y1="222" x2={tip.x} y2={tip.y} className="qh-bloch-vector" strokeDasharray={tip.depth < 0 ? "6 4" : undefined} markerEnd={`url(#${id}-arrow)`} />
          <circle cx="250" cy="222" r="4" className="qh-bloch-origin" />
          <circle cx={tip.x} cy={tip.y} r="13" className="qh-bloch-tip-halo" /><circle cx={tip.x} cy={tip.y} r="5" className="qh-bloch-tip" />
          <text x="250" y="32" className="qh-bloch-pole">|0⟩</text><text x="250" y="425" className="qh-bloch-pole">|1⟩</text>
        </svg>
        <div className="qh-bloch-coordinates" aria-label="Bloch vector coordinates">{vector.map((value, index) => <div key={index}><span>{["x", "y", "z"][index]}</span><output>{tidy(value)}</output></div>)}</div>
        <p className="qh-bloch-caption">Solid vector: front hemisphere · Dashed vector: back hemisphere</p>
      </div>
      <div className="qh-bloch-controls">
        <div className="qh-bloch-controls-heading"><div><span className="qh-tag">STATE CONTROLS</span><h3>Move through possibility.</h3></div><button type="button" className="qh-icon-button" onClick={() => choose(65, 40)} aria-label="Reset Bloch sphere angles" title="Reset angles"><RotateCcw size={17} /></button></div>
        {[{ symbol: "θ", name: "Polar angle", value: theta, max: 180, set: setTheta, description: "From the north pole |0⟩ to the south pole |1⟩." },
          { symbol: "φ", name: "Relative phase", value: phi, max: 360, set: setPhi, description: "Around the equator. Changes phase, not Z-basis probabilities." }].map((control, index) => <div className="qh-bloch-control" key={control.symbol}>
          <div><label htmlFor={`${id}-angle-${index}`}><strong>{control.symbol}</strong> {control.name}</label><span><input type="number" min="0" max={control.max} step="1" value={control.value} aria-label={`${control.name} in degrees`} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) control.set(Math.round(Math.min(control.max, Math.max(0, value)))); }} />°</span></div>
          <input id={`${id}-angle-${index}`} type="range" min="0" max={control.max} step="1" value={control.value} aria-valuetext={`${control.value} degrees`} onChange={event => control.set(Number(event.target.value))} />
          <div className="qh-bloch-range-labels"><span>0°</span><span>{control.max / 2}°</span><span>{control.max}°</span></div><p>{control.description}</p>
        </div>)}
        <div className="qh-bloch-presets" role="group" aria-label="Common qubit states">{presets.map(preset => <button type="button" key={preset.label} aria-pressed={selected?.label === preset.label} onClick={() => choose(preset.theta, preset.phi)}>{preset.label}</button>)}</div>
        <div className="qh-bloch-state"><span className="qh-tag">YOUR QUANTUM STATE</span><p>|ψ⟩ = cos(θ/2)|0⟩ + e<sup>iφ</sup>sin(θ/2)|1⟩</p><output>{tidy(alpha)}|0⟩ + ({tidy(betaReal)} {betaImaginary < -.0005 ? "−" : "+"} {tidy(Math.abs(betaImaginary))}i)|1⟩</output></div>
        <div className="qh-bloch-probabilities"><span className="qh-tag">MEASUREMENT PROBABILITIES · Z BASIS</span>{probabilities.map((value, index) => <div key={index}><div><span>Measure |{index}⟩</span><output>{value.toFixed(1)}%</output></div><div role="meter" aria-label={`Probability of measuring ${index}`} aria-valuenow={Number(value.toFixed(1))} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${value}%` }} /></div></div>)}</div>
        <p className="qh-bloch-caption">Ideal pure-state model. Coordinates and amplitudes are rounded; no backend simulation is required.</p>
      </div>
    </div>
  </section>;
}
