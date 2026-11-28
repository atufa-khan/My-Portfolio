"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { JungleScene, trailLayout, twinPeaks, type Env } from "./jungle";
import { experience } from "@/lib/data";
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
  const twin = index === 1; // the Current: two peaks, one per internship
  const trail = trails[index];
  const layout = useMemo(() => trailLayout(trail.stops.length, mobile, index), [trail.stops.length, mobile, index]);

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

  const item: Find | undefined = open === "extra" ? trail.extra : undefined;
  const pos = open === null ? null : open === "summit" ? layout.summit : open === "extra" ? layout.extra : layout.stops[open];

  return (
    <div className={`jungle absolute inset-0 z-40 ${leaving ? "jungle-out" : ""}`} onClick={() => setOpen(null)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_0%_0%,rgba(4,24,30,0.55),transparent_70%)]" />

      {twin && <TwinSummits mobile={mobile} />}

      {!twin && (<>
      {/* the trail up the mountain */}
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="trail pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path d={layout.d} className="trail-glow" />
        <path d={layout.d} className="trail-line" />
      </svg>

      </>)}

      {/* header */}
      <div className="jungle-head pointer-events-none absolute top-5 left-5 max-w-[78%] md:top-8 md:left-10 md:max-w-md">
        <p className="text-xs font-semibold tracking-[0.25em] text-white/75 uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
          Island {ch.n} · {ch.island}
        </p>
        <h2 className="mt-2 font-display text-4xl leading-[1] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.55)] md:text-6xl">{ch.title}</h2>
        <p className="mt-3 text-sm text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
          {twin ? "Two summits, two internships" : "Follow the trail to the summit ↑"}
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

      {/* waypoints: each one always shows its details beside it */}
      {!twin && trail.stops.map((s, k) => {
        const p = layout.stops[k];
        // desktop: cards sit outward on both sides of the trail; mobile: inward
        const right = mobile ? p.x < 0.5 : p.x > 0.5;
        return (
          <div
            key={s.title}
            className={`waypoint absolute z-10 flex items-center gap-3 ${right ? "" : "flex-row-reverse"}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, "--d": `${1.1 + k * 0.25}s` } as CSSProperties}
          >
            <span className="wp-dot" />
            <div className={`wp-card ${right ? "" : "text-right"}`}>
              <h3 className="font-display text-lg leading-tight text-white md:text-[22px]">
                {s.title}
                {s.status && (
                  <span className={`ml-2 inline-block rounded-full px-2 py-0.5 align-middle font-sans text-[10px] font-semibold ${s.status === "Accepted" ? "bg-gold text-[#1a1206]" : "bg-white/15 text-white/85"}`}>
                    {s.status}
                  </span>
                )}
              </h3>
              <p className="mt-1 hidden text-[13.5px] leading-snug text-white/85 md:block">{s.line}</p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/85 md:hidden">
                {s.chips && s.line.length < 40 ? s.chips.join(" · ") : s.line}
              </p>
              {s.chips && (
                <div className={`mt-2 hidden flex-wrap gap-1 md:flex ${right ? "" : "justify-end"}`}>
                  {s.chips.map((c) => (
                    <span key={c} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/85 ring-1 ring-white/15">
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {s.link && (
                <a href={s.link.href} target="_blank" rel="noreferrer" className="mt-1.5 hidden text-xs font-medium text-gold underline decoration-gold/40 underline-offset-2 md:inline-block">
                  {s.link.label} →
                </a>
              )}
            </div>
          </div>
        );
      })}

      {!twin && (<>
      {/* summit */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
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
        <span className="summit-line">{trail.summit.line}</span>
      </button>

      </>)}
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


/** Island II: one peak per internship, the company written at the top, full details beneath. */
function TwinSummits({ mobile }: { mobile: boolean }) {
  const peaks = twinPeaks(mobile);
  const Detail = ({ k }: { k: number }) => {
    const j = experience[k];
    return (
      <div className="intern-card rounded-2xl bg-[#06201c]/85 p-5 text-white ring-1 ring-white/20 backdrop-blur-xl md:p-6" style={{ "--d": `${1.2 + k * 0.35}s` } as CSSProperties}>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">{k === 0 ? "Industry internship" : "Research internship"}</p>
        <h3 className="mt-1 font-display text-2xl leading-tight md:text-[28px]">{j.company}</h3>
        <p className="mt-1 text-sm font-medium text-white/90 md:text-[15px]">{j.role}</p>
        <p className="mt-0.5 text-[13px] text-white/65">
          {j.period} · {j.place}
        </p>
        <ul className="mt-3 space-y-2">
          {j.points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[13px] leading-snug text-white/85 md:text-[13.5px]">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <>
      {peaks.map((p, k) => (
        <div
          key={k}
          className="twin-flag pointer-events-none absolute z-10 flex flex-col items-center"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, "--d": `${0.8 + k * 0.3}s` } as CSSProperties}
        >
          <svg viewBox="0 0 40 48" className="summit-flag h-12 w-10" aria-hidden>
            <line x1="8" y1="4" x2="8" y2="46" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <path className="flag-cloth" d="M9 5 C 18 2, 24 10, 36 7 L 34 21 C 24 24, 18 16, 9 19 Z" fill="#e9c46a" />
          </svg>
          <span className="summit-label max-w-[44vw] truncate text-center md:max-w-none">{k === 0 ? "Crink Pvt Ltd" : mobile ? "IIIT Kottayam" : "IIIT Kottayam"}</span>
        </div>
      ))}
      {!mobile &&
        peaks.map((p, k) => (
          <span
            key={`m${k}`}
            aria-hidden
            className="twin-flag pointer-events-none absolute z-[9] w-px bg-gradient-to-b from-gold/80 to-gold/0"
            style={{ left: `${p.x * 100}%`, top: `calc(${p.y * 100}% + 50px)`, height: "calc(24% - 54px)", transform: "none", "--d": `${1 + k * 0.3}s` } as CSSProperties}
          />
        ))}
      {mobile ? (
        <div className="absolute inset-x-3 bottom-[78px] z-10 space-y-3 overflow-y-auto overscroll-contain pb-2" style={{ top: `calc(${peaks[0].y * 100}% + 22%)` }}>
          <Detail k={0} />
          <Detail k={1} />
        </div>
      ) : (
        peaks.map((p, k) => (
          <div
            key={k}
            className="absolute z-10 w-[min(470px,36vw)]"
            style={{ left: `clamp(16px, calc(${p.x * 100}% - min(235px, 18vw)), calc(100% - min(470px, 36vw) - 16px))`, top: `calc(${p.y * 100}% + 24%)` }}
          >
            <Detail k={k} />
          </div>
        ))
      )}
    </>
  );
}
