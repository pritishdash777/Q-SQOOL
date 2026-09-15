"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "./scatter-text.css";

/** The original text owns layout and accessibility; the character layer is decorative. */
export function ScatterText({ children }: { children: string }) {
  return <span className="scatter-text" role="img" aria-label={children}>
    <span className="scatter-original" aria-hidden="true">{children}</span>
    <span className="scatter-letters" aria-hidden="true">{Array.from(children).map((letter, index) =>
      <span className="scatter-letter" key={index}>{letter}</span>
    )}</span>
  </span>;
}

export function ScatterCard({ children, className }: { children: ReactNode; className: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dustRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current!;
    const dust = dustRef.current!;
    const vicinity = card.parentElement!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)");
    const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const capable = (device.hardwareConcurrency || 8) > 4 && (device.deviceMemory || 8) > 4 && !device.connection?.saveData;
    const letters = Array.from(card.querySelectorAll<HTMLElement>(".scatter-letter")).map((el, i) => ({
      el, i, x: 0, y: 0, vx: 0, vy: 0, rotation: 0,
      anchor: el.parentElement!.previousElementSibling as HTMLElement,
    }));
    const particles = Array.from(dust.children) as HTMLElement[];
    const births = particles.map(() => -Infinity);
    let frame = 0, previous = 0, burstUntil = 0, lastDust = 0, particleIndex = 0;
    let active = false, pointerX = 0, pointerY = 0, tiltX = 0, tiltY = 0;
    let disposed = false;

    // Measure native text ranges without the card's decorative rotation/float.
    // This preserves kerning, collapsed spaces, and the original element dimensions.
    const measure = () => {
      const saved = card.style.cssText;
      card.style.animation = "none";
      card.style.transform = "none";
      card.style.rotate = "none";
      card.querySelectorAll<HTMLElement>(".scatter-text").forEach(parent => {
        const original = parent.querySelector<HTMLElement>(".scatter-original")!;
        const node = original.firstChild;
        if (!node) return;
        const origin = parent.getBoundingClientRect();
        let offset = 0;
        parent.querySelectorAll<HTMLElement>(".scatter-letter").forEach(el => {
          const range = document.createRange();
          range.setStart(node, offset);
          offset += el.textContent!.length;
          range.setEnd(node, offset);
          const rect = range.getBoundingClientRect();
          el.style.left = `${rect.left - origin.left}px`;
          el.style.top = `${rect.top - origin.top}px`;
          el.style.width = `${rect.width}px`;
          el.style.height = `${rect.height}px`;
          el.style.lineHeight = `${rect.height}px`;
        });
      });
      card.style.cssText = saved;
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      active = false;
      burstUntil = 0;
      tiltX = tiltY = 0;
      card.style.removeProperty("transform");
      card.removeAttribute("data-scattering");
      letters.forEach(l => {
        l.x = l.y = l.vx = l.vy = l.rotation = 0;
        l.el.style.removeProperty("transform");
        l.el.style.removeProperty("text-shadow");
      });
      particles.forEach((el, i) => { el.style.opacity = "0"; births[i] = -Infinity; });
    };
    const tick = (now: number) => {
      frame = 0;
      if (reduced.matches || document.hidden) { reset(); return; }
      const dt = Math.min((now - previous) / 16.667 || 1, 2);
      previous = now;
      if (burstUntil && now >= burstUntil) { active = false; burstUntil = 0; }
      const bounds = card.getBoundingClientRect();
      let moving = active;
      // Read all anchors before writing transforms; displaced glyphs never feed back into geometry.
      const anchors = letters.map(l => l.anchor.getBoundingClientRect());
      letters.forEach((l, index) => {
        const anchor = anchors[index];
        const dx = anchor.left + parseFloat(l.el.style.left || "0") + l.el.offsetWidth / 2 - pointerX;
        const dy = anchor.top + anchor.height / 2 - pointerY;
        const distance = Math.hypot(dx, dy);
        const influence = active ? Math.max(0, 1 - distance / 115) ** 2 : 0;
        const angle = l.i * 2.399963;
        const tx = (distance > 1 ? dx / distance : Math.cos(angle)) * influence * 12;
        const ty = (distance > 1 ? dy / distance : Math.sin(angle)) * influence * 12;
        l.vx = (l.vx + (tx - l.x) * .15 * dt) * Math.pow(.65, dt);
        l.vy = (l.vy + (ty - l.y) * .15 * dt) * Math.pow(.65, dt);
        l.x += l.vx * dt; l.y += l.vy * dt;
        l.rotation += ((Math.sin(angle) * influence * 9) - l.rotation) * Math.min(1, .2 * dt);
        const amount = Math.min(1, Math.hypot(l.x, l.y) / 10);
        moving ||= Math.abs(l.x) + Math.abs(l.y) + Math.abs(l.vx) + Math.abs(l.vy) + Math.abs(l.rotation) > .025;
        l.el.style.transform = `translate3d(${l.x}px,${l.y}px,0) rotate(${l.rotation}deg)`;
        l.el.style.textShadow = `0 0 5px rgb(6 182 212 / ${amount * .65}), 0 0 9px rgb(139 92 246 / ${amount * .45})`;
      });
      const targetX = active ? -(pointerY - bounds.top - bounds.height / 2) / bounds.height * 2 : 0;
      const targetY = active ? (pointerX - bounds.left - bounds.width / 2) / bounds.width * 2 : 0;
      tiltX += (targetX - tiltX) * Math.min(1, .12 * dt);
      tiltY += (targetY - tiltY) * Math.min(1, .12 * dt);
      card.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      moving ||= Math.abs(tiltX) + Math.abs(tiltY) > .01;
      if (active && now - lastDust > 55) {
        const i = particleIndex++ % particles.length;
        births[i] = now;
        particles[i].style.left = `${Math.max(0, Math.min(1, (pointerX - bounds.left) / bounds.width)) * 100}%`;
        particles[i].style.top = `${Math.max(0, Math.min(1, (pointerY - bounds.top) / bounds.height)) * 100}%`;
        lastDust = now;
      }
      particles.forEach((el, i) => {
        const age = (now - births[i]) / 360;
        const alive = age < 1;
        el.style.opacity = alive ? `${(1 - age) * .45}` : "0";
        if (alive) el.style.transform = `translate(${Math.cos(i * 2.4) * age * 13}px,${Math.sin(i * 2.4) * age * 13}px) scale(${1 - age * .6})`;
        moving ||= alive;
      });
      if (moving) frame = requestAnimationFrame(tick);
      else reset();
    };
    const start = (event: PointerEvent, burst: boolean) => {
      if (reduced.matches) return;
      pointerX = event.clientX; pointerY = event.clientY;
      active = true;
      burstUntil = burst ? performance.now() + 180 : 0;
      if (!frame) {
        measure();
        card.setAttribute("data-scattering", "true");
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = card.getBoundingClientRect();
      const near = event.clientX >= rect.left - 28 && event.clientX <= rect.right + 28 &&
        event.clientY >= rect.top - 28 && event.clientY <= rect.bottom + 28;
      if (near) start(event, false);
      else active = false;
    };
    const down = (event: PointerEvent) => start(event, true);
    const leave = () => { if (!burstUntil) active = false; };
    const configure = () => {
      reset();
      vicinity.removeEventListener("pointermove", move);
      vicinity.removeEventListener("pointerenter", move);
      if (!reduced.matches && fine.matches && capable) {
        vicinity.addEventListener("pointermove", move, { passive: true });
        vicinity.addEventListener("pointerenter", move, { passive: true });
      }
    };
    const resize = new ResizeObserver(() => { reset(); measure(); });
    resize.observe(card);
    document.fonts.ready.then(() => { if (!disposed) { reset(); measure(); } });
    configure();
    card.addEventListener("pointerdown", down, { passive: true });
    vicinity.addEventListener("pointerleave", leave, { passive: true });
    card.addEventListener("pointercancel", reset, { passive: true });
    reduced.addEventListener("change", configure);
    fine.addEventListener("change", configure);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      disposed = true;
      reset(); resize.disconnect();
      vicinity.removeEventListener("pointermove", move);
      vicinity.removeEventListener("pointerenter", move);
      card.removeEventListener("pointerdown", down);
      vicinity.removeEventListener("pointerleave", leave);
      card.removeEventListener("pointercancel", reset);
      reduced.removeEventListener("change", configure);
      fine.removeEventListener("change", configure);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, []);

  return <div ref={cardRef} className={`${className} scatter-card`}>
    {children}
    <div ref={dustRef} className="scatter-dust" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} />)}</div>
  </div>;
}
