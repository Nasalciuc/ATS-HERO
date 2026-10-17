import type { CvData, PersonalInfo } from "./types";

/**
 * A change to the CV in the builder: the new values, or a function that makes them from the
 * latest data. Use the function form for anything that arrives later (a loaded photo): values
 * built from an older render would overwrite what the user typed in the meantime.
 *
 * Only applyCvPatch may merge one: `{ ...prev, ...patch }` compiles too, and silently drops every
 * function patch (tests/cv-patch.test.ts checks that AppContext merges through applyCvPatch).
 */
export type CvPatch = Partial<CvData> | ((latest: CvData) => Partial<CvData>);

export function applyCvPatch(prev: CvData, patch: CvPatch): CvData {
  return { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
}

/** A change to Personal info, merged into the latest personal info. */
export function personalInfoPatch(patch: Partial<PersonalInfo>): CvPatch {
  return (latest) => ({ personalInfo: { ...latest.personalInfo, ...patch } });
}

/**
 * An update for a result that arrives later (a photo still loading), bound to the CV open when it
 * is made: it applies while that CV is open, even once the form is gone, and does nothing after
 * another CV was opened or started (AppContext moves `generation` on with every reset and openCv).
 */
export function laterUpdate(update: (patch: CvPatch) => void, generation: () => number) {
  const start = generation();
  return (patch: CvPatch) => {
    if (generation() === start) update(patch);
  };
}
