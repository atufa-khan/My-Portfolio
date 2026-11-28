/* The voyage timeline. Progress p runs 0 → 1 across the whole scroll. */

export type IslandKind = "shallows" | "arches" | "reef" | "village" | "summit" | "fire" | "dock";

export const chapters: {
  id: string; n: string; island: string; kind: IslandKind; title: string; story: string;
  /** When this part of the story happened. */
  year: string;
  /** The single best fact, shown as the canoe passes. */
  teaser: string;
}[] = [
  {
    id: "about", year: "2023", teaser: "9.1 CGPA, and first across all sections in three subjects", n: "I", island: "Education", kind: "shallows",
    title: "A strong foundation in AI and machine learning.",
    story: "Every voyage starts close to shore. Mine started with how minds work: the three courses where I came first, Brain-Computer Interface, NLP and Pattern Recognition, were all about exactly that.",
  },
  {
    id: "experience", year: "Summer 2026", teaser: "AI Engineering Intern @ Crink: LLM eval pipelines", n: "II", island: "Experience", kind: "arches",
    title: "Building LLM systems in industry and research.",
    story: "Past the shallows the current takes hold. An internship where models stopped being experiments and had to work for real people, every day.",
  },
  {
    id: "research", year: "2026", teaser: "Research in ML for mental health and medical imaging", n: "III", island: "Research", kind: "reef",
    title: "Research publications.",
    story: "On the reef it’s quiet enough to think properly. Four papers so far, two accepted, most of them about minds that need care.",
  },
  {
    id: "projects", year: "2024 – 2026", teaser: "Sukoonify: national hackathon finalist, top 60 of 500+ teams", n: "IV", island: "Projects & Skills", kind: "village",
    title: "Projects and skills.",
    story: "This is what the voyage is really for: things made for students who are struggling, patients who forget, and the people who care for them.",
  },
  {
    id: "honors", year: "2023 – 2026", teaser: "4× Gold Medalist, and a national hackathon finalist", n: "V", island: "Achievements & Leadership", kind: "summit",
    title: "Achievements and leadership.",
    story: "Academic distinctions, competitive results and leadership roles.",
  },
];

export const ISLANDS = chapters.length;
export const DOCK0 = 0.06;
/** spacing scales with the number of islands, so the voyage keeps its length */
export const STEP = 0.651 / chapters.length;
export const DWELL = STEP * 0.5;
export const dockStart = (i: number) => DOCK0 + i * STEP;
export const dockEnd = (i: number) => dockStart(i) + DWELL;
export const SEA_END = 0.77; // storm peaks
export const WAVE_END = 0.84; // swallowed by the wave
export const LANDED = 0.975; // ring rests on the seabed

const ease = (k: number) => (k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k));

/** Camera position in "islands" (0 = docked at island I). */
export function cameraAt(p: number) {
  if (p < DOCK0) return -1 + ease(p / DOCK0);
  for (let i = 0; i < ISLANDS; i++) {
    if (p < dockStart(i)) {
      const a = dockEnd(i - 1);
      return i - 1 + ease((p - a) / (dockStart(i) - a));
    }
    if (p <= dockEnd(i)) return i;
  }
  return ISLANDS - 1 + ((p - dockEnd(ISLANDS - 1)) / (SEA_END - dockEnd(ISLANDS - 1))) * 1.3;
}

/** Which chapter panel is open: 0..6 for islands, 7 for the finale, -1 for none. */
export function activeAt(p: number) {
  if (p >= LANDED) return ISLANDS;
  for (let i = 0; i < ISLANDS; i++) if (p >= dockStart(i) - 0.004 && p <= dockEnd(i) + 0.004) return i;
  return -1;
}
