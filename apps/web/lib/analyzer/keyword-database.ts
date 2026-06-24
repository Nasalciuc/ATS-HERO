// Client-side skill extraction — mirrors apps/ai keyword_extractor.py for instant
// builder feedback. Heavy/NLP extraction stays in the Python service. Same data source.

import { skills } from "./shared-data";

const TECH = new Set(skills.tech_skills.map((s) => s.toLowerCase()));
const SINGLE = skills.single_letter.map((s) => s.toLowerCase());
const PHRASES = skills.phrases.map((s) => s.toLowerCase());
const DISPLAY = skills.display;

const STRIP = /^[^\w#+]+|[^\w#+]+$/g;

function norm(token: string): string {
  return token.replace(STRIP, "").toLowerCase();
}

function display(skill: string): string {
  if (DISPLAY[skill]) return DISPLAY[skill];
  return /^[a-z]+$/.test(skill) ? skill.charAt(0).toUpperCase() + skill.slice(1) : skill;
}

export function extractSkills(text: string): string[] {
  const found = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    const n = norm(raw);
    if (TECH.has(n)) found.add(n);
  }
  const lowered = text.toLowerCase();
  for (const phrase of PHRASES) {
    if (lowered.includes(phrase)) found.add(phrase);
  }
  for (const letter of SINGLE) {
    const re = new RegExp(
      `(?:^|[,;|/\\u2022\\n]|\\band\\s)\\s*${letter}\\s*(?:[,;|/\\u2022\\n]|$|\\band\\b)`,
    );
    if (re.test(lowered)) found.add(letter);
  }
  return Array.from(found, display).sort();
}

export const skillSet = (): Set<string> => new Set(TECH);
