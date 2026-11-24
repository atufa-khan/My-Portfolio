import {
  awards, certifications, competitions, education, events, experience, leadership, profile, projects, publications, skills, stats,
} from "@/lib/data";

const tile = "rounded-2xl bg-white/[0.05] ring-1 ring-white/10";
const chip = "rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-cream/75 ring-1 ring-white/10";

export function AboutPanel() {
  return (
    <div className="space-y-5">
      <p className="text-cream/80">
        I’m <span className="text-cream">{profile.name}</span>, an AI &amp; ML undergraduate at {education.school}. My work sits where{" "}
        <span className="text-cream">LLM systems</span> meet <span className="text-cream">healthcare</span>: agent evaluation pipelines,
        mental-health classifiers and explainable retinal screening.
      </p>
      <div className={`${tile} p-4`}>
        <p className="text-xs tracking-widest text-tide-300 uppercase">Education</p>
        <p className="mt-1 font-display text-2xl text-cream">{education.school}</p>
        <p className="text-sm text-cream/70">{education.degree}</p>
        <p className="text-sm text-cream/45">{education.years} · CGPA {education.cgpa}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {education.coursework.map((c) => <span key={c} className={chip}>{c}</span>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`${tile} p-3`}>
            <p className="font-display text-3xl text-gold">{s.value}</p>
            <p className="text-xs text-cream/55">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExperiencePanel() {
  return (
    <div className="space-y-4">
      {experience.map((j) => (
        <div key={j.company}>
          <p className="font-display text-3xl text-cream">{j.company}</p>
          <p className="text-tide-300">{j.role}</p>
          <p className="text-sm text-cream/45">{j.period} · {j.place}</p>
          <ul className="mt-4 space-y-3">
            {j.points.map((p) => (
              <li key={p} className="flex gap-3 text-cream/80">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ResearchPanel() {
  return (
    <ol className="space-y-3">
      {publications.map((p, i) => (
        <li key={p.title} className={`${tile} p-4`}>
          <div className="flex items-start justify-between gap-3">
            <span className="font-display text-2xl text-gold/80">0{i + 1}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs ${p.status === "Accepted" ? "bg-gold/15 text-gold" : "bg-white/10 text-cream/70"}`}>{p.status}</span>
          </div>
          <p className="mt-1 font-medium text-cream">{p.title}</p>
          <p className="mt-1 text-xs text-cream/50">{p.kind} · {p.venue} · {p.date}</p>
        </li>
      ))}
    </ol>
  );
}

export function ProjectsPanel() {
  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <details key={p.name} className={`${tile} group p-4 open:bg-white/[0.08]`}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
            <span>
              <span className="font-display text-2xl text-cream">{p.name}</span>
              {p.tag && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 align-middle text-[11px] text-gold">{p.tag}</span>}
              <span className="mt-1 block text-sm text-cream/70">{p.blurb}</span>
            </span>
            <span className="text-xl text-gold transition group-open:rotate-45">+</span>
          </summary>
          <ul className="mt-3 space-y-1.5 text-sm text-cream/70">
            {p.highlights.map((h) => (
              <li key={h} className="flex gap-2"><span className="mt-2 h-px w-3 shrink-0 bg-gold/60" />{h}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">{p.stack.map((s) => <span key={s} className={chip}>{s}</span>)}</div>
        </details>
      ))}
      <a href={profile.github} target="_blank" rel="noreferrer" className="inline-block pt-1 text-sm text-cream/80 underline decoration-gold/60 underline-offset-4 hover:text-cream">
        More on GitHub →
      </a>
    </div>
  );
}

export function HonorsPanel() {
  return (
    <div className="space-y-3">
      {awards.map((a) => (
        <div key={a.title} className="flex gap-3">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold shadow-[0_0_10px_rgba(233,196,106,0.9)]" />
          <div>
            <p className="text-cream">{a.title}</p>
            <p className="text-sm text-cream/55">{a.detail}</p>
          </div>
        </div>
      ))}
      {competitions.map((c) => (
        <div key={c.title} className="rounded-2xl bg-gold/[0.08] p-4 ring-1 ring-gold/25">
          <p className="text-xs text-gold">{c.date} · {c.result}</p>
          <p className="mt-1 font-display text-xl text-cream">{c.title}</p>
          <p className="mt-1 text-sm text-cream/60">{c.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function LeadershipPanel() {
  return (
    <div className="space-y-5">
      <ul className="space-y-4 border-l border-gold/30 pl-5">
        {leadership.map((l) => (
          <li key={l.role} className="relative">
            <span className="absolute top-1.5 -left-[25px] h-2 w-2 rounded-full bg-gold" />
            <p className="text-cream">{l.role}</p>
            <p className="text-xs text-cream/45">{l.period}</p>
            <p className="text-sm text-cream/70">{l.detail}</p>
          </li>
        ))}
      </ul>
      {events.map((e) => (
        <div key={e.name} className={`${tile} p-4`}>
          <p className="text-cream">{e.name} <span className="text-xs text-cream/45">· {e.place} · {e.date}</span></p>
          <p className="mt-1 text-sm text-cream/65">{e.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function SkillsPanel() {
  return (
    <div className="space-y-4">
      {skills.map((g) => (
        <div key={g.group}>
          <p className="text-xs tracking-widest text-tide-300 uppercase">{g.group}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{g.items.map((s) => <span key={s} className={chip}>{s}</span>)}</div>
        </div>
      ))}
      <details className={`${tile} group p-4`}>
        <summary className="flex cursor-pointer list-none justify-between text-cream">
          Certifications ({certifications.length}) <span className="text-gold transition group-open:rotate-45">+</span>
        </summary>
        <ul className="mt-3 space-y-2">
          {certifications.map((c) => (
            <li key={c.name + c.by} className="flex justify-between gap-3 text-sm">
              <span className="text-cream/85">{c.name} <span className="text-cream/45">· {c.by}</span></span>
              <span className="shrink-0 text-cream/40">{c.date}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export const PANELS = [AboutPanel, ExperiencePanel, ResearchPanel, ProjectsPanel, HonorsPanel, LeadershipPanel, SkillsPanel];
