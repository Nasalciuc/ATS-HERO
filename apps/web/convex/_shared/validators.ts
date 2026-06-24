import { v } from "convex/values";

// Validators mirror apps/web/lib/types.ts exactly. Keep them in sync if CvData changes.

export const personalInfoValidator = v.object({
  name: v.string(),
  email: v.string(),
  phone: v.string(),
  photo: v.optional(v.string()),
  linkedin: v.string(),
  website: v.string(),
  country: v.string(),
  cityState: v.string(),
});

export const summaryValidator = v.object({
  position: v.string(),
  valueProposition: v.string(),
});

export const workItemValidator = v.object({
  id: v.string(),
  role: v.string(),
  company: v.string(),
  description: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  current: v.boolean(),
  country: v.string(),
  cityState: v.string(),
});

export const educationItemValidator = v.object({
  id: v.string(),
  institution: v.string(),
  location: v.string(),
  degree: v.string(),
  minor: v.string(),
  startDate: v.string(),
  endDate: v.string(),
  grade: v.string(),
  additional: v.string(),
});

export const simpleEntryValidator = v.object({
  id: v.string(),
  title: v.string(),
  description: v.string(),
  date: v.string(),
  organisation: v.optional(v.string()),
  issuer: v.optional(v.string()),
  publisher: v.optional(v.string()),
  link: v.optional(v.string()),
  activityType: v.optional(v.string()),
  role: v.optional(v.string()),
  location: v.optional(v.string()),
  endDate: v.optional(v.string()),
  ongoing: v.optional(v.boolean()),
});

export const languageItemValidator = v.object({
  id: v.string(),
  name: v.string(),
  level: v.string(),
});

export const cvDataValidator = v.object({
  personalInfo: personalInfoValidator,
  summary: summaryValidator,
  work: v.array(workItemValidator),
  education: v.array(educationItemValidator),
  skills: v.array(v.string()),
  instruments: v.array(v.string()),
  softSkills: v.array(v.string()),
  languages: v.array(languageItemValidator),
  awards: v.array(simpleEntryValidator),
  certifications: v.array(simpleEntryValidator),
  publications: v.array(simpleEntryValidator),
  volunteering: v.array(simpleEntryValidator),
  activities: v.array(simpleEntryValidator),
});

export const scanKindValidator = v.union(v.literal("score"), v.literal("jobfit"));
