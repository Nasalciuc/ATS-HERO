import type { JobFitReport } from "../types";

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
  "this", "that", "from", "they", "their", "what", "when", "who", "all", "can",
  "has", "was", "were", "but", "not", "any", "may", "use", "used", "using",
  "able", "must", "should", "would", "could", "into", "over", "than", "then",
  "them", "these", "those", "such", "via", "per", "etc", "job", "role", "work",
  "team", "teams", "ability", "experience", "experienced", "years", "year",
  "strong", "good", "great", "well", "plus", "including", "include", "includes",
  "responsibilities", "requirements", "required", "preferred", "candidate",
  "candidates", "looking", "join", "help", "across", "within", "ensure",
  "support", "build", "building", "develop", "developing", "company",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function keywordFreq(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tokens) map.set(t, (map.get(t) ?? 0) + 1);
  return map;
}

export function jobFit(cvText: string, jobText: string): JobFitReport {
  const cvTokens = new Set(tokenize(cvText));
  const jobFreq = keywordFreq(tokenize(jobText));

  // Rank job keywords by frequency, keep the most significant ones.
  const ranked = [...jobFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word]) => word);

  if (ranked.length === 0) {
    return {
      matchScore: 0,
      matched: [],
      missing: [],
      message: "Add a job description to compute your match score.",
    };
  }

  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of ranked) {
    if (cvTokens.has(kw)) matched.push(kw);
    else missing.push(kw);
  }

  const matchScore = Math.round((matched.length / ranked.length) * 1000) / 10;

  return {
    matchScore,
    matched,
    missing,
    message: messageForMatch(matchScore),
  };
}

function messageForMatch(score: number): string {
  if (score >= 75)
    return "Strong match — your resume aligns well with this job's requirements.";
  if (score >= 50)
    return "Partial match — add the missing keywords to improve your alignment.";
  return "Low match — tailor your resume with the missing skills and keywords below.";
}
