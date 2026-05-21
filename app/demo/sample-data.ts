export const SAMPLE_PROFILE = {
  name: "Priya Raman",
  headline: "Senior ML Engineer at DeepMind · ex-Stripe",
  location: "London, United Kingdom",
  about:
    "ML engineer focused on inference-time efficiency. Previously built fraud models at Stripe. Recent talk on sparse attention at NeurIPS 2025.",
  experience: [
    "Senior ML Engineer, Google DeepMind — 2024 to present",
    "Senior ML Engineer, Stripe — 2020 to 2024",
    "ML Engineer, Two Sigma — 2018 to 2020",
  ],
  recentPost:
    "After two months on sparse-attention inference, the real win wasn't latency — it was the smaller models we could now deploy to edge.",
};

export const SAMPLE_RESUME = `Nagarjun Mallesh — MS Computer Science, Boston University.
Built fraud-detection pipelines processing 4M events/day at a fintech startup.
Open-source contributor: pytorch/serve. Looking for ML infra roles where inference cost matters.`;

export const SAMPLE_DRAFT = {
  category: "linkedin_connection" as const,
  body: "Hi Priya — read your NeurIPS talk on sparse attention. I worked on inference-cost reduction at a fintech (smaller scale, fraud pipelines) and the edge-deploy angle in your recent post matched what we saw — smaller models often unlocked more than raw latency. Would love to follow your work.",
  character_count: 322,
  processingTime: 7400,
};
