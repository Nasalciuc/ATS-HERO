import type { CvData } from "@/lib/types";

/** What the agent may type into an application form: contact details and the current job, nothing else. */
export interface ApplyProfile {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  website: string;
  city: string;
  country: string;
  location: string;
  currentCompany: string;
  currentTitle: string;
}

/**
 * The profile from the CV the person chose. The first name is the first word; the rest is the last name.
 * The current job is the one the CV marks as current, only: a past job is never typed in as the current one.
 */
export function applyProfile(cv: CvData): ApplyProfile {
  const p = cv.personalInfo;
  const fullName = p.name.trim().replace(/\s+/g, " ");
  const [firstName = "", ...rest] = fullName.split(" ");
  const current = cv.work.find((w) => w.current);
  return {
    fullName,
    firstName,
    lastName: rest.join(" "),
    email: p.email.trim(),
    phone: p.phone.trim(),
    linkedin: p.linkedin.trim(),
    website: p.website.trim(),
    city: p.cityState.trim(),
    country: p.country.trim(),
    location: [p.cityState.trim(), p.country.trim()].filter(Boolean).join(", "),
    currentCompany: current?.company.trim() ?? "",
    currentTitle: current?.role.trim() ?? "",
  };
}
