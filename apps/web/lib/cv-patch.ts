import type { CvData } from "./types";

/**
 * A change to the CV in the builder: the new values, or a function that makes them from the
 * latest data. Use the function form for anything that arrives later (a loaded photo): values
 * built from an older render would overwrite what the user typed in the meantime.
 */
export type CvPatch = Partial<CvData> | ((latest: CvData) => Partial<CvData>);

export function applyCvPatch(prev: CvData, patch: CvPatch): CvData {
  return { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
}
