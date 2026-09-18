"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";

type Particle = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  depth: number;
  opacity: number;
  phase: number;
  color: number;
};

type Shooter = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
};

type Ripple = {
  x: number;
  y: number;
  life: number;
};

const TAU = Math.PI * 2;

export function QuantumBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);

  useEffect(() => {
    themeRef.current = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let resizeFrame = 0;
    let shootTimer = 0;
    let lastTime = performance.now();
    let scrollTarget = 0;
    let scrollOffset = 0;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = document.visibilityState === "visible";
    const pointer = { x: -1000, y: -1000, active: false };
    const particles: Particle[] = [];
    const shooters: Shooter[] = [];
    const ripples: Ripple[] = [];

    const random = (() => {
      let seed = 0x5f3759df;
      return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    })();

    const resetParticle = (particle: Particle, keepPosition = false) => {
      particle.x = keepPosition ? particle.x : random() * width;
      particle.y = keepPosition ? particle.y : random() * height;
      particle.radius = 0.55 + random() * 1.7;
      particle.vx = (random() - 0.5) * 0.07;
      particle.vy = 0.035 + random() * 0.12;
      particle.depth = 0.25 + random() * 0.75;
      particle.opacity = 0.18 + random() * 0.62;
      particle.phase = random() * TAU;
      particle.color = Math.floor(random() * 3);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const targetCount = width < 700 ? 64 : Math.min(138, Math.max(90, Math.floor((width * height) / 11500)));
      while (particles.length < targetCount) {
        const particle = {} as Particle;
        resetParticle(particle);
        particles.push(particle);
      }
      particles.length = targetCount;
      for (const particle of particles) {
        particle.x = ((particle.x % width) + width) % width;
        particle.y = ((particle.y % height) + height) % height;
      }
    };

    const scheduleResize = () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resize();
      });
    };

    const drawConnections = (time: number) => {
      if (reducedMotion || width < 700) return;
      context.lineWidth = 0.55;
      for (let index = 0; index < particles.length; index += 7) {
        const first = particles[index];
        const second = particles[(index + 13) % particles.length];
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        if (dx * dx + dy * dy > 12500) continue;
        context.strokeStyle = `rgba(105, 196, 255, ${0.05 + Math.sin(time / 900 + first.phase) * 0.02})`;
        context.beginPath();
        context.moveTo(first.x, first.y + scrollOffset * first.depth);
        context.lineTo(second.x, second.y + scrollOffset * second.depth);
        context.stroke();
      }
    };

    const drawConstellation = (time: number) => {
      if (reducedMotion || width < 700) return;
      const cycle = (time % 12000) / 12000;
      const fade = cycle < 0.18 ? cycle / 0.18 : cycle > 0.78 ? (1 - cycle) / 0.22 : 1;
      const left = width * 0.12;
      const top = height * (0.24 + (cycle % 0.3) * 0.18);
      const span = Math.min(width * 0.42, 560);
      context.lineWidth = 0.7;
      context.strokeStyle = `rgba(113, 205, 255, ${0.12 * fade})`;
      context.fillStyle = `rgba(198, 167, 255, ${0.2 * fade})`;
      context.beginPath();
      context.moveTo(left, top);
      context.lineTo(left + span, top);
      for (const point of [0.34, 0.68]) {
        context.moveTo(left + span * point, top);
        context.lineTo(left + span * point, top + 58);
      }
      context.stroke();
      for (const point of [0.34, 0.68]) {
        context.beginPath();
        context.arc(left + span * point, top, 4, 0, TAU);
        context.fill();
      }
      context.strokeStyle = `rgba(67, 231, 255, ${0.16 * fade})`;
      context.beginPath();
      context.moveTo(left + span * 0.34, top + 58);
      context.lineTo(left + span * 0.68, top + 58);
      context.stroke();
      context.font = "11px ui-monospace, monospace";
      context.fillStyle = `rgba(198, 167, 255, ${0.22 * fade})`;
      context.fillText("H", left + span * 0.34 - 4, top - 10);
      context.fillText("CX", left + span * 0.68 - 8, top - 10);
    };

    const drawRipples = (delta: number) => {
      context.lineWidth = 1;
      for (let index = ripples.length - 1; index >= 0; index--) {
        const ripple = ripples[index];
        ripple.life -= delta / 800;
        if (ripple.life <= 0) {
          ripples.splice(index, 1);
          continue;
        }
        const radius = (1 - ripple.life) * 72;
        context.strokeStyle = `rgba(67, 231, 255, ${ripple.life * 0.28})`;
        context.beginPath();
        context.arc(ripple.x, ripple.y, radius, 0, TAU);
        context.stroke();
      }
    };

    const drawShooters = () => {
      if (reducedMotion || width < 700) return;
      context.lineWidth = 1.2;
      for (const shooter of shooters) {
        const tailX = shooter.x - shooter.vx * 16, tailY = shooter.y - shooter.vy * 16;
        const gradient = context.createLinearGradient(shooter.x, shooter.y, tailX, tailY);
        gradient.addColorStop(0, "rgba(99, 235, 255, .8)");
        gradient.addColorStop(1, "rgba(157, 111, 255, 0)");
        context.strokeStyle = gradient;
        context.beginPath();
        context.moveTo(shooter.x, shooter.y);
        context.lineTo(tailX, tailY);
        context.stroke();
      }
    };

    const scheduleShooter = () => {
      if (reducedMotion || !visible) return;
      shootTimer = window.setTimeout(() => {
        if (shooters.length < 2) {
          shooters.push({ x: random() * width, y: random() * height * 0.45, vx: 7 + random() * 4, vy: 2 + random() * 2, life: 1 });
        }
        scheduleShooter();
      }, 5000 + random() * 7000);
    };

    const draw = (now: number) => {
      animationFrame = 0;
      if (!visible) return;
      const delta = Math.min(32, now - lastTime);
      lastTime = now;
      const seconds = now / 1000;
      const dark = themeRef.current === "dark";
      const palette = dark
        ? ["198, 167, 255", "67, 231, 255", "92, 132, 255"]
        : ["79, 70, 229", "8, 145, 178", "99, 102, 241"];

      scrollOffset += (scrollTarget - scrollOffset) * (reducedMotion ? 0.04 : 0.075);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      drawConstellation(now);
      drawConnections(now);
      drawRipples(delta);
      for (const particle of particles) {
        const pointerDx = particle.x - pointer.x;
        const pointerDy = particle.y - pointer.y;
        const pointerDistance = Math.hypot(pointerDx, pointerDy);
        if (!reducedMotion && pointer.active && pointerDistance < 105 && pointerDistance > 0) {
          const force = (105 - pointerDistance) / 105;
          particle.x += (pointerDx / pointerDistance) * force * 0.7;
          particle.y += (pointerDy / pointerDistance) * force * 0.7;
        }
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        if (particle.x < -8) particle.x = width + 8;
        if (particle.x > width + 8) particle.x = -8;
        if (particle.y > height + 12) particle.y = -12;
        const pulse = 0.72 + Math.sin(seconds * (0.6 + particle.depth) + particle.phase) * 0.28;
        const proximity = pointerDistance < 125 ? (125 - pointerDistance) / 125 : 0;
        const alpha = Math.max(0.04, particle.opacity * pulse + proximity * 0.24);
        const x = particle.x;
        const y = particle.y + Math.max(-34, Math.min(34, scrollOffset * particle.depth));
        const radius = particle.radius * (0.8 + particle.depth * 0.45);
        context.shadowBlur = particle.depth > 0.72 ? 10 : 4;
        context.shadowColor = context.fillStyle = `rgba(${palette[particle.color]}, ${alpha})`;
        context.beginPath();
        context.arc(x, y, radius, 0, TAU);
        context.fill();
      }

      for (let index = shooters.length - 1; index >= 0; index--) {
        const shooter = shooters[index];
        shooter.x += shooter.vx * delta / 16;
        shooter.y += shooter.vy * delta / 16;
        shooter.life -= delta / 650;
        if (shooter.life <= 0 || shooter.x > width + 80 || shooter.y > height + 80) shooters.splice(index, 1);
      }
      drawShooters();
      context.shadowBlur = 0;
      context.globalCompositeOperation = "source-over";
      if (!reducedMotion || particles.length) animationFrame = requestAnimationFrame(draw);
    };

    const handlePointer = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = event.pointerType !== "touch" || event.type === "pointerdown";
    };
    const handlePointerDown = (event: PointerEvent) => {
      handlePointer(event);
      if (!reducedMotion && ripples.length < 2) ripples.push({ x: event.clientX, y: event.clientY, life: 1 });
    };
    const clearPointer = () => { pointer.active = false; };
    const handleScroll = () => { scrollTarget = Math.max(-1, Math.min(1, window.scrollY / Math.max(window.innerHeight, 1))) * 34; };
    const handleVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible && !animationFrame) {
        lastTime = performance.now();
        animationFrame = requestAnimationFrame(draw);
        scheduleShooter();
      }
    };
    const handleReducedMotion = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) shooters.length = 0;
      else scheduleShooter();
    };

    resize();
    handleScroll();
    const listen = <K extends keyof WindowEventMap>(type: K, handler: (event: WindowEventMap[K]) => void) => {
      window.addEventListener(type, handler, { passive: true });
      return () => window.removeEventListener(type, handler);
    };
    const unlisten = [listen("resize", scheduleResize), listen("scroll", handleScroll),
      listen("pointermove", handlePointer), listen("pointerdown", handlePointerDown), listen("pointerleave", clearPointer)];
    document.addEventListener("visibilitychange", handleVisibility);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", handleReducedMotion);
    animationFrame = requestAnimationFrame(draw);
    scheduleShooter();

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      window.clearTimeout(shootTimer);
      unlisten.forEach(remove => remove());
      document.removeEventListener("visibilitychange", handleVisibility);
      media.removeEventListener("change", handleReducedMotion);
    };
  }, []);

  return (
    <div className="quantum-background" aria-hidden="true" data-theme={resolvedTheme}>
      <canvas ref={canvasRef} />
      <div className="quantum-aurora" />
      <div className="quantum-grid" />
    </div>
  );
}
