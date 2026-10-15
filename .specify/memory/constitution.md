# ATS Hero Constitution

## Core Principles

### I. Value before the paywall
A guest can build, score and export a CV without an account. Signing in keeps the work
(guest → claim) and never takes it away. Paid tiers add depth; they never lock the basics a
user has already produced.

### II. Output that passes an ATS (NON-NEGOTIABLE)
Every exported CV (PDF, DOCX) must be readable by applicant tracking systems and correct to the
letter. Template, export and print changes are measured by the ATS lab (`tools/ats-lab`) and
visually checked; ATS-recommended layouts never FAIL on any extractor. A defect that changes
what a recruiter reads (lost letters, cut contacts, missing fields) blocks a release.

### III. Truthful product
The site only claims what the product does today. Scores are deterministic and explainable;
AI output is labelled and bounded (kill-switch, quotas). Lab numbers, not opinions, decide
template recommendations.

### IV. Security and privacy by default
No secrets in code, commits, logs or chats. Every data access is scoped to its owner. Users'
CVs never go to third parties without explicit consent and a DPA; test data is synthetic.
No scraping or automation of LinkedIn. No fake applications to real employers.

### V. Measured design fidelity
Figma is the source of truth for the UI. Screens are matched within ±2px and locked by the
design check in CI; screens without a frame are designed in Figma before they are built.

### VI. Small, verified steps
One change at a time, each with its checks (types, tests, build, design check, ATS lab when
relevant) and a stop before the next. AI-written plans are drafts until verified against the
code.

## Technology and constraints

The stack, commands, gates and detailed rules live in `AGENTS.md` at the repository root, the
single operational guide for every agent (Cursor reads it directly; Claude Code through
`CLAUDE.md`). In short: Next.js 16 + React 19 on Vercel, Postgres + Drizzle, Clerk, Paddle,
`@react-pdf/renderer` + `docx` for output, FastAPI + spaCy for Tier 2, AWS (us-east-1) as
CloudFormation. Styling is the project's own CSS design system plus Tailwind utilities; no UI kit.

## Development workflow and quality gates

- CI must stay green: XSS/secret grep gate, vitest, build, pytest, Figma design check (UI PRs),
  ATS lab (template/export PRs), migration check (schema PRs).
- Components are not moved, renamed or deleted without notice to the designer (Liubovi).
- Push, PR and deploy happen only on the product owner's (Scaler's) decision.

## Governance

This constitution states the principles; `AGENTS.md` turns them into rules and commands. When
they disagree, the principles here win and `AGENTS.md` is fixed in the same change. Amendments
are made by pull request with a version bump: MAJOR for a removed or redefined principle, MINOR
for a new principle or section, PATCH for wording.

**Version**: 1.0.0 | **Ratified**: 2026-10-14 | **Last Amended**: 2026-10-14
