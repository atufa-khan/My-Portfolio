/* What you find on each island: short waypoints up the trail, a summit, and one hidden extra. */
import { profile } from "./data";

export type Find = {
  title: string; // 2–4 words, shown next to the marker
  line: string; // one short line, shown when opened
  chips?: string[];
  status?: string;
  link?: { href: string; label: string };
};
export type IslandTrail = { stops: Find[]; summit: Find; extra?: Find };

const gh = { href: profile.github, label: "See it on GitHub" };

export const trails: IslandTrail[] = [
  // I · The Shallows: About
  {
    stops: [
      { title: "Sharda University", line: "B.Tech in Computer Science & Engineering, AI & ML. Class of 2027." },
      { title: "First in three", line: "Came first in Brain-Computer Interface, NLP and Pattern Recognition." },
      { title: "What I build", line: "Where LLM systems meet healthcare: agents, evaluation pipelines and medical AI." },
    ],
    summit: { title: "9.1 CGPA", line: "Out of 10, at Sharda University." },
    extra: { title: "Also studied", line: "Machine Learning with AWS." },
  },
  // II · The Current: Experience
  {
    stops: [
      { title: "Crink Pvt Ltd", line: "AI Engineering Intern, Product Team (R&D). Kochi, Jun – Aug 2026." },
      { title: "Coaching agents", line: "LLM agent systems for Cri, an AI leadership and performance coaching platform." },
      { title: "LLM-as-a-Judge", line: "Evaluation pipelines that score conversations across multiple quality dimensions." },
      { title: "Synthetic clients", line: "Simulated coaching clients that stress-test agent behaviour and edge cases." },
    ],
    summit: { title: "Shipped to production", line: "AI workflows built for a real product, not a demo.", chips: ["LLM agents", "Evaluation", "SLM fine-tuning"] },
  },
  // III · The Reef: Papers
  {
    stops: [
      { title: "Mental-health classifier", line: "Nested validation + stacking ensemble. IEEE SIDE’26, Springer Nature.", status: "Accepted" },
      { title: "Retina screening", line: "EfficientNet-B3 with CLAHE and Grad-CAM explainability. Springer.", status: "Accepted" },
      { title: "Hybrid ensembles", line: "Binary and multiclass mental-health classification. Springer conference.", status: "Under review" },
      { title: "Diffusion models", line: "Book chapter on diffusion models in vision, NLP and healthcare. Wiley.", status: "Under review" },
    ],
    summit: { title: "Research", line: "Machine learning for mental health and medical imaging." },
  },
  // IV · The Village: Projects
  {
    stops: [
      { title: "Memora", line: "Alzheimer’s patient & caregiver app: medication, routines, SOS alerts.", chips: ["Flutter", "Supabase", "PostgreSQL"], link: gh },
      { title: "Performance platform", line: "Goals, reviews, probation and HR admin with role-based workspaces.", chips: ["Next.js", "TypeScript", "Supabase"], link: gh },
      { title: "RAG chatbot", line: "Ask questions of your own documents, running on local models.", chips: ["LangChain", "FAISS", "Ollama"], link: gh },
      { title: "Brain-X", line: "Brain-tumour classification from MRI scans with a custom CNN.", chips: ["Keras", "OpenCV"], link: gh },
    ],
    summit: {
      title: "Sukoonify",
      line: "Mental-wellness platform for students, with an AI companion. Hackathon finalist.",
      chips: ["React Native", "Node.js", "Groq API"],
      link: gh,
    },
  },
  // V · Achievements & Leadership
  {
    stops: [
      { title: "Section topper", line: "Ranked first overall in Section CSK, third year." },
      { title: "NPTEL Elite · 97%", line: "IIT Kharagpur course, among 21,132 certified candidates." },
      { title: "Sustain-a-thon finalist", line: "Top 60 of 500+ teams at a national 32-hour hackathon." },
      { title: "Smart India Hackathon", line: "Selected in the top 45 of 350+ teams (internal round)." },
      { title: "Google Student Ambassador", line: "Led campus workshops on Google technologies, 2025–26." },
      { title: "Youth Parliament & MUN", line: "Policy debates, and represented India in UNDP at MUN." },
    ],
    summit: { title: "4× Gold Medalist", line: "First position in four academic categories at Sharda University." },
  },
];
