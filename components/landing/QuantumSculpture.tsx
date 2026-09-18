"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

type Props = { mode: number; angle: number; paused: boolean };
const TAU = Math.PI * 2;

// Generative artwork, independent of the mathematical probability preview.
// Canvas keeps the particle field out of React's render loop.
export function QuantumSculpture({ mode, angle, paused }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const settings = useRef({ mode, angle, paused, theme: resolvedTheme });

  useEffect(() => {
    settings.current = { mode, angle, paused, theme: resolvedTheme };
    canvasRef.current?.dispatchEvent(new Event("sculpture-update"));
  }, [mode, angle, paused, resolvedTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const host = canvas.parentElement!;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, frame = 0, previous = 0, time = 0;
    let visible = true, disposed = false;
    let pointerX = 0, pointerY = 0, tiltX = 0, tiltY = 0;
    const positions = new Float32Array(180 * 12 * 3);
    let initialized = false;
    let lastMode = settings.current.mode, lastAngle = settings.current.angle;

    const project = (x: number, y: number, z: number, spin: number) => {
      const yaw = spin + tiltX * .28;
      const x1 = x * Math.cos(yaw) - z * Math.sin(yaw);
      const z1 = x * Math.sin(yaw) + z * Math.cos(yaw);
      const pitch = -.52 + tiltY * .2;
      const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
      const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
      const scale = Math.min(width, height) * .43 * (3.4 / (3.4 + z2 * .4));
      return { x: width / 2 + (x1 * .97 - y1 * .24) * scale,
        y: height / 2 + (x1 * .24 + y1 * .97) * scale, z: z2 };
    };

    const draw = (now: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      const { mode, angle, paused, theme } = settings.current;
      const still = paused || motion.matches;
      const delta = Math.min(50, now - previous || 16);
      if (!still && delta < 30) { frame = requestAnimationFrame(draw); return; }
      previous = now;
      // Advance the artwork at a steady pace.
      const smoothing = .075;
      if (!still) {
        time += delta / 1000;
        tiltX += (pointerX - tiltX) * smoothing;
        tiltY += (pointerY - tiltY) * smoothing;
      }
      const shapeChanged = mode !== lastMode || angle !== lastAngle;
      const dark = theme === "dark";
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = dark ? "lighter" : "source-over";
      const glow = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * .46);
      glow.addColorStop(0, dark ? "rgba(100,72,180,.11)" : "rgba(92,61,170,.055)");
      glow.addColorStop(1, "rgba(100,72,180,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const spin = .35 + time * .085;
      // Fine orbital contours give the sculpture a sense of depth.
      for (let orbit = 0; orbit < 3; orbit++) {
        context.beginPath();
        for (let j = 0; j <= 140; j++) {
          const a = j / 140 * TAU;
          const point = project(Math.cos(a) * 1.13, Math.sin(a) * (orbit === 1 ? .38 : .9),
            Math.sin(a) * (orbit === 1 ? .92 : .17) + Math.cos(a) * orbit * .14, spin + orbit * .8);
          if (j === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
        }
        context.strokeStyle = dark ? "rgba(173,176,224,.10)" : "rgba(80,99,144,.15)";
        context.lineWidth = .6;
        context.stroke();
      }

      const columns = width < 500 ? 110 : 180;
      const particles: { x: number; y: number; z: number; color: string; alpha: number; index: number }[] = [];
      for (let band = 0; band < 12; band++) {
        for (let j = 0; j < columns; j++) {
          const u = j / columns * TAU;
          const v = band / 12 * TAU;
          const index = (band * 180 + j) * 3;
          let x: number, y: number, z: number;
          if (mode === 0) {
            const latitude = Math.acos(1 - 2 * (band + .5) / 12);
            const radius = .87 + .035 * Math.sin(u * 3 + time * .3);
            x = radius * Math.sin(latitude) * Math.cos(u);
            y = radius * Math.cos(latitude);
            z = radius * Math.sin(latitude) * Math.sin(u);
          } else if (mode === 1) {
            const radius = .64 + .23 * Math.cos(3 * u) + .07 * Math.cos(v);
            x = radius * Math.cos(2 * u);
            y = radius * Math.sin(2 * u);
            z = .3 * Math.sin(3 * u) + .09 * Math.sin(v);
          } else {
            const radius = .65 + .24 * Math.cos(v);
            x = radius * Math.cos(u);
            y = .25 * Math.sin(v) + .09 * Math.sin(u * 4 + angle / 180 * Math.PI);
            z = radius * Math.sin(u);
          }
          const breathe = 1 + .025 * Math.sin(time * .8 + angle / 90);
          // A paused redraw must preserve particle positions.
          const amount = !initialized || (still && shapeChanged) ? 1 : still ? 0 : smoothing;
          positions[index] += (x * breathe - positions[index]) * amount;
          positions[index + 1] += (y * breathe - positions[index + 1]) * amount;
          positions[index + 2] += (z * breathe - positions[index + 2]) * amount;
          const point = project(positions[index], positions[index + 1], positions[index + 2], spin);
          const tint = (Math.sin(u + band * .3) + 1) / 2;
          const color = dark
            ? `${Math.round(116 + tint * 73)},${Math.round(224 - tint * 91)},${Math.round(212 + tint * 43)}`
            : `${Math.round(24 + tint * 84)},${Math.round(123 - tint * 68)},${Math.round(119 + tint * 72)}`;
          particles.push({ ...point, color, alpha: .3 + (point.z + 1) * .27, index: band * columns + j });
        }
      }
      initialized = true;
      lastMode = mode; lastAngle = angle;
      // Connect neighboring points into a softly illuminated woven surface.
      context.lineWidth = .55;
      for (let i = 1; i < particles.length; i++) {
        const point = particles[i], last = particles[i - 1];
        if (i % columns === 0 || Math.hypot(point.x - last.x, point.y - last.y) > 34) continue;
        context.strokeStyle = `rgba(${point.color},${dark ? .16 : .2})`;
        context.beginPath(); context.moveTo(last.x, last.y); context.lineTo(point.x, point.y); context.stroke();
      }
      particles.sort((a, b) => a.z - b.z);
      for (const point of particles) {
        context.fillStyle = `rgba(${point.color},${point.alpha})`;
        context.beginPath(); context.arc(point.x, point.y, .5 + (point.z + 1) * .4, 0, TAU); context.fill();
      }
      // A few bright moving nodes, rather than expensive per-particle shadows.
      for (let i = 0; i < 3; i++) {
        const a = time * .25 + i * TAU / 3;
        const point = project(Math.cos(a) * 1.06, Math.sin(a) * .73, Math.sin(a * 2) * .3, spin);
        const light = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, 15);
        light.addColorStop(0, dark ? "rgba(172,245,229,.8)" : "rgba(35,126,117,.65)");
        light.addColorStop(.16, dark ? "rgba(147,227,222,.4)" : "rgba(35,126,117,.15)");
        light.addColorStop(1, "rgba(100,190,210,0)");
        context.fillStyle = light; context.fillRect(point.x - 15, point.y - 15, 30, 30);
      }
      if (!still) frame = requestAnimationFrame(draw);
    };

    const schedule = () => {
      if (!disposed && !frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = bounds.width; height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      schedule();
    };
    const move = (event: PointerEvent) => {
      if (motion.matches || settings.current.paused || event.pointerType !== "mouse") return;
      const rect = host.getBoundingClientRect();
      pointerX = (event.clientX - rect.left) / rect.width * 2 - 1;
      pointerY = (event.clientY - rect.top) / rect.height * 2 - 1;
    };
    const leave = () => { pointerX = pointerY = 0; };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else { previous = performance.now(); schedule(); }
    };
    const resizeObserver = new ResizeObserver(resize);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) { previous = performance.now(); schedule(); }
      else { cancelAnimationFrame(frame); frame = 0; }
    });
    resizeObserver.observe(host); observer.observe(host); resize();
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    canvas.addEventListener("sculpture-update", schedule);
    motion.addEventListener("change", schedule);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); observer.disconnect();
      host.removeEventListener("pointermove", move); host.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("sculpture-update", schedule); motion.removeEventListener("change", schedule);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="qh-sculpture-canvas" aria-hidden="true" />;
}
