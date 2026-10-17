// Personal info → Photo, the moments between a pick and its result (lib/photo-picker.ts):
// a picture that is still loading never overrides a later Remove, pick or departure.
import { describe, it, expect } from "vitest";
import { photoPicker } from "@/lib/photo-picker";
import type { PhotoError } from "@/lib/photo";

type Result = { ok: true; dataUrl: string } | { ok: false; error: PhotoError };

/** A loader the test finishes by hand, in any order. */
function manualLoad() {
  const pending: ((r: Result) => void)[] = [];
  return {
    load: () => new Promise<Result>((resolve) => pending.push(resolve)),
    finish: (i: number, r: Result) => pending[i](r),
  };
}

function setup() {
  const loader = manualLoad();
  const changes: string[] = [];
  const busy: boolean[] = [];
  const errors: (PhotoError | null)[] = [];
  const picker = photoPicker({
    load: loader.load,
    onChange: (p) => changes.push(p),
    onBusy: (b) => busy.push(b),
    onError: (e) => errors.push(e),
  });
  return { loader, picker, changes, busy, errors };
}

const file = new File([new Uint8Array(10)], "me.jpg", { type: "image/jpeg" });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("photo picker", () => {
  it("puts the loaded picture in the CV", async () => {
    const { loader, picker, changes, busy } = setup();
    const done = picker.take(file);
    loader.finish(0, { ok: true, dataUrl: "data:image/jpeg;base64,AAAA" });
    await done;
    expect(changes).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(busy).toEqual([true, false]);
  });

  it("keeps a removed photo removed when the picture loading at that moment finishes later", async () => {
    const { loader, picker, changes, busy } = setup();
    const done = picker.take(file);
    picker.remove();
    loader.finish(0, { ok: true, dataUrl: "data:image/jpeg;base64,BBBB" });
    await done;
    expect(changes).toEqual([""]);
    expect(busy.at(-1)).toBe(false);
  });

  it("lets the newer pick win when an older one finishes after it", async () => {
    const { loader, picker, changes } = setup();
    const first = picker.take(file);
    const second = picker.take(file);
    loader.finish(1, { ok: true, dataUrl: "data:image/jpeg;base64,NEW" });
    await second;
    loader.finish(0, { ok: true, dataUrl: "data:image/jpeg;base64,OLD" });
    await first;
    expect(changes).toEqual(["data:image/jpeg;base64,NEW"]);
  });

  it("drops a picture that finishes after the user left the step", async () => {
    const { loader, picker, changes, busy, errors } = setup();
    const done = picker.take(file);
    picker.dispose();
    loader.finish(0, { ok: false, error: "UNREADABLE" });
    await done;
    await tick();
    expect(changes).toEqual([]);
    expect(busy).toEqual([true]);
    expect(errors).toEqual([null]);
  });

  it("shows why a picture failed", async () => {
    const { loader, picker, changes, errors } = setup();
    const done = picker.take(file);
    loader.finish(0, { ok: false, error: "NOT_IMAGE" });
    await done;
    expect(changes).toEqual([]);
    expect(errors).toEqual([null, "NOT_IMAGE"]);
  });
});
