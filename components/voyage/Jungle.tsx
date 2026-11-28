"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { JungleScene, trailLayout, multiPeaks, type Env } from "./jungle";
import { education, experience, profile, projects, publications, skills } from "@/lib/data";
import { chapters } from "@/lib/story";
import { trails, type Find } from "@/lib/jungle";

type Key = number | "summit" | "extra";

/** One line under each island's title, never repeated. */
const SUBTITLES = [
  "Sharda University · B.Tech CSE (AI & ML) · 2023–2027",
  "Crink Pvt Ltd and IIIT Kottayam · May – Aug 2026",
  "2 accepted · 2 under review · 1 in progress",
  "Five projects, and the tools behind them",
  "Academic distinctions, hackathons and leadership roles",
];

export default function Jungle({ index, env, onClose }: { index: number; env: Env; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<JungleScene | null>(null);
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState<Key | null>(null);
  const [found, setFound] = useState<Set<Key>>(new Set());
  const [leaving, setLeaving] = useState(false);
  const ch = chapters[index];
  const twin = index <= 3; // islands without the trail
  const [huts, setHuts] = useState<{ x: number; y: number; s: number }[]>([]);
  const [light, setLight] = useState<{ L: JungleScene["light"]; buoys: JungleScene["buoys"] }>({ L: null, buoys: [] });
  const trail = trails[index];
  const layout = useMemo(() => trailLayout(trail.stops.length, mobile, index), [trail.stops.length, mobile, index]);

  useEffect(() => {
    const m = () => setMobile(window.innerWidth < 760);
    m();
    const scene = new JungleScene(canvasRef.current!, ch.kind, env, index);
    sceneRef.current = scene;
    const sync = () => {
      setHuts([...scene.hutAnchors]);
      setLight({ L: scene.light, buoys: [...scene.buoys] });
    };
    scene.onLayout = sync;
    sync();
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

      {(index === 1 || index === 2) && <Summits mobile={mobile} island={index} />}
      {index === 3 && <Village mobile={mobile} huts={huts} />}
      {index === 0 && <Lighthouse mobile={mobile} light={light.L} buoys={light.buoys} />}

      {!twin && (<>
      {/* the trail up the mountain */}
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="trail pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path d={layout.d} className="trail-glow" />
        <path d={layout.d} className="trail-line" />
      </svg>

      </>)}

      {/* header */}
      <div className="jungle-head pointer-events-none absolute top-[66px] left-5 max-w-[80%] md:top-8 md:left-10 md:max-w-[min(820px,60vw)]">
        <p className="text-xs font-semibold tracking-[0.25em] text-white/75 uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
          Island {ch.n} · {ch.island}
        </p>
        <h2 className="mt-2 font-display text-[23px] leading-[1.08] text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.6)] [text-wrap:balance] md:text-[38px]">{ch.title}</h2>
        <p className="mt-3 text-sm text-white/80 [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]">
          {SUBTITLES[index]}
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
            {index === 4 ? (
              <svg viewBox="0 0 30 38" className="planted h-9 w-7 shrink-0" aria-hidden>
                <line x1="6" y1="3" x2="6" y2="36" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path className="flag-cloth" d="M7 4 C 13 2, 18 8, 27 5 L 25 16 C 18 18, 13 13, 7 15 Z" fill="#e9c46a" />
                <ellipse cx="6" cy="36" rx="5" ry="1.6" fill="rgba(0,0,0,0.35)" />
              </svg>
            ) : (
              <span className="wp-dot" />
            )}
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
      {trail.extra && !twin && (
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


type Group = { flag: string; kicker: string; body: React.ReactNode };

function internships(): Group[] {
  return experience.map((j, k) => ({
    flag: k === 0 ? "Crink Pvt Ltd" : "IIIT Kottayam",
    kicker: k === 0 ? "Industry internship" : "Research internship",
    body: (
      <>
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
      </>
    ),
  }));
}

function papers(): Group[] {
  const groups: [string, string][] = [
    ["Accepted", "Accepted"],
    ["Under review", "Under Review"],
    ["In progress", "In progress"],
  ];
  return groups.map(([flag, status]) => {
    const list = publications.filter((p) => p.status === status);
    return {
      flag,
      kicker: `${list.length} ${list.length === 1 ? "paper" : "papers"}`,
      body: (
        <ul className="mt-2 space-y-3.5">
          {list.map((p) => (
            <li key={p.title}>
              <p className="font-display text-[19px] leading-snug text-white md:text-[20px]">{p.title}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-white/65">{[p.kind, p.venue, p.date].filter(Boolean).join(" · ")}</p>
            </li>
          ))}
        </ul>
      ),
    };
  });
}

/** Islands II and III: one peak per group, its name at the top and the full details beneath. */
function Summits({ mobile, island }: { mobile: boolean; island: number }) {
  const peaks = multiPeaks(mobile, island);
  const groups = island === 1 ? internships() : papers();
  const n = groups.length;
  const width = n === 2 ? "min(470px,36vw)" : "min(380px,26vw)";
  const half = n === 2 ? "min(235px,18vw)" : "min(190px,13vw)";
  const drop = n === 2 ? "19%" : "17%";
  const Detail = ({ k }: { k: number }) => (
    <div className="intern-card rounded-2xl bg-[#06201c]/85 p-5 text-white ring-1 ring-white/20 backdrop-blur-xl md:p-6" style={{ "--d": `${1.2 + k * 0.3}s` } as CSSProperties}>
      <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">{groups[k].kicker}</p>
      {groups[k].body}
    </div>
  );
  return (
    <>
      {peaks.map((p, k) => (
        <div
          key={k}
          className="twin-flag pointer-events-none absolute z-10 flex flex-col items-center"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, "--d": `${0.8 + k * 0.25}s` } as CSSProperties}
        >
          <svg viewBox="0 0 40 48" className="summit-flag h-12 w-10" aria-hidden>
            <line x1="8" y1="4" x2="8" y2="46" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <path className="flag-cloth" d="M9 5 C 18 2, 24 10, 36 7 L 34 21 C 24 24, 18 16, 9 19 Z" fill="#e9c46a" />
          </svg>
          <span className="summit-label whitespace-nowrap">{groups[k].flag}</span>
        </div>
      ))}
      {!mobile &&
        peaks.map((p, k) => (
          <span
            key={`m${k}`}
            aria-hidden
            className="twin-flag pointer-events-none absolute z-[9] w-px bg-gradient-to-b from-gold/80 to-gold/0"
            style={{ left: `${p.x * 100}%`, top: `calc(${p.y * 100}% + 50px)`, height: `calc(${drop} - 54px)`, transform: "none", "--d": `${1 + k * 0.25}s` } as CSSProperties}
          />
        ))}
      {mobile ? (
        <div className="absolute inset-x-3 bottom-[78px] z-10 space-y-3 overflow-y-auto overscroll-contain pb-2" style={{ top: `calc(${peaks[0].y * 100}% + 20%)` }}>
          {groups.map((_, k) => (
            <Detail key={k} k={k} />
          ))}
        </div>
      ) : (
        peaks.map((p, k) => (
          <div
            key={k}
            className="summit-card-wrap absolute z-10 overflow-y-auto overscroll-contain rounded-2xl"
            style={{ maxHeight: `calc(100% - ${p.y * 100}% - ${drop} - 90px)`, width, left: `clamp(16px, calc(${p.x * 100}% - ${half}), calc(100% - ${width} - 16px))`, top: `calc(${p.y * 100}% + ${drop})` }}
          >
            <Detail k={k} />
          </div>
        ))
      )}
    </>
  );
}


const SIGN = ["Sukoonify", "Memora", "Performance platform", "RAG assistant", "Brain-X"];
const SIGN_SHORT = ["Sukoonify", "Memora", "PMS", "RAG bot", "Brain-X"];

/** Island IV: a hut per project, its name on a wooden sign, its details beneath. */
function Village({ mobile, huts }: { mobile: boolean; huts: { x: number; y: number; s: number }[] }) {
  if (!huts.length) return null;
  const Card = ({ k, title }: { k: number; title?: boolean }) => {
    const p = projects[k];
    const stack = mobile ? p.stack : p.stack.slice(0, k === 0 && typeof window !== "undefined" && window.innerHeight > 820 ? 7 : 4);
    return (
      <div className="intern-card rounded-md bg-[#06201c]/85 p-4 text-white lg:p-5 ring-1 ring-white/20 backdrop-blur-xl" style={{ "--d": `${1.2 + k * 0.15}s` } as CSSProperties}>
        <div className="flex flex-wrap items-center gap-2">
          {title && <h3 className="font-display text-2xl leading-tight">{p.name}</h3>}
          <span className="text-xs text-white/55">{p.year}</span>
          {p.tag && <span className="rounded-sm bg-gold px-2 py-0.5 text-[10px] font-semibold text-[#1a1206]">{p.tag}</span>}
        </div>
        <p className="mt-1.5 text-[14px] leading-snug text-white/90 lg:text-[14.5px]">{p.blurb}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {stack.map((c) => (
            <span key={c} className="rounded-sm bg-white/10 px-2.5 py-0.5 text-[12px] text-white/85 ring-1 ring-white/15">
              {c}
            </span>
          ))}
        </div>
        <a href={profile.github} target="_blank" rel="noreferrer" className="mt-2.5 inline-block text-[13px] font-medium text-gold underline decoration-gold/40 underline-offset-2">
          See it on GitHub →
        </a>
      </div>
    );
  };
  const width = "min(300px, 18.6vw)";
  return (
    <>
      {/* hover a hut and it sways */}
      {huts.map((h, k) => (
        <div
          key={`hz${k}`}
          className="hut-hover absolute z-[9]"
          style={{ left: h.x - 34 * h.s, top: h.y - 44 * h.s, width: 68 * h.s, height: 48 * h.s }}
          onMouseEnter={(e) => {
            const sign = e.currentTarget.parentElement?.querySelector(`[data-hut="${k}"]`);
            sign?.classList.remove("sway");
            void (sign as HTMLElement | null)?.offsetWidth;
            sign?.classList.add("sway");
          }}
        />
      ))}
      {huts.map((h, k) => (
        <div
          key={k}
          data-hut={k}
          className={`hut-sign ${k === 0 ? "hut-sign-big" : ""}`}
          style={{ left: h.x, top: mobile ? h.y + 12 : h.y - 23 * h.s, "--d": `${0.8 + k * 0.12}s` } as CSSProperties}
        >
          {mobile ? SIGN_SHORT[k] : SIGN[k]}
        </div>
      ))}
      {mobile ? (
        <div className="absolute inset-x-3 bottom-[78px] z-10 space-y-3 overflow-y-auto overscroll-contain pb-2" style={{ top: Math.max(...huts.map((h) => h.y)) + 40 }}>
          {projects.map((_, k) => (
            <Card key={k} k={k} title />
          ))}
          <SkillsCard />
        </div>
      ) : (
        <>
        <div className="absolute z-10" style={{ right: 24, top: 78, width: "min(640px, 47vw)" }}>
          <SkillsCard compact />
        </div>
        {huts.map((h, k) => (
          <div
            key={k}
            className="summit-card-wrap absolute z-10 overflow-y-auto overscroll-contain rounded-md"
            style={{ width, left: `clamp(12px, calc(${h.x}px - ${width} / 2), calc(100% - ${width} - 12px))`, top: h.y + 14, maxHeight: `calc(100% - ${h.y + 14}px - ${k === 0 ? 20 : 84}px)` }}
          >
            <Card k={k} />
          </div>
        ))}
        </>
      )}
    </>
  );
}


/** Island I: the lighthouse is Sharda University; the first-ranked courses float as buoys in the bay. */
function Lighthouse({ mobile, light, buoys }: { mobile: boolean; light: JungleScene["light"]; buoys: JungleScene["buoys"] }) {
  if (!light) return null;
  const isFirst = (c: string) => education.firsts.includes(c);
  const card = (
    <div className="intern-card rounded-md bg-[#06201c]/88 p-5 text-white ring-1 ring-white/20 backdrop-blur-xl md:p-6" style={{ "--d": "1.1s" } as CSSProperties}>
      <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">Port of departure</p>
      <h3 className="mt-1 font-display text-3xl leading-tight md:text-[34px]">{education.school}</h3>
      <p className="mt-1 text-[15px] font-medium text-white/90">{education.degree}</p>
      <p className="mt-0.5 text-[13px] text-white/65">
        {education.years} · {education.place}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-sm bg-white/[0.06] p-3 ring-1 ring-white/10">
          <p className="font-display text-3xl leading-none text-gold">9.1</p>
          <p className="mt-1 text-xs text-white/70">CGPA out of 10</p>
        </div>
        <div className="rounded-sm bg-white/[0.06] p-3 ring-1 ring-white/10">
          <p className="font-display text-3xl leading-none text-gold">1st</p>
          <p className="mt-1 text-xs text-white/70">across all sections in 3 subjects</p>
        </div>
      </div>
    </div>
  );
  return (
    <>
      {/* gold medals on the railing */}
      <div className="hut-sign pointer-events-none" style={{ left: light.x, top: light.rail + 48 * light.s, "--d": "0.9s", fontSize: mobile ? 11 : 15 } as CSSProperties}>
        Est. 2023
      </div>
      {mobile ? (
        <div className="absolute inset-x-3 bottom-[78px] z-10 overflow-y-auto overscroll-contain pb-2" style={{ top: `${light.base + 14}px` }}>
          {card}
        </div>
      ) : (
        <>
          <div
            className="summit-card-wrap absolute z-10 overflow-y-auto overscroll-contain rounded-md"
            style={{ width: "min(400px, 30vw)", right: 24, top: light.base + 18, maxHeight: `calc(100% - ${light.base + 18}px - 24px)` }}
          >
            {card}
          </div>
        </>
      )}
    </>
  );
}

/** The tools behind the projects. */
function SkillsCard({ compact }: { compact?: boolean }) {
  return (
    <div className={`intern-card rounded-md bg-[#06201c]/80 text-white ring-1 ring-white/20 backdrop-blur-xl ${compact ? "px-4 py-3" : "p-5"}`} style={{ "--d": "1.9s" } as CSSProperties}>
      <p className="text-[11px] font-semibold tracking-[0.2em] text-gold uppercase">Skills</p>
      <dl className={`mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 ${compact ? "gap-y-0.5 text-[12.5px]" : "gap-y-1.5 text-[13.5px]"} leading-snug`}>
        {skills.map((g) => (
          <div key={g.group} className="contents">
            <dt className="font-semibold whitespace-nowrap text-white/95">{g.group}</dt>
            <dd className="text-white/75">{g.items.join(", ")}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
