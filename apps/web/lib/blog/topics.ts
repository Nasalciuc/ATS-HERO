// The blog's topics: the chip on each post and, later, the filters on the list.
// `tone` picks the chip's colours in styles.css (.blog-chip--violet / --mint / --gray).
export const TOPICS = {
  "how-ats-works": { label: "How an ATS works", tone: "violet" },
  formatting: { label: "Formatting", tone: "gray" },
  "lab-results": { label: "Lab results", tone: "mint" },
} as const;

export type Topic = keyof typeof TOPICS;

export const TOPIC_IDS = Object.keys(TOPICS) as [Topic, ...Topic[]];
