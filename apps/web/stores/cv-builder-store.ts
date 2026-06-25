// Builder UI state — Zustand. Per the agreed architecture: CV DATA lives in Convex
// (reactive queries/mutations) and form fields in React Hook Form; this store holds only
// the ephemeral builder chrome (which step, which optional sections, save status, the
// chosen template). Do NOT put CvData here — that's the Reactive-Resume mistake we avoid.
import { create } from "zustand";

export type OptionalSection =
  | "languages" | "awards" | "certifications" | "publications" | "volunteering" | "activities";

export const OPTIONAL_SECTIONS: OptionalSection[] = [
  "languages", "awards", "certifications", "publications", "volunteering", "activities",
];

interface BuilderState {
  currentStep: number;
  enabledSections: OptionalSection[];
  isDirty: boolean;
  isSaving: boolean;
  templateId: string;
  accent: number | string; // 1-6 preset, or any hex string

  setStep: (step: number) => void;
  next: () => void;
  prev: () => void;
  toggleSection: (s: OptionalSection) => void;
  isSectionEnabled: (s: OptionalSection) => boolean;
  setDirty: (v: boolean) => void;
  setSaving: (v: boolean) => void;
  setTemplate: (id: string) => void;
  setAccent: (a: number | string) => void;
  reset: () => void;
}

const initial = {
  currentStep: 0,
  enabledSections: [] as OptionalSection[],
  isDirty: false,
  isSaving: false,
  templateId: "classic",
  accent: 1,
};

export const useBuilderStore = create<BuilderState>((set, get) => ({
  ...initial,

  setStep: (step) => set({ currentStep: Math.max(0, step) }),
  next: () => set((s) => ({ currentStep: s.currentStep + 1 })),
  prev: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),

  toggleSection: (sec) =>
    set((s) => ({
      enabledSections: s.enabledSections.includes(sec)
        ? s.enabledSections.filter((x) => x !== sec)
        : [...s.enabledSections, sec],
      isDirty: true,
    })),
  isSectionEnabled: (sec) => get().enabledSections.includes(sec),

  setDirty: (v) => set({ isDirty: v }),
  setSaving: (v) => set({ isSaving: v }),
  setTemplate: (id) => set({ templateId: id, isDirty: true }),
  setAccent: (n) => set({ accent: n, isDirty: true }),

  reset: () => set(initial),
}));
