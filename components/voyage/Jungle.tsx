"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { JungleScene, trailLayout, type Env } from "./jungle";
import { chapters } from "@/lib/story";
import { trails, type Find } from "@/lib/jungle";

type Key = number | "summit" | "extra";

export default function Jungle({ index, env, onClose }: { index: number; env: Env; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<JungleScene | null>(null);
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState<Key | null>(null);
  const [found, setFound] = useState<Set<Key>>(new Set());
  const [leaving, setLeaving] = useState(false);
  const ch = chapters[index];
  const trail = trails[index];
  const layout = useMemo(() => trailLayout(trail.stops.length, mobile), [trail.stops.length, mobile]);

  useEffect(() => {
    const m = () => setMobile(window.innerWidth < 760);
    m();
    const scene = new JungleScene(canvasRef.current!, ch.kind, env, index);
    sceneRef.current = scene;
    const onResize = () => {
      m();
      scene.resize();
    };
    const onMove = (e: PointerEvent) => scene.pointer(e.clientX, e.clientY);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      scene.destroy();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    sceneRef.current?.leave();
    setTimeout(onClose, 650);
  };

  const pick = (k: Key) => {
    setOpen((o) => (o === k ? null : k));
    setFound((f) => new Set(f).add(k));
  };

  const item: Find | undefined = open === null ? undefined : open === "summit" ? trail.summit : open === "extra" ? trail.extra : trail.stops[open];
  const pos = open === null ? null : open === "summit" ? layout.summit : open === "extra" ? layout.extra : layout.stops[open];
  const stopsFound = trail.stops.filter((_, k) => found.has(k)).length;
  const complete = stopsFound === trail.stops.length && found.has("summit");

  return (
    <div className={`jungle absolute inset-0 z-40 ${leaving ? "jungle-out" : ""}`} onClick={() => setOpen(null)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_0%_0%,rgba(4,24,30,0.55),transparent_70%)]" />

      {/* the trail up the mountain */}
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path d={layout.d} pathLength={1} className="trail-glow" />
        <path d={layout.d} pathLength={1} className="trail-line" />
      </svg>

      {/* header */}
      <div className="jungle-head pointer-events-none absolute top-5 left-5 max-w-[78%] md:top-8 md:left-10 md:max-w-md">
        <p className="text-xs font-semibold tracking-[0.25em] text-white/75 uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
          Island {ch.n} · {ch.island}
        </p>
        <h2 className="mt-2 font-display text-4xl leading-[1] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] md:text-6xl">{ch.title}</h2>
        <p className="mt-3 text-sm text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
          {complete ? "Island explored ✦" : `Climb the trail · ${stopsFound} of ${trail.stops.length} found`}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        className="jungle-back absolute right-4 bottom-5 z-20 flex items-center gap-2 rounded-full bg-black/35 px-5 py-3 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/55 md:right-auto md:bottom-8 md:left-10"
      >
        <span aria-hidden>←</span> Back to the canoe
      </button>

      {/* waypoints */}
      {trail.stops.map((s, k) => {
        const p = layout.stops[k];
        const right = p.x < 0.5;
        return (
          <button
            key={s.title}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pick(k);
            }}
            className={`waypoint group absolute z-10 flex items-center gap-2.5 ${right ? "" : "flex-row-reverse"} ${found.has(k) ? "is-found" : ""} ${open === k ? "is-open" : ""}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, "--d": `${1.2 + k * 0.22}s` } as CSSProperties}
            aria-label={s.title}
          >
            <span className="wp-dot" />
            <span className="wp-label">{s.title}</span>
          </button>
        );
      })}

      {/* summit */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          pick("summit");
        }}
        className={`summit absolute z-10 flex flex-col items-center ${found.has("summit") ? "is-found" : ""}`}
        style={{ left: `${layout.summit.x * 100}%`, top: `${layout.summit.y * 100}%`, "--d": `${1.3 + trail.stops.length * 0.22}s` } as CSSProperties}
        aria-label={`Summit: ${trail.summit.title}`}
      >
        <svg viewBox="0 0 40 48" className="summit-flag h-12 w-10" aria-hidden>
          <line x1="8" y1="4" x2="8" y2="46" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          <path className="flag-cloth" d="M9 5 C 18 2, 24 10, 36 7 L 34 21 C 24 24, 18 16, 9 19 Z" fill="#e9c46a" />
        </svg>
        <span className="summit-label">{trail.summit.title}</span>
      </button>

      {/* a hidden extra in the foliage */}
      {trail.extra && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            pick("extra");
          }}
          className={`extra absolute z-10 ${found.has("extra") ? "is-found" : ""}`}
          style={{ left: `${layout.extra.x * 100}%`, top: `${layout.extra.y * 100}%` }}
          aria-label="Something glinting in the leaves"
          title="Something glinting…"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
            <path d="M12 1 Q12.8 11.2 23 12 Q12.8 12.8 12 23 Q11.2 12.8 1 12 Q11.2 11.2 12 1 Z" fill="#fff6d6" />
          </svg>
        </button>
      )}

      {/* the card for whatever you just found */}
      {item && pos && (
        <div
          className={`absolute z-30 ${mobile ? "inset-x-3 bottom-[84px]" : ""}`}
          style={
            mobile
              ? undefined
              : {
                  left: `clamp(12px, calc(${pos.x * 100}% - 160px), calc(100% - 332px))`,
                  top: `${pos.y * 100}%`,
                  transform: pos.y < 0.55 ? "translateY(34px)" : "translateY(calc(-100% - 34px))",
                }
          }
        >
          <div
            key={String(open)}
            onClick={(e) => e.stopPropagation()}
            className="find-card relative w-full rounded-2xl bg-[#08201c]/85 p-5 text-white ring-1 ring-white/20 backdrop-blur-xl md:w-[320px]"
          >
            {open === "summit" && <p className="mb-1 text-xs tracking-[0.2em] text-gold uppercase">The summit</p>}
            {open === "extra" && <p className="mb-1 text-xs tracking-[0.2em] text-gold uppercase">Found something</p>}
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-3xl leading-[1.05]">{item.title}</h3>
              {item.status && (
                <span className={`mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${item.status === "Accepted" ? "bg-gold text-[#1a1206]" : "bg-white/15 text-white/85"}`}>
                  {item.status}
                </span>
              )}
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-white/85">{item.line}</p>
            {item.chips && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.chips.map((c) => (
                  <span key={c} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/85 ring-1 ring-white/15">
                    {c}
                  </span>
                ))}
              </div>
            )}
            {item.link && (
              <a href={item.link.href} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-gold underline decoration-gold/40 underline-offset-4">
                {item.link.label} →
              </a>
            )}
            {open === "summit" && <span className="summit-burst" aria-hidden />}
          </div>
        </div>
      )}
    </div>
  );
}
