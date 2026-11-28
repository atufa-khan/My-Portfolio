import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  awards, competitions, education, experience, leadership, profile, projects, publications, skills,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Atufa Khan — Quick view",
  description: "Atufa Khan's portfolio on one page: education, internships, papers, projects, honours and skills.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#d9d2c3] py-10">
      <h2 className="font-display text-3xl text-[#14262b]">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function Quick() {
  return (
    <div className="min-h-screen bg-[#faf7f0] text-[#2a3236]">
      <main className="mx-auto max-w-3xl px-6 pt-10 pb-20">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <a href="/" className="rounded-full bg-[#14262b] px-4 py-2 text-white transition hover:bg-[#1d5c68]">
            ← Take the voyage instead
          </a>
          <div className="flex gap-4 text-[#1d5c68]">
            <a href="/Atufa-Khan-Resume.pdf" target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Résumé (PDF)
            </a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              LinkedIn
            </a>
            <a href={profile.github} target="_blank" rel="noreferrer" className="underline underline-offset-4">
              GitHub
            </a>
          </div>
        </nav>

        <header className="pt-12 pb-10">
          <h1 className="font-display text-6xl leading-none text-[#14262b] md:text-7xl">Atufa Khan</h1>
          <p className="mt-2 font-display text-2xl text-[#1d5c68] italic">Software Engineer</p>
          <p className="mt-5 max-w-xl text-lg leading-relaxed">
            I build LLM agents and test whether they actually work: evaluation pipelines, LLM-as-a-Judge, and healthcare AI.
          </p>
          <a href={`mailto:${profile.email}`} className="mt-6 inline-block rounded-full bg-[#e9c46a] px-6 py-3 font-semibold text-[#1a1206] transition hover:-translate-y-0.5">
            {profile.email}
          </a>
        </header>

        <Section title="Education">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold text-[#14262b]">{education.school}</h3>
            <span className="text-sm text-[#5a6468]">{education.years}</span>
          </div>
          <p>{education.degree}</p>
          <p className="mt-1">
            CGPA <strong>9.1</strong> · {education.honor} · first across all sections in three subjects
          </p>
        </Section>

        <Section title="Experience">
          <div className="space-y-8">
            {experience.map((j) => (
              <div key={j.company}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-[#14262b]">{j.company}</h3>
                  <span className="text-sm text-[#5a6468]">
                    {j.period} · {j.place}
                  </span>
                </div>
                <p className="text-[#1d5c68]">{j.role}</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  {j.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Publications">
          <ul className="space-y-4">
            {publications.map((p) => (
              <li key={p.title}>
                <p className="font-medium text-[#14262b]">{p.title}</p>
                <p className="text-sm text-[#5a6468]">
                  <span className={p.status === "Accepted" ? "font-semibold text-[#2c7a3c]" : "font-semibold text-[#8a6a1a]"}>{p.status}</span>
                  {[p.kind, p.venue, p.date].filter(Boolean).map((x) => ` · ${x}`)}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Projects">
          <div className="space-y-7">
            {projects.map((p) => (
              <div key={p.name}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-lg font-semibold text-[#14262b]">{p.name}</h3>
                  <span className="text-sm text-[#5a6468]">{p.year}</span>
                  {p.tag && <span className="rounded-sm bg-[#e9c46a] px-2 py-0.5 text-xs font-semibold text-[#1a1206]">{p.tag}</span>}
                </div>
                <p className="mt-1">{p.blurb}</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px]">
                  {p.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-sm text-[#5a6468]">{p.stack.join(" · ")}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Honours & competitions">
          <ul className="list-disc space-y-1.5 pl-5">
            {awards.map((a) => (
              <li key={a.title}>
                <strong className="text-[#14262b]">{a.title}</strong>: {a.detail}
              </li>
            ))}
            {competitions.map((c) => (
              <li key={c.title}>
                <strong className="text-[#14262b]">{c.title}</strong> ({c.date}): {c.result}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Leadership">
          <ul className="list-disc space-y-1.5 pl-5">
            {leadership.map((l) => (
              <li key={l.role}>
                <strong className="text-[#14262b]">{l.role}</strong> ({l.period}): {l.detail}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Skills">
          <dl className="grid gap-3 sm:grid-cols-[150px_1fr]">
            {skills.map((g) => (
              <div key={g.group} className="contents">
                <dt className="font-semibold text-[#14262b]">{g.group}</dt>
                <dd>{g.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <footer className="border-t border-[#d9d2c3] pt-8 text-sm text-[#5a6468]">
          <a href="/" className="text-[#1d5c68] underline underline-offset-4">
            Take the voyage
          </a>{" "}
          for the story version of this page.
        </footer>
      </main>
    </div>
  );
}
