// Personal info → Photo, the moments between a pick and its result (lib/photo-picker.ts):
// a picture that is still loading never overrides a later Remove or pick. Where it goes once
// ready is chosen when the pick starts (tests/personal-info-step.test.tsx follows it into the CV).
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
  const delivered: string[] = [];
  const busy: boolean[] = [];
  const errors: (PhotoError | null)[] = [];
  const picker = photoPicker({
    load: loader.load,
    onBusy: (b) => busy.push(b),
    onError: (e) => errors.push(e),
  });
  const deliver = (p: string) => delivered.push(p);
  return { loader, picker, deliver, delivered, busy, errors };
}

const file = new File([new Uint8Array(10)], "me.jpg", { type: "image/jpeg" });

describe("photo picker", () => {
  it("delivers the loaded picture where the pick said", async () => {
    const { loader, picker, deliver, delivered, busy } = setup();
    const done = picker.take(file, deliver);
    loader.finish(0, { ok: true, dataUrl: "data:image/jpeg;base64,AAAA" });
    await done;
    expect(delivered).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(busy).toEqual([true, false]);
  });

  it("keeps a removed photo removed when the picture loading at that moment finishes later", async () => {
    const { loader, picker, deliver, delivered, busy } = setup();
    const done = picker.take(file, deliver);
    picker.cancel();
    loader.finish(0, { ok: true, dataUrl: "data:image/jpeg;base64,BBBB" });
    await done;
    expect(delivered).toEqual([]);
    expect(busy.at(-1)).toBe(false);
  });

  it("lets the newer pick win when an older one finishes after it", async () => {
    const { loader, picker, deliver, delivered } = setup();
    const first = picker.take(file, deliver);
    const second = picker.take(file, deliver);
    loader.finish(1, { ok: true, dataUrl: "data:image/jpeg;base64,NEW" });
    await second;
    loader.finish(0, { ok: true, dataUrl: "data:image/jpeg;base64,OLD" });
    await first;
    expect(delivered).toEqual(["data:image/jpeg;base64,NEW"]);
  });

  it("shows why a picture failed", async () => {
    const { loader, picker, deliver, delivered, errors, busy } = setup();
    const done = picker.take(file, deliver);
    loader.finish(0, { ok: false, error: "NOT_IMAGE" });
    await done;
    expect(delivered).toEqual([]);
    expect(errors).toEqual([null, "NOT_IMAGE"]);
    expect(busy).toEqual([true, false]);
  });
});
