export type PersonalInfo = {
  name: string;
  email: string;
  phone: string;
  photo?: string;
  linkedin: string;
  website: string;
  country: string;
  cityState: string;
};

export type Summary = {
  position: string;
  valueProposition: string;
};

export type WorkItem = {
  id: string;
  role: string;
  company: string;
  description: string;
  startDate: string;
  endDate: string;
  current: boolean;
  country: string;
  cityState: string;
};

export type EducationItem = {
  id: string;
  institution: string;
  location: string;
  degree: string;
  minor: string;
  startDate: string;
  endDate: string;
  grade: string;
  additional: string;
};

export type SimpleEntry = {
  id: string;
  title: string;
  description: string;
  date: string;
};

export type CvData = {
  personalInfo: PersonalInfo;
  summary: Summary;
  work: WorkItem[];
  education: EducationItem[];
  skills: string[];
  awards: SimpleEntry[];
  certifications: SimpleEntry[];
  publications: SimpleEntry[];
  volunteering: SimpleEntry[];
  activities: SimpleEntry[];
};

export type Cv = {
  id: string;
  ownerId: string | null;
  title: string;
  data: CvData;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  email: string;
  passwordHash: string | null;
  createdAt: string;
};

export type SectionKey =
  | "personalInfo"
  | "education"
  | "summary"
  | "work"
  | "skills"
  | "awards"
  | "certifications"
  | "publications"
  | "volunteering"
  | "activities";

export type SectionReport = {
  key: SectionKey;
  label: string;
  score: number;
  entryScore: number;
  critical: string[];
  suggestions: string[];
  goodPractices: string[];
};

export type ScoreReport = {
  generalScore: number;
  message: string;
  sections: SectionReport[];
};

export type JobFitReport = {
  matchScore: number;
  matched: string[];
  missing: string[];
  message: string;
};

export type DbShape = {
  users: User[];
  cvs: Cv[];
};
