export const profile = {
  name: "Atufa Khan",
  role: "Software Engineer",
  tagline:
    "I build LLM agents, evaluation pipelines and healthcare AI — and write papers about what I learn along the way.",
  email: "atufacodeaiml@gmail.com",
  linkedin: "https://linkedin.com/in/atufa-khan",
  github: "https://github.com/atufa-khan",
  location: "Greater Noida, India",
};

export const stats = [
  { value: "9.1", label: "CGPA / 10" },
  { value: "4×", label: "Gold Medalist" },
  { value: "4", label: "Research papers" },
  { value: "Top 60", label: "of 500+ at Sustain-a-thon" },
];

export const education = {
  school: "Sharda University",
  place: "Greater Noida, U.P.",
  degree: "B.Tech in Computer Science & Engineering — AI & ML",
  years: "2023 – 2027",
  cgpa: "9.1 / 10",
  coursework: [
    "Brain-Computer Interface",
    "Natural Language Processing",
    "Pattern Recognition",
    "Machine Learning with AWS",
  ],
};

export const experience = [
  {
    company: "Crink Pvt Ltd",
    role: "AI Engineering Intern · Product Team (R&D)",
    period: "Jun 2026 – Aug 2026",
    place: "Kerala, India",
    points: [
      "Built AI coaching infrastructure for Cri, an AI leadership and performance coaching platform, working on LLM-powered agent systems and production AI workflows.",
      "Developed LLM evaluation and LLM-as-a-Judge pipelines that score conversational AI across multiple quality dimensions, enabling systematic benchmarking of AI-generated outputs.",
      "Built synthetic client simulation agents that generate realistic coaching scenarios to test agent behavior, conversation quality, reliability, and edge cases.",
      "Trained, fine-tuned, and benchmarked small language models on domain-specific tasks.",
    ],
  },
  {
    company: "Indian Institute of Information Technology Kottayam",
    role: "Research Intern · MINDS Research Lab",
    period: "May 2026 – Jul 2026",
    place: "Remote",
    points: [
      "Investigated patient monitoring and caregiver support needs for a Big Data Analytics in Healthcare research project and translated them into mobile application requirements.",
      "Contributed to the system architecture and database design for a lightweight mobile application that supports medication schedules, patient location monitoring, and emergency notifications.",
    ],
  },
];

export const publications = [
  {
    title:
      "Multiclass Mental Health Classification Using Nested Validation and Stacking Ensemble",
    venue:
      "IEEE International Conference on Secure and Intelligent Digital Ecosystems (SIDE’26), Springer Nature STEAM-H",
    date: "Oct 2026",
    status: "Accepted",
    kind: "Conference",
  },
  {
    title:
      "Automated Binary Screening of Diabetic Retinopathy Using EfficientNet-B3 with CLAHE and Grad-CAM-Based Explainability",
    venue:
      "3rd International Conference on Next Generation Communication and Computing, Springer",
    date: "Oct 2026",
    status: "Accepted",
    kind: "Conference",
  },
  {
    title:
      "Hybrid Ensemble Learning for Binary and Multiclass Classification of Mental Health",
    venue:
      "8th International Conference on Artificial Intelligence and Speech Technology, Springer",
    date: "Nov 2026",
    status: "Under Review",
    kind: "Conference",
  },
  {
    title:
      "Applications of Diffusion Models in Computer Vision, NLP, and Healthcare",
    venue:
      "Diffusion AI Models: Algorithms, Architectures, and Applications — Wiley/Scrivener (Scopus-indexed)",
    date: "Aug 2026",
    status: "Under Review",
    kind: "Book Chapter",
  },
  {
    title:
      "Security and Privacy in Digital Mental Health Service Facilitation Platforms: A Systematic Literature Review of Threats, Protection Mechanisms, and Student Wellbeing Applications",
    venue: "",
    date: "",
    status: "In progress",
    kind: "Systematic literature review",
  },
];

export const projects = [
  {
    name: "Sukoonify",
    year: "2026",
    blurb:
      "AI-assisted mental wellness platform for college students — self-assessments, counselling appointments, curated resources and an AI companion.",
    highlights: [
      "PHQ-9 / PHQ-2 scoring with automated safety alerts",
      "Groq-powered companion with emotion classification & crisis-phrase screening",
      "JWT + bcrypt auth, role-based access, counsellor & admin dashboards",
    ],
    stack: ["React Native", "Expo", "Node.js", "Express", "PostgreSQL", "MongoDB", "Groq API"],
    tag: "Hackathon finalist",
  },
  {
    name: "Memora",
    year: "2026",
    blurb:
      "Alzheimer’s patient & caregiver coordination app — medication tracking, daily routines, SOS alerts and care coordination.",
    highlights: [
      "Row Level Security & expiring hashed caregiver invite codes",
      "Idempotent dose workflows with audit records",
      "SOS alerts with Supabase Realtime sync",
    ],
    stack: ["Flutter", "Dart", "Riverpod", "Supabase", "PostgreSQL"],
  },
  {
    name: "PMS — Performance Management",
    year: "2026",
    blurb:
      "Full-stack performance platform for goals, reviews, probation and HR admin with role-based workspaces.",
    highlights: [
      "Hierarchical goals with approval flows & weighted progress",
      "Audit logging, CSV reporting, ownership transfers",
      "Email + in-app notifications, 13 passing smoke tests",
    ],
    stack: ["Next.js", "React", "TypeScript", "PostgreSQL", "Supabase", "Zod"],
  },
  {
    name: "RAG Document Chatbot",
    year: "2025",
    blurb:
      "Ask questions of your own documents with retrieval-augmented generation running on local models.",
    highlights: [
      "PDF / DOCX / TXT / Markdown ingestion with overlapping chunks",
      "MiniLM embeddings + FAISS, configurable top-k",
      "Streamed, citation-aware answers via Ollama",
    ],
    stack: ["Python", "LangChain", "FAISS", "Sentence Transformers", "Ollama", "Streamlit"],
  },
  {
    name: "Brain-X",
    year: "2024",
    blurb:
      "Brain tumour classification from MRI scans using a custom CNN compared against MobileNet transfer learning.",
    highlights: [
      "OpenCV preprocessing with brain-contour cropping",
      "Augmentation to expand a 253-image dataset",
      "Early stopping, checkpointing, held-out evaluation",
    ],
    stack: ["Python", "Keras", "OpenCV", "NumPy", "scikit-learn"],
  },
];

export const awards = [
  {
    title: "Four-Time Gold Medalist",
    detail: "1st position in four academic categories at Sharda University.",
  },
  {
    title: "Section Topper — 1st Overall",
    detail: "Section CSK, 3rd Year.",
  },
  {
    title: "Subject Gold Medals",
    detail:
      "1st across all sections in Brain-Computer Interface, Intro to NLP and Pattern Recognition.",
  },
  {
    title: "NPTEL Elite — 97%",
    detail:
      "Education for Sustainable Development, IIT Kharagpur, among 21,132 certified candidates.",
  },
  {
    title: "Merit Scholarship",
    detail: "20% merit-based academic scholarship, Sharda University.",
  },
];

export const competitions = [
  {
    title: "Sustain-a-thon — National 32-hour Hackathon",
    result: "Finalist · Top 60 of 500+ teams",
    date: "Nov 2025",
    detail:
      "Presented Sukoonify with AI mood check-ins, confidential counselling access and an anonymous campus-wellbeing dashboard.",
  },
  {
    title: "Smart India Internal Hackathon",
    result: "Selected · Top 45 of 350+ teams",
    date: "Sep 2025",
    detail:
      "PS 25092 — a digital mental health and psychological support system for students in higher education.",
  },
];

export const leadership = [
  {
    role: "Google Student Campus Ambassador",
    period: "Aug 2025 – Jan 2026",
    detail: "Ran on-campus workshops on Google technologies and learning resources.",
  },
  {
    role: "Member, Youth Parliament",
    period: "Feb 2026 – Present",
    detail: "Parliamentary debates and policy discussions on social and developmental issues.",
  },
  {
    role: "MUN Delegate",
    period: "Nov 2024 – Present",
    detail:
      "Represented India in UNDP on “Mitigating the Impacts of Overpopulation on Sustainability.”",
  },
  {
    role: "Member, Environment Club",
    period: "Sep 2023 – Present",
    detail: "Environmental awareness and sustainability initiatives on campus.",
  },
];

export const skills = [
  { group: "Languages", items: ["Python", "Java", "JavaScript", "TypeScript", "SQL", "C"] },
  {
    group: "AI / ML",
    items: ["PyTorch", "HuggingFace Transformers", "LangChain", "LlamaIndex", "CNNs", "Transfer Learning", "Ensemble Learning", "Grad-CAM", "OpenCV"],
  },
  {
    group: "Generative AI",
    items: ["RAG", "FAISS", "ChromaDB", "Prompt Engineering", "LLM Evaluation", "LLM-as-a-Judge"],
  },
  {
    group: "Software",
    items: ["React.js", "Next.js", "Node.js", "Express.js", "FastAPI", "REST APIs", "HTML5", "CSS3"],
  },
  { group: "Databases", items: ["PostgreSQL", "MongoDB", "Supabase", "Vector Databases"] },
  { group: "Cloud & Tools", items: ["Git", "GitHub", "Docker", "AWS", "Azure", "Linux"] },
];

export const certifications = [
  { name: "Machine Learning Foundations", by: "AWS", date: "Apr 2026" },
  { name: "Education for Sustainable Development (Elite, 97%)", by: "NPTEL · IIT Kharagpur", date: "Jan–Apr 2026" },
  { name: "OCI AI Foundations", by: "Oracle", date: "Oct 2025" },
  { name: "Project Management: Planning, Execution, Evaluation & Control", by: "NPTEL", date: "Oct 2025" },
  { name: "AI Agents Fundamentals", by: "Hugging Face", date: "Sep 2025" },
  { name: "Java Fundamentals", by: "Oracle", date: "May 2025" },
  { name: "Ethics in Engineering Practice", by: "NPTEL", date: "May 2025" },
  { name: "Python for Data Science & ML", by: "Meta Brains", date: "Feb 2025" },
  { name: "Java Foundations", by: "Oracle", date: "Oct 2024" },
  { name: "Web Development Workshop", by: "OWASP Sharda University", date: "Oct 2024" },
  { name: "Coordination & Technical Training", by: "UNICEF", date: "Aug 2024" },
  { name: "Data Science", by: "NSDC Academy", date: "Jul 2024" },
  { name: "Technology Apprenticeship Job Simulation", by: "Forage", date: "Jul 2024" },
  { name: "Data Science", by: "Internshala", date: "Jun 2024" },
  { name: "Introduction to Artificial Intelligence", by: "SkillUp Online", date: "Jun 2024" },
];

export const events = [
  {
    name: "ELECRAMA 2025",
    place: "Greater Noida",
    date: "Feb 2025",
    detail: "International exhibition on power, energy and sustainability-focused technology.",
  },
  {
    name: "Azure DevOps Day",
    place: "Microsoft Office, Noida",
    date: "Sep 2024",
    detail: "CI/CD with Azure Pipelines, Docker, Kubernetes, Terraform and ARM templates.",
  },
];
