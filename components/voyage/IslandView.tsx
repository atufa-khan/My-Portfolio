"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { JungleScene, type Env } from "./jungle";
import { awards, competitions, education, experience, leadership, profile, projects, publications, skills } from "@/lib/data";
import { chapters, ISLANDS } from "@/lib/story";

/** One line under each section heading. */
const LEAD = [
  "B.Tech in Computer Science and Engineering, specialising in AI and machine learning.",
  "Two internships in 2026, one building production LLM systems and one in healthcare research.",
  "Machine learning research for mental health and medical imaging.",
  "Software built for real users, most of it for healthcare and student wellbeing.",
  "Academic distinctions, competitive results and leadership roles.",
];

/**
 * The island, opened: a still picture of the island on the left and the
 * section written out as a logbook on the right: date or status in the margin,
 * the details beside it, fine rules between entries.
 */
export default function IslandView({
  index, env, onClose, onGo,
}: { index: number; env: Env; onClose: () => void; onGo: (i: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);
  const ch = chapters[index];
  const last = index === ISLANDS - 1;

  // paint the island once, let it settle, then hold it still
  useEffect(() => {
    let scene: JungleScene | null = null;
    let stop = 0;
    const paint = () => {
      scene?.destroy();
      clearTimeout(stop);
      scene = new JungleScene(canvasRef.current!, ch.kind, env, index);
      stop = window.setTimeout(() => scene?.destroy(), 900);
    };
    paint();
    let t = 0;
    const onResize = () => {
      clearTimeout(t);
      t = window.setTimeout(paint, 150);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") onGo(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onGo(index - 1);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      scene?.destroy();
      clearTimeout(stop);
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onClose, 450);
  };

  return (
    <div className={`island-view absolute inset-0 z-40 flex flex-col md:flex-row ${leaving ? "iv-out" : ""}`}>
      {/* the island, held still */}
      <div className="relative h-[24svh] shrink-0 overflow-hidden md:h-full md:w-[36%]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
        <div aria-hidden className="iv-fade pointer-events-none absolute inset-0" />
        <p className="absolute bottom-5 left-6 hidden font-display text-[15px] text-white/80 italic [text-shadow:0_1px_12px_rgba(0,0,0,.6)] md:block">
          Island {ch.n} of {["I", "II", "III", "IV", "V"][ISLANDS - 1]}
        </p>
      </div>

      {/* the logbook */}
      <div className="iv-panel relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-7 pb-14 md:px-16 md:pt-24">
          <div className="max-w-[720px]">
            <header className="flex items-baseline justify-between gap-4">
              <p className="font-display text-[19px] text-gold italic">{ch.island}</p>
              <p className="font-display text-[17px] text-[#9db5b0]">{ch.year}</p>
            </header>
            <h2 className="mt-3 font-display text-[36px] leading-[1.02] tracking-[-0.01em] text-[#eef2ee] md:text-[60px]">{ch.title}</h2>
            <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-[#9db5b0] md:text-[17px]">{LEAD[index]}</p>
            <div className="mt-12">{SECTIONS[index]?.()}</div>
          </div>
        </div>

        <nav className="iv-foot flex items-center justify-between gap-3 px-6 py-4 md:px-16" aria-label="Sections">
          <button type="button" onClick={close} className="iv-link text-[14px] text-[#9db5b0]">
            <Arrow left /> <span>Back<span className="hidden sm:inline"> to the voyage</span></span>
          </button>
          <div className="flex items-center gap-5">
            {index > 0 && (
              <button type="button" onClick={() => onGo(index - 1)} className="iv-link hidden text-[14px] text-[#9db5b0] sm:inline-flex">
                <Arrow left /> {chapters[index - 1].island}
              </button>
            )}
            <button type="button" onClick={() => onGo(index + 1)} className="iv-next rounded-full bg-gold px-5 py-2.5 text-[14px] font-semibold text-[#1a1206]">
              {last ? "Get in touch" : <><span className="sm:hidden">Next</span><span className="hidden sm:inline">{chapters[index + 1].island}</span></>} <Arrow />
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

function Arrow({ left }: { left?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`inline-block h-3.5 w-3.5 align-[-2px] ${left ? "rotate-180" : ""}`} aria-hidden>
      <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- building blocks ---------------- */

/** "Jun 2026 – Aug 2026" becomes "Jun – Aug" over "2026" */
function span(period: string) {
  const [a, b] = period.split(" – ");
  const [m1, y1] = a.split(" ");
  const [m2, y2] = (b ?? "").split(" ");
  return y1 && y1 === y2 ? `${m1} – ${m2}\n${y1}` : period;
}

/** One logbook entry: the margin note on the left, the details on the right. */
function Entry({ margin, children, tone }: { margin: ReactNode; children: ReactNode; tone?: "gold" | "reef" | "muted" }) {
  const c = tone === "gold" ? "text-gold" : tone === "reef" ? "text-[#5fb3a6]" : "text-[#9db5b0]";
  return (
    <div className="iv-entry grid gap-x-8 gap-y-2 py-7 md:grid-cols-[132px_1fr]">
      <div className={`font-display text-[18px] leading-tight whitespace-pre-line ${c}`}>{margin}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-14 first:mt-0">
      <h3 className="font-display text-[24px] text-[#eef2ee] italic">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Points({ items, small }: { items: string[]; small?: boolean }) {
  return (
    <ul className={`mt-4 space-y-2.5 ${small ? "text-[14.5px]" : "text-[15.5px]"} leading-relaxed text-[#c9d6d2]`}>
      {items.map((t) => (
        <li key={t} className="relative pl-5">
          <span aria-hidden className="absolute top-[0.8em] left-0 h-px w-2.5 bg-gold" />
          {t}
        </li>
      ))}
    </ul>
  );
}

const Title = ({ children }: { children: ReactNode }) => (
  <h4 className="font-display text-[26px] leading-[1.1] text-[#eef2ee] md:text-[30px]">{children}</h4>
);

/* ---------------- the five sections ---------------- */

const SECTIONS: (() => ReactNode)[] = [
  // I · Education
  () => (
    <>
      <div className="iv-figures grid grid-cols-3">
        {[
          ["9.1", "CGPA out of 10"],
          ["1st", "across all sections in three subjects"],
          ["4×", "Gold Medalist"],
        ].map(([v, l]) => (
          <div key={l} className="iv-figure pr-4">
            <p className="font-display text-[48px] leading-none text-gold md:text-[72px]">{v}</p>
            <p className="mt-3 max-w-[18ch] text-[13.5px] leading-snug text-[#9db5b0]">{l}</p>
          </div>
        ))}
      </div>
      <div className="mt-10">
        <Entry margin={education.years}>
          <Title>{education.school}</Title>
          <p className="mt-2 text-[16px] text-[#c9d6d2]">{education.degree.replace(" — ", ", ")}</p>
          <p className="mt-1 text-[14px] text-[#9db5b0]">{education.place}</p>
        </Entry>
      </div>
    </>
  ),

  // II · Experience
  () => (
    <>
      {experience.map((j) => (
        <Entry key={j.company} margin={span(j.period)}>
          <Title>{j.company}</Title>
          <p className="mt-2 text-[15.5px] font-medium text-gold">{j.role.replace(" · ", ", ")}</p>
          <p className="mt-0.5 text-[14px] text-[#9db5b0]">{j.place}</p>
          <Points items={j.points} />
        </Entry>
      ))}
    </>
  ),

  // III · Research
  () => (
    <>
      {publications.map((p) => (
        <Entry key={p.title} margin={p.status === "Under Review" ? "Under review" : p.status} tone={p.status === "Accepted" ? "gold" : p.status === "In progress" ? "muted" : "reef"}>
          <h4 className="font-display text-[22px] leading-[1.2] text-[#eef2ee] md:text-[25px]">{p.title}</h4>
          {p.venue && <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#c9d6d2]">{p.venue}</p>}
          <p className="mt-1 text-[13.5px] text-[#9db5b0]">{[p.kind, p.date].filter(Boolean).join(", ")}</p>
        </Entry>
      ))}
    </>
  ),

  // IV · Projects & Skills
  () => (
    <>
      <Group title="Projects">
        {projects.map((p) => (
          <Entry key={p.name} margin={p.year}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Title>{p.name.replace("PMS — Performance Management", "Performance Management System").replace("RAG Document Chatbot", "RAG Document Assistant")}</Title>
              {p.tag && <span className="font-display text-[17px] text-gold italic">{p.tag}</span>}
            </div>
            <p className="mt-2.5 text-[15.5px] leading-relaxed text-[#c9d6d2]">{p.blurb}</p>
            <Points items={p.highlights} small />
            <p className="mt-4 text-[13.5px] leading-relaxed text-[#9db5b0]">Built with {p.stack.join(", ")}</p>
            <a href={profile.github} target="_blank" rel="noreferrer" className="iv-link mt-3 inline-flex text-[14px] font-medium text-gold">
              Code on GitHub <Arrow />
            </a>
          </Entry>
        ))}
      </Group>
      <Group title="Skills">
        {skills.map((g) => (
          <Entry key={g.group} margin={g.group}>
            <p className="text-[15.5px] leading-relaxed text-[#c9d6d2]">{g.items.join(", ")}</p>
          </Entry>
        ))}
      </Group>
    </>
  ),

  // V · Achievements & Leadership
  () => (
    <>
      <Group title="Achievements">
        {awards.map((a) => (
          <Entry key={a.title} margin={a.title.match(/Gold|Medal/) ? "Medal" : a.title.match(/Topper/) ? "Rank" : a.title.match(/NPTEL/) ? "Certificate" : "Award"} tone="gold">
            <h4 className="font-display text-[23px] leading-tight text-[#eef2ee]">{a.title.replace(" — ", ", ")}</h4>
            <p className="mt-1.5 text-[15px] leading-relaxed text-[#c9d6d2]">{a.detail}</p>
          </Entry>
        ))}
      </Group>
      <Group title="Competitions">
        {competitions.map((c) => (
          <Entry key={c.title} margin={c.date}>
            <h4 className="font-display text-[23px] leading-tight text-[#eef2ee]">{c.title.replace(" — ", ", ")}</h4>
            <p className="mt-1.5 text-[15px] font-medium text-gold">{c.result.replace(" · ", ", ")}</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-[#c9d6d2]">{c.detail}</p>
          </Entry>
        ))}
      </Group>
      <Group title="Leadership">
        {leadership.map((l) => (
          <Entry key={l.role} margin={l.period.replace(" – ", " –\n")}>
            <h4 className="font-display text-[23px] leading-tight text-[#eef2ee]">{l.role}</h4>
            <p className="mt-1.5 text-[15px] leading-relaxed text-[#c9d6d2]">{l.detail}</p>
          </Entry>
        ))}
      </Group>
    </>
  ),
];
