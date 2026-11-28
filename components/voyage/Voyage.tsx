"use client";

import { useEffect, useRef, useState } from "react";
import { VoyageEngine } from "./engine";
import { OceanSound } from "./sound";
import IslandView from "./IslandView";
import { chapters, dockStart, ISLANDS } from "@/lib/story";
import { profile } from "@/lib/data";

/** Lines that surface at certain points of the voyage. */
const LINES: { from: number; to: number; text: string }[] = [
  { from: 0.69, to: 0.735, text: "That’s the journey so far." },
  { from: 0.74, to: 0.8, text: "The next chapter is still being written." },
  { from: 0.855, to: 0.905, text: "Every project here began with one question:" },
  { from: 0.91, to: 0.965, text: "how can technology take better care of people?" },
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
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const allSeen = visited.size >= ISLANDS;

  // remember explored islands for this visitor (best effort)
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("wayfinder-visited") || "[]");
      if (Array.isArray(v)) setVisited(new Set(v.filter((n) => typeof n === "number" && n >= 0 && n < ISLANDS)));
    } catch {}
  }, []);

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
          const half = Math.min(150, window.innerWidth * 0.4) + 12;
          const x = Math.max(half, Math.min(window.innerWidth - half, a.x));
          btn.style.transform = `translate(${x}px, ${a.y - 70}px) translate(-50%, -100%)`;
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

  const markVisited = (i: number) =>
    setVisited((v) => {
      const n = new Set(v).add(i);
      try {
        localStorage.setItem("wayfinder-visited", JSON.stringify([...n]));
      } catch {}
      return n;
    });

  // move straight to another section from inside one
  const go = (j: number) => {
    const i = landedRef.current;
    if (i === null || j < 0) return;
    if (j >= ISLANDS) {
      leave();
      setTimeout(() => jump(ISLANDS), 60);
      return;
    }
    markVisited(i);
    landedRef.current = j;
    setLanded(j);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: (dockStart(j) + 0.02) * max, behavior: "instant" as ScrollBehavior });
    if (engineRef.current) engineRef.current.p = engineRef.current.target = dockStart(j) + 0.02;
  };

  const leave = () => {
    const i = landedRef.current;
    if (i !== null) markVisited(i);
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
    <div style={{ height: "1300svh" }} className="relative">
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
            I’m Atufa, an AI engineer who builds LLM agents and tests whether they actually work. This is my voyage so far.
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
          {active >= 0 && active < ISLANDS && (
            <span className="teaser mb-1 block w-[min(300px,80vw)] rounded-md bg-[#06201c]/80 px-4 py-3 text-left text-white ring-1 ring-white/20 backdrop-blur-md">
              <span className="block text-[10px] font-semibold tracking-[0.2em] text-gold uppercase">
                {chapters[active].year} · {visited.has(active) ? "Explored ✓" : "Highlight"}
              </span>
              <span className="mt-1 block font-display text-[19px] leading-snug">{chapters[active].teaser}</span>
            </span>
          )}
          <span className="rounded-full bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#0b2a33] shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur">
            {active >= 0 && active < ISLANDS ? `Explore ${chapters[active].island}` : "Explore"} ↗
          </span>
          <span className="explore-pin" />
        </button>

        {landed !== null && <IslandView key={landed} index={landed} env={engineRef.current!.env} onClose={leave} onGo={go} />}

        {/* the bottom */}
        <section
          id="contact"
          aria-hidden={active !== ISLANDS}
          className={`absolute inset-x-0 top-[9%] px-6 text-center transition-all duration-1000 ${
            active === ISLANDS ? "opacity-100" : "pointer-events-none translate-y-4 opacity-0"
          }`}
        >
          <p className="text-sm tracking-[0.2em] text-gold uppercase">Contact</p>
          <h2 className="mt-3 font-display text-5xl text-cream md:text-7xl">{allSeen ? "Thank you for exploring." : found ? "Let’s work together." : "What’s next."}</h2>
          <p className="mx-auto mt-4 max-w-xl font-display text-lg text-cream/75 italic md:text-2xl">
            {found || allSeen
              ? "I’m open to software engineering and AI/ML roles, research collaborations and internships, especially in LLM systems and healthcare technology."
              : "I’m looking for software engineering and AI/ML roles where I can build systems that genuinely help people."}
          </p>
          {allSeen && <p className="mx-auto mt-2 max-w-xl font-display text-xl text-gold italic md:text-2xl">You’ve seen all five sections. I’d love to hear from you.</p>}
          <div className={`transition-all duration-700 ${found || allSeen ? "opacity-100" : "pointer-events-none opacity-0"}`}>
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
          {!found && !allSeen && <p className="mt-6 animate-pulse text-xs tracking-[0.3em] text-cream/55 uppercase">Select the ring to get in touch</p>}
        </section>

        {/* always reachable: quick view, progress, résumé, contact, sound */}
        {landed === null && (
          <a href="/quick" className="absolute top-4 left-4 z-50 rounded-full bg-black/25 px-3.5 py-2.5 text-[13px] text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-black/45">
            <span className="hidden sm:inline">Skip the voyage → </span><span className="font-semibold">Quick view</span>
          </a>
        )}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!allSeen) return;
              if (landedRef.current !== null) leave();
              setTimeout(() => jump(ISLANDS), 50);
            }}
            title={`${visited.size} of ${ISLANDS} islands explored`}
            className={`progress-pill flex h-10 items-center gap-2 rounded-full px-3 text-[13px] ring-1 backdrop-blur-md ${allSeen ? "all-seen bg-gold/90 text-[#1a1206] ring-gold" : "cursor-default bg-black/25 text-white/90 ring-white/20"}`}
          >
            <span className="hidden gap-0.5 md:flex" aria-hidden>
              {chapters.map((c, i) => (
                <svg key={c.id} viewBox="0 0 20 18" className={`h-3.5 w-3.5 ${visited.has(i) ? "shell-on" : "opacity-35"}`}>
                  <path d="M10 17 L2.5 7 Q10 -4 17.5 7 Z" fill="currentColor" />
                  <path d="M10 17 L7 5 M10 17 L10 3.5 M10 17 L13 5" stroke="#06201c" strokeWidth="0.9" opacity="0.45" />
                </svg>
              ))}
            </span>
            <span className="hidden md:inline">{allSeen ? "You’ve seen it all, let’s talk →" : `${visited.size} of ${ISLANDS} islands explored`}</span>
            <span className="flex items-center gap-1 md:hidden">
              <svg viewBox="0 0 20 18" className={`h-3.5 w-3.5 ${visited.size ? "shell-on" : "opacity-50"}`} aria-hidden>
                <path d="M10 17 L2.5 7 Q10 -4 17.5 7 Z" fill="currentColor" />
              </svg>
              {visited.size}/{ISLANDS}
            </span>
          </button>
          <a href="/Atufa-Khan-Resume.pdf" target="_blank" rel="noreferrer" className="flex h-10 items-center rounded-full bg-black/25 px-3.5 text-[13px] text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-black/45">
            Résumé
          </a>
          <a href={`mailto:${profile.email}`} title={profile.email} className="hidden h-10 items-center rounded-full bg-black/25 px-3.5 text-[13px] text-white ring-1 ring-white/20 backdrop-blur-md transition hover:bg-black/45 sm:flex">
            Contact
          </a>
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundOn ? "Mute ocean sound" : "Play ocean sound"}
          aria-pressed={soundOn}
          title={soundOn ? "Sound on" : "Sound off"}
          className={`flex h-10 items-center gap-2 rounded-full px-3.5 text-sm ring-1 backdrop-blur-md transition ${
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

        </div>

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
                  title={`${c.n} · ${c.island} · ${c.year}`}
                  className={`rounded-full px-2.5 py-1 font-display text-sm transition md:px-3 ${active === i ? "bg-gold text-[#1a1206]" : "text-cream/60 hover:text-cream"}`}
                >
                  {c.n}
                  {visited.has(i) && <span className="ml-0.5 text-[9px] text-gold">✓</span>}
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

