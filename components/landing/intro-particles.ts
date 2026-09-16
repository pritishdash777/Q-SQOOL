const clamp = (n: number) => Math.max(0, Math.min(1, n));
const easeOut = (n: number) => 1 - (1 - n) ** 3;

/** One finite timeline; all random data is created inside the client effect. */
export function startIntroParticles(canvas: HTMLCanvasElement, complete: () => void) {
  const ctx = canvas.getContext("2d");
  if (!ctx) { complete(); return () => {}; }
  const mobile = matchMedia("(max-width: 640px), (pointer: coarse)").matches;
  const particles = Array.from({ length: mobile ? 72 : 160 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    // Sample chip edges, traces, and the H's two stems / crossbar.
    const edge = Math.random() * 192 - 96;
    const side = i % 4;
    const gate = i % 3 === 0;
    const x = gate ? (i % 2 ? -14 : 14) : side < 2 ? edge : (side === 2 ? -96 : 96);
    const y = gate ? Math.random() * 40 - 20 : side < 2 ? (side === 0 ? -96 : 96) : edge;
    return { x, y, angle, radius: 145 + Math.random() * 150, size: .7 + Math.random() * 1.5, violet: i % 3 === 0 };
  });
  let width = 0, height = 0, scale = 1, frame = 0, stopped = false;
  const resize = () => {
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(width * .82, height * .6, 420) / 360;
  };
  resize();
  window.addEventListener("resize", resize);
  const start = performance.now();
  const stop = () => { stopped = true; cancelAnimationFrame(frame); window.removeEventListener("resize", resize); ctx.clearRect(0, 0, width, height); };
  const draw = (now: number) => {
    if (stopped) return;
    const t = (now - start) / 1000;
    if (t >= 4) { stop(); complete(); return; }
    ctx.clearRect(0, 0, width, height);
    const dark = document.documentElement.dataset.theme !== "light";
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    for (const p of particles) {
      let x = p.x, y = p.y, alpha = 0;
      if (t < 1.55) {
        const u = easeOut(clamp((t - .45) / .95));
        const radius = (1 - u) * p.radius;
        // Converging motes resolve into the Hadamard letter.
        x = (p.violet ? -14 : 14) + Math.cos(p.angle) * radius;
        y = p.y * .2 + Math.sin(p.angle) * radius;
        alpha = clamp((t - .45) * 4) * (1 - clamp((t - 1.25) / .3));
      } else if (t >= 1.95 && t < 3.2) {
        const outward = easeOut(clamp((t - 1.95) / .48));
        const inward = clamp((t - 2.48) / .72);
        const contraction = 1 - inward ** 2.6;
        const angle = p.angle + inward * inward * 1.7;
        x = (p.x + Math.cos(angle) * p.radius * outward) * contraction;
        y = (p.y + Math.sin(angle) * p.radius * outward) * contraction;
        alpha = clamp((t - 1.95) / .12) * (1 - clamp((t - 3.1) / .1));
      }
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha * .85;
      ctx.fillStyle = p.violet ? (dark ? "#bfa2ff" : "#7639c9") : (dark ? "#65e8ef" : "#007f89");
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = dark ? 8 : 3;
      ctx.beginPath(); ctx.arc(width / 2 + x * scale, height / 2 + y * scale, p.size * scale, 0, Math.PI * 2); ctx.fill();
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return stop;
}
