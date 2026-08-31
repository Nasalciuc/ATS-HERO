import { z } from "zod";
import type { CvData } from "./types";

/**
 * Zod mirror of CvData (lib/types.ts). This is the trust boundary for `cvs.data`:
 * jsonb is opaque to Postgres, so every write parses through here.
 * Keep in sync with lib/types.ts — same-commit rule.
 */
const personalInfoSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  photo: z.string().optional(),
  linkedin: z.string(),
  website: z.string(),
  country: z.string(),
  cityState: z.string(),
});

const summarySchema = z.object({
  position: z.string(),
  valueProposition: z.string(),
});

const workItemSchema = z.object({
  id: z.string(),
  role: z.string(),
  company: z.string(),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  current: z.boolean(),
  country: z.string(),
  cityState: z.string(),
});

const educationItemSchema = z.object({
  id: z.string(),
  institution: z.string(),
  location: z.string(),
  degree: z.string(),
  minor: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  grade: z.string(),
  additional: z.string(),
});

const simpleEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.string(),
  organisation: z.string().optional(),
  issuer: z.string().optional(),
  publisher: z.string().optional(),
  link: z.string().optional(),
  activityType: z.string().optional(),
  role: z.string().optional(),
  location: z.string().optional(),
  endDate: z.string().optional(),
  ongoing: z.boolean().optional(),
});

const languageItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.string(),
});

export const cvDataSchema = z.object({
  personalInfo: personalInfoSchema,
  summary: summarySchema,
  work: z.array(workItemSchema),
  education: z.array(educationItemSchema),
  skills: z.array(z.string()),
  instruments: z.array(z.string()),
  softSkills: z.array(z.string()),
  languages: z.array(languageItemSchema),
  awards: z.array(simpleEntrySchema),
  certifications: z.array(simpleEntrySchema),
  publications: z.array(simpleEntrySchema),
  volunteering: z.array(simpleEntrySchema),
  activities: z.array(simpleEntrySchema),
}) satisfies z.ZodType<CvData>;
