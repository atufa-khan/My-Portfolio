/* The voyage timeline. Progress p runs 0 → 1 across the whole scroll. */

export type IslandKind = "shallows" | "arches" | "reef" | "village" | "summit" | "fire" | "dock";

export const chapters: {
  id: string; n: string; island: string; kind: IslandKind; title: string; story: string;
}[] = [
  {
    id: "about", n: "I", island: "The Shallows", kind: "shallows",
    title: "Where the light still reaches.",
    story: "Every voyage starts close to shore. Mine started with how minds work: the three courses where I came first, Brain-Computer Interface, NLP and Pattern Recognition, were all about exactly that.",
  },
  {
    id: "experience", n: "II", island: "The Current", kind: "arches",
    title: "The current.",
    story: "Past the shallows the current takes hold. An internship where models stopped being experiments and had to work for real people, every day.",
  },
  {
    id: "research", n: "III", island: "The Reef", kind: "reef",
    title: "Quieter questions.",
    story: "On the reef it’s quiet enough to think properly. Four papers so far, two accepted, most of them about minds that need care.",
  },
  {
    id: "projects", n: "IV", island: "The Village", kind: "village",
    title: "Built for people who need them.",
    story: "This is what the voyage is really for: things made for students who are struggling, patients who forget, and the people who care for them.",
  },
  {
    id: "honors", n: "V", island: "The Summit", kind: "summit",
    title: "Gold finds gold.",
    story: "Gold has a way of finding gold. Four medals, a section topper, and two hackathons where the same idea, care for student mental health, kept making the cut.",
  },
  {
    id: "leadership", n: "VI", island: "The Gathering", kind: "fire",
    title: "No one sails alone.",
    story: "Debates, delegations, workshops, and people who know more than I do. They’re how the fire stays lit.",
  },
  {
    id: "skills", n: "VII", island: "The Trading Post", kind: "dock",
    title: "What I carry.",
    story: "One last stop before the open sea, to load the canoe. This is everything I carry.",
  },
];

export const ISLANDS = chapters.length;
export const DOCK0 = 0.06;
export const STEP = 0.093;
export const DWELL = 0.046;
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
