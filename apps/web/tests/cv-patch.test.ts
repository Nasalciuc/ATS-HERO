// The builder's update (lib/cv-patch.ts, store/AppContext.tsx): a change that arrives late, such as
// a loaded photo, is applied to the latest CV, so what the user typed meanwhile survives, and only
// while the CV it was meant for is still open.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { applyCvPatch, laterUpdate, personalInfoPatch, type CvPatch } from "@/lib/cv-patch";
import { emptyCvData } from "@/lib/types";

const PHOTO = "data:image/jpeg;base64,AAAA";

describe("builder update", () => {
  it("merges plain values, as before", () => {
    const start = emptyCvData();
    const next = applyCvPatch(start, { personalInfo: { ...start.personalInfo, name: "Ana Popescu" } });
    expect(next.personalInfo.name).toBe("Ana Popescu");
    expect(next.summary).toEqual(start.summary);
  });

  it("applies a late photo to the latest personal info, keeping the name typed while it loaded", () => {
    const start = emptyCvData();
    // the photo starts loading on this render; then the user types a name
    const typed = applyCvPatch(start, personalInfoPatch({ name: "Ana Popescu" }));
    // the photo arrives
    const done = applyCvPatch(typed, personalInfoPatch({ photo: PHOTO }));
    expect(done.personalInfo.name).toBe("Ana Popescu");
    expect(done.personalInfo.photo).toBe(PHOTO);

    // the old way: values built from the render where the photo started lose the name
    const stale = applyCvPatch(typed, { personalInfo: { ...start.personalInfo, photo: PHOTO } });
    expect(stale.personalInfo.name).not.toBe("Ana Popescu");
  });

  it("applies a late update while the same CV is open, and drops it once another one is", () => {
    let generation = 0;
    const applied: CvPatch[] = [];
    const update = (patch: CvPatch) => applied.push(patch);

    const sameCv = laterUpdate(update, () => generation);
    sameCv(personalInfoPatch({ photo: PHOTO }));
    expect(applied).toHaveLength(1);

    const otherCv = laterUpdate(update, () => generation);
    generation++; // reset or openCv
    otherCv(personalInfoPatch({ photo: PHOTO }));
    expect(applied).toHaveLength(1);
  });

  it("is how AppContext merges every update and binds the late ones to the open CV", () => {
    const ctx = fs.readFileSync(path.join(__dirname, "../store/AppContext.tsx"), "utf8");
    // `{ ...prev, ...patch }` would compile and drop every function patch
    expect(ctx).toContain("setData((prev) => applyCvPatch(prev, patch))");
    expect(ctx).toContain("laterUpdate(update, () => generationRef.current)");
    // reset and openCv start a new generation, which is what drops a late result for the old CV
    expect(ctx).toMatch(/const reset = useCallback\(\(\) => \{[^}]*generationRef\.current\+\+/);
    expect(ctx).toMatch(/const openCv = useCallback\(async \(id: string\)[^}]*\+\+generationRef\.current/);
  });
});
