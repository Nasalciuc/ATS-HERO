// The builder's update (lib/cv-patch.ts, store/AppContext.tsx): a change that arrives late, such as
// a loaded photo, is applied to the latest CV, so what the user typed meanwhile survives.
import { describe, it, expect } from "vitest";
import { applyCvPatch } from "@/lib/cv-patch";
import { emptyCvData } from "@/lib/types";

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
    const typed = applyCvPatch(start, (latest) => ({ personalInfo: { ...latest.personalInfo, name: "Ana Popescu" } }));
    // the photo arrives
    const photo = "data:image/jpeg;base64,AAAA";
    const done = applyCvPatch(typed, (latest) => ({ personalInfo: { ...latest.personalInfo, photo } }));
    expect(done.personalInfo.name).toBe("Ana Popescu");
    expect(done.personalInfo.photo).toBe(photo);

    // the old way: values built from the render where the photo started lose the name
    const stale = applyCvPatch(typed, { personalInfo: { ...start.personalInfo, photo } });
    expect(stale.personalInfo.name).not.toBe("Ana Popescu");
  });
});
