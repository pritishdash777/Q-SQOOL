"use client";

import { useEffect, useRef } from "react";
import { startIntroParticles } from "./intro-particles";
import styles from "./quantum-intro.module.css";

const SESSION_KEY = "q-sqool-intro-seen";
let seenWithoutStorage = false;
const pins = [-54, -18, 18, 54];

/** Decorative overlay only: the landing page and its data mount independently. */
export function QuantumIntro() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const dismiss = useRef(() => {});
  const claimed = useRef(false);

  useEffect(() => {
    const element = root.current!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let seen = seenWithoutStorage;
    try { seen ||= sessionStorage.getItem(SESSION_KEY) === "true"; } catch { /* In-memory fallback. */ }
    if (seen && !claimed.current) return;
    claimed.current = true; // Allows React's development effect replay, not a route remount.
    seenWithoutStorage = true;
    try { sessionStorage.setItem(SESSION_KEY, "true"); } catch { /* Storage can be blocked. */ }
    if (motion.matches || document.hidden) return;

    let stopped = false;
    let timer = 0;
    let stopParticles = () => {};
    const previousFocus = document.activeElement;
    const finish = () => {
      if (stopped) return;
      stopped = true;
      element.hidden = true;
      delete element.dataset.playing;
      clearTimeout(timer);
      stopParticles();
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", finish);
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("pagehide", finish);
      motion.removeEventListener("change", finish);
      element.removeEventListener("wheel", preventScroll);
      if (document.activeElement === skip.current) {
        skip.current?.blur();
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); finish(); }
      // Let keyboard users proceed into the already-rendered page immediately.
      if (["Tab", "PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp"].includes(event.key)) finish();
    };
    const onFocus = (event: FocusEvent) => { if (!element.contains(event.target as Node)) finish(); };
    const preventScroll = (event: WheelEvent) => event.preventDefault();
    dismiss.current = finish;
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", finish);
    document.addEventListener("focusin", onFocus);
    window.addEventListener("pagehide", finish);
    motion.addEventListener("change", finish);
    element.addEventListener("wheel", preventScroll, { passive: false });
    element.hidden = false;
    element.dataset.playing = "true";
    skip.current?.focus({ preventScroll: true });
    timer = window.setTimeout(finish, 4400); // Independent of canvas/CSS completion.
    try { stopParticles = startIntroParticles(canvas.current!, finish); } catch { finish(); }
    return finish;
  }, []);

  return <div ref={root} hidden className={styles.intro} aria-label="Q-SQOOL opening animation">
    <div className={styles.art} aria-hidden="true">
      <div className={styles.halo} />
      <svg className={styles.chip} viewBox="-180 -180 360 360" fill="none">
        <rect className={styles.shell} x="-96" y="-96" width="192" height="192" rx="16" />
        <g className={styles.traces}>
          {[0, 90, 180, 270].map(rotation => <g key={rotation} transform={`rotate(${rotation})`}>
            {pins.map((x, i) => <g key={x}>
              <path pathLength="1" d={`M${x} -155 V-108 L${x * .7} -88 V-43`} />
              <circle cx={x} cy="-155" r="3" />
              <path className={styles.pulse} pathLength="1" style={{ animationDelay: `${.95 + i * .07}s` }} d={`M${x} -155 V-108 L${x * .7} -88 V-43`} />
            </g>)}
          </g>)}
        </g>
        <rect className={styles.rim} x="-85" y="-85" width="170" height="170" rx="10" />
        <g className={styles.gate}>
          <rect x="-40" y="-40" width="80" height="80" rx="12" />
          <path d="M-14 -20 V20 M14 -20 V20 M-14 0 H14" />
        </g>
      </svg>
      <canvas ref={canvas} className={styles.particles} />
      <div className={styles.flash} /><div className={styles.wave} />
      <div className={styles.caption}><span>Q-SQOOL</span><small>A WORLD OF POSSIBILITY</small></div>
    </div>
    <button ref={skip} type="button" className={styles.skip} onClick={() => dismiss.current()}>Skip intro <span aria-hidden="true">↗</span></button>
  </div>;
}
