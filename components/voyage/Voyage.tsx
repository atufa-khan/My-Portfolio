"use client";

import { useEffect, useRef, useState } from "react";
import { VoyageEngine } from "./engine";
import { OceanSound } from "./sound";
import Jungle from "./Jungle";
import { chapters, dockStart, ISLANDS } from "@/lib/story";
import { profile } from "@/lib/data";

/** Lines that surface at certain points of the voyage. */
const LINES: { from: number; to: number; text: string }[] = [
  { from: 0.69, to: 0.735, text: "Past the last island, the sea grew restless." },
  { from: 0.74, to: 0.8, text: "Then it reached up, and pulled me under." },
  { from: 0.855, to: 0.905, text: "Down here, where no light reaches…" },
  { from: 0.91, to: 0.965, text: "…something gold was waiting." },
];

export default function Voyage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VoyageEngine | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [active, setActive] = useState(-1);
  const [found, setFound] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef<OceanSound | null>(null);
  const exploreRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const landedRef = useRef<number | null>(null);
  const activeRef = useRef(-1);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new VoyageEngine(canvas);
    engineRef.current = engine;
    engine.onActive = (i) => {
      activeRef.current = i;
      setActive(i);
    };
    engine.onLightning = () => soundRef.current?.thunder();
    engine.onFrame = (p) => {
      soundRef.current?.update(engine.audio, performance.now() / 1000);
      // keep the "Explore" beacon above the island you've reached
      const btn = exploreRef.current;
      const i = activeRef.current;
      if (btn) {
        const a = i >= 0 && i < ISLANDS && landedRef.current === null ? engine.anchors[i] : undefined;
        if (a) {
          btn.style.transform = `translate(${a.x}px, ${a.y - 70}px) translate(-50%, -100%)`;
          btn.dataset.show = "1";
        } else btn.dataset.show = "0";
      }
      if (titleRef.current) {
        const a = 1 - Math.min(1, Math.max(0, (p - 0.012) / 0.03));
        titleRef.current.style.opacity = String(a);
        titleRef.current.style.transform = `translateY(${(1 - a) * -30}px)`;
        titleRef.current.style.pointerEvents = a > 0.1 ? "auto" : "none";
      }
      LINES.forEach((l, i) => {
        const el = lineRefs.current[i];
        if (!el) return;
        const mid = (l.from + l.to) / 2;
        const half = (l.to - l.from) / 2;
        const a = Math.max(0, 1 - Math.pow(Math.abs(p - mid) / half, 4));
        el.style.opacity = String(a);
        el.style.filter = `blur(${(1 - a) * 6}px)`;
      });
    };
    const progress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      engine.target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    const onMove = (e: PointerEvent) => engine.pointer(e.clientX, e.clientY);
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a,button,summary,details,[data-panel],.jungle")) return;
      if (landedRef.current !== null) return;
      // clicking the island you've reached lands you on it
      const i = activeRef.current;
      const a = i >= 0 && i < ISLANDS ? engine.anchors[i] : undefined;
      if (a && Math.abs(e.clientX - a.x) < a.w * 0.55 && e.clientY > a.y - 60 && e.clientY < a.by + 30) {
        land(i);
        return;
      }
      if (engine.click(e.clientX, e.clientY)) {
        setFound(true);
        soundRef.current?.chime();
      }
    };
    const onResize = () => engine.resize();
    window.addEventListener("scroll", progress, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onResize);
    progress();
    return () => {
      engine.destroy();
      soundRef.current?.destroy();
      window.removeEventListener("scroll", progress);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const toggleSound = () => {
    if (!soundRef.current) soundRef.current = new OceanSound();
    const next = !soundOn;
    soundRef.current.setEnabled(next);
    setSoundOn(next);
  };

  const land = (i: number) => {
    const engine = engineRef.current;
    if (!engine || landedRef.current !== null) return;
    const a = engine.anchors[i];
    landedRef.current = i;
    if (exploreRef.current) exploreRef.current.dataset.show = "0";
    setZoom({ x: a?.x ?? window.innerWidth / 2, y: ((a?.y ?? 0) + (a?.by ?? 0)) / 2 });
    document.documentElement.style.overflow = "hidden";
    setTimeout(() => {
      setLanded(i);
      engine.paused = true;
    }, 700);
  };

  const leave = () => {
    const engine = engineRef.current;
    if (engine) engine.paused = false;
    setLanded(null);
    setZoom(null);
    landedRef.current = null;
    document.documentElement.style.overflow = "";
  };

  const jump = (i: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const p = i >= ISLANDS ? 1 : dockStart(i) + 0.02;
    window.scrollTo({ top: p * max, behavior: "smooth" });
  };

  return (
    <div style={{ height: "1600svh" }} className="relative">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
        <div
          ref={stageRef}
          className="sea-stage absolute inset-0"
          style={zoom ? { opacity: 0 } : undefined}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="An animated voyage across the ocean" role="img" />
        </div>

        {/* opening: the name, at sunrise */}
        <div ref={titleRef} className="absolute inset-x-0 top-[7%] px-6 text-center text-white md:top-[12%]">
          <h1 className="title-rise font-display text-[clamp(4.2rem,15vw,11rem)] leading-[0.9] [text-shadow:0_6px_50px_rgba(90,40,30,0.45)]">
            Atufa
          </h1>
          <p className="title-rise mt-2 font-display text-2xl text-white/90 italic md:text-3xl" style={{ animationDelay: "0.5s" }}>
            Khan · Software Engineer
          </p>
          <p className="title-rise mx-auto mt-5 max-w-md text-base text-white/85 [text-shadow:0_2px_20px_rgba(60,30,30,0.5)] md:text-lg" style={{ animationDelay: "1s" }}>
            Sail with me from sunrise to the bottom of the sea, where something gold was lost.
          </p>
          <p className="title-rise mt-7 animate-pulse text-xs tracking-[0.3em] text-white/80 uppercase" style={{ animationDelay: "1.6s" }}>
            Scroll to set sail →
          </p>
        </div>

        {/* story lines for the storm and the deep */}
        {LINES.map((l, i) => (
          <p
            key={l.text}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            className="pointer-events-none absolute inset-x-0 top-[22%] px-6 text-center font-display text-3xl text-cream italic opacity-0 [text-shadow:0_2px_30px_rgba(0,0,0,0.7)] md:text-5xl"
          >
            {l.text}
          </p>
        ))}

        {/* the island you've reached: tap to land */}
        <button
          ref={exploreRef}
          type="button"
          data-show="0"
          onClick={() => activeRef.current >= 0 && land(activeRef.current)}
          className="explore absolute top-0 left-0 z-20 flex flex-col items-center gap-2"
          aria-label={active >= 0 && active < ISLANDS ? `Explore ${chapters[active].island}` : "Explore"}
        >
          <span className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#0b2a33] shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur">
            {active >= 0 && active < ISLANDS ? `Explore ${chapters[active].island}` : "Explore"} ↗
          </span>
          <span className="explore-pin" />
        </button>

        {landed !== null && <Jungle key={landed} index={landed} env={engineRef.current!.env} onClose={leave} />}

        {/* the bottom */}
        <section
          id="contact"
          aria-hidden={active !== ISLANDS}
          className={`absolute inset-x-0 top-[9%] px-6 text-center transition-all duration-1000 ${
            active === ISLANDS ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0"
          }`}
        >
          <p className="text-sm text-gold">The bottom of the sea</p>
          <h2 className="mt-3 font-display text-5xl text-cream md:text-7xl">{found ? "You found it." : "The ring."}</h2>
          <p className="mx-auto mt-4 max-w-xl font-display text-lg text-cream/75 italic md:text-2xl">
            {found
              ? "The promise was simple: build AI that takes care of people. If you’re building that too, let’s talk."
              : "It was here all along, resting in the sand. Reach down and pick it up."}
          </p>
          <div className={`transition-all duration-700 ${found ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <a
              href={`mailto:${profile.email}`}
              className="mt-7 inline-block rounded-full bg-gold px-7 py-3.5 font-semibold text-[#1a1206] shadow-[0_0_50px_rgba(233,196,106,0.4)] transition hover:-translate-y-0.5"
            >
              {profile.email}
            </a>
            <div className="mt-4 flex justify-center gap-6 text-cream/75">
              <a href={profile.linkedin} target="_blank" rel="noreferrer" className="hover:text-gold">LinkedIn</a>
              <a href={profile.github} target="_blank" rel="noreferrer" className="hover:text-gold">GitHub</a>
            </div>
          </div>
          {!found && <p className="mt-6 animate-pulse text-xs tracking-[0.3em] text-cream/55 uppercase">Click the ring</p>}
        </section>

        {/* sound toggle (off until the visitor asks for it) */}
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundOn ? "Mute ocean sound" : "Play ocean sound"}
          aria-pressed={soundOn}
          title={soundOn ? "Sound on" : "Sound off"}
          className={`absolute top-4 right-4 z-40 flex h-11 items-center gap-2 rounded-full px-3.5 text-sm ring-1 backdrop-blur-md transition ${
            soundOn ? "bg-gold/90 text-[#1a1206] ring-gold" : "bg-black/25 text-white/85 ring-white/20 hover:bg-black/40"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fillOpacity="0.15" />
            {soundOn ? (
              <>
                <path d="M15.5 9a4 4 0 0 1 0 6" />
                <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
              </>
            ) : (
              <path d="M16 9.5l5 5m0-5l-5 5" />
            )}
          </svg>
          <span className="hidden sm:inline">{soundOn ? "Sound on" : "Sound"}</span>
        </button>

        {/* island navigator */}
        <nav
          aria-label="Voyage chapters"
          className={`absolute inset-x-0 bottom-4 flex justify-center transition-opacity ${landed !== null ? "pointer-events-none opacity-0" : ""}`}
        >
          <ol className="flex items-center gap-1 rounded-full bg-black/30 px-2 py-1.5 ring-1 ring-white/10 backdrop-blur-md">
            {chapters.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => jump(i)}
                  title={`${c.n} · ${c.island}`}
                  className={`rounded-full px-2.5 py-1 font-display text-sm transition md:px-3 ${active === i ? "bg-gold text-[#1a1206]" : "text-cream/60 hover:text-cream"}`}
                >
                  {c.n}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => jump(ISLANDS)}
                title="The bottom"
                aria-label="The bottom"
                className={`ml-1 flex h-7 w-7 items-center justify-center rounded-full transition ${active === ISLANDS ? "bg-gold" : "hover:bg-white/10"}`}
              >
                <span className={`block h-3 w-3 rounded-full border-2 ${active === ISLANDS ? "border-[#1a1206]" : "border-gold"}`} />
              </button>
            </li>
          </ol>
        </nav>

      </div>
    </div>
  );
}

