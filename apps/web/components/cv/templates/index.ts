// Template registry — the single list the selector UI and the export flow read from.
// Adding a template = add a file + one entry here.
import type { ComponentType } from "react";
import ClassicTemplate from "./classic";
import ModernTemplate from "./modern";
import MinimalTemplate from "./minimal";
import type { CvData } from "@/lib/types";
import type { TemplateTheme } from "./theme";

export type TemplateId = "classic" | "modern" | "minimal";

export interface TemplateProps {
  data: CvData;
  theme: TemplateTheme;
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  /** Thumbnail path under /public (generate from a sample render). */
  thumbnail: string;
  component: ComponentType<TemplateProps>;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Single column with accent section bars. Safe, recruiter-friendly default.",
    thumbnail: "/templates/classic.png",
    component: ClassicTemplate,
  },
  {
    id: "modern",
    name: "Modern",
    description: "Two-column with a colored sidebar for contact and skills.",
    thumbnail: "/templates/modern.png",
    component: ModernTemplate,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean single column, underlined headings, generous whitespace.",
    thumbnail: "/templates/minimal.png",
    component: MinimalTemplate,
  },
];

export const DEFAULT_TEMPLATE: TemplateId = "classic";

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
