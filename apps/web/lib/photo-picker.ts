import type { PhotoError } from "./photo";

type PhotoResult = { ok: true; dataUrl: string } | { ok: false; error: PhotoError };

/**
 * The async part of Personal info → Photo, kept out of React so it can be tested.
 *
 * Turning a picture into the small CV copy takes a moment. Remove (`cancel`) drops a picture still
 * loading, so it never comes back after Remove, and a newer pick wins over an older one that
 * finishes later. Leaving the step drops nothing: `deliver` is chosen when the pick starts
 * (PersonalInfoStep binds it to the CV open at that moment).
 */
export function photoPicker(opts: {
  load: (file: File) => Promise<PhotoResult>;
  onBusy: (busy: boolean) => void;
  onError: (error: PhotoError | null) => void;
}) {
  let current = 0; // the pick that may still deliver; cancel() and newer picks move it on

  return {
    async take(file: File, deliver: (photo: string) => void) {
      const mine = ++current;
      opts.onError(null);
      opts.onBusy(true);
      const res = await opts.load(file);
      if (mine !== current) return; // removed or replaced while it loaded
      opts.onBusy(false);
      if (res.ok) deliver(res.dataUrl);
      else opts.onError(res.error);
    },
    /** Remove: a picture still loading is dropped. */
    cancel() {
      current++;
      opts.onBusy(false);
      opts.onError(null);
    },
  };
}
