import type { PhotoError } from "./photo";

type PhotoResult = { ok: true; dataUrl: string } | { ok: false; error: PhotoError };

/**
 * The async part of Personal info → Photo, kept out of React so it can be tested.
 *
 * Turning a picture into the small CV copy takes a moment. If the user clicks Remove (or leaves the
 * step) before it is ready, that picture is dropped: it never comes back after Remove. A newer
 * pick also wins over an older one that finishes later.
 */
export function photoPicker(opts: {
  load: (file: File) => Promise<PhotoResult>;
  onChange: (photo: string) => void;
  onBusy: (busy: boolean) => void;
  onError: (error: PhotoError | null) => void;
}) {
  let current = 0; // the pick that may still apply its result; Remove and dispose() move it on

  return {
    async take(file: File) {
      const mine = ++current;
      opts.onError(null);
      opts.onBusy(true);
      const res = await opts.load(file);
      if (mine !== current) return; // removed, replaced or left while it loaded
      opts.onBusy(false);
      if (res.ok) opts.onChange(res.dataUrl);
      else opts.onError(res.error);
    },
    remove() {
      current++;
      opts.onBusy(false);
      opts.onError(null);
      opts.onChange("");
    },
    /** The field is gone (the user left the step): a picture still loading is dropped. */
    dispose() {
      current++;
    },
  };
}
