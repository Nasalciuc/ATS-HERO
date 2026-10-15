/**
 * The CV photo (Personal info → Photo): made in the browser from the picture the user picks.
 * Square, 320 px, JPEG: about 20–40 KB in the CV, enough for the 88 pt the templates draw it at.
 * The original file is never sent anywhere; only this small copy is saved with the CV.
 */
export const PHOTO_PX = 320;
/** The saved photo is a JPEG data URL and nothing else: no links to other sites, no other formats. */
export const PHOTO_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
export const MAX_PHOTO_CHARS = 200_000;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export type PhotoError = "CV_FILE" | "NOT_IMAGE" | "TOO_LARGE" | "UNREADABLE";

export const PHOTO_MSG: Record<PhotoError, string> = {
  CV_FILE: "This button adds a photo of you, not your CV.",
  NOT_IMAGE: "Pick a photo: JPG, PNG or WebP.",
  TOO_LARGE: "This picture is over 20 MB.",
  UNREADABLE: "We couldn’t open this picture. Try a JPG or PNG.",
};

/** A CV the user picked by mistake: the photo button sits where people look for "upload my CV". */
const CV_FILE = /\.(pdf|docx?|odt|rtf|txt|md|pages)$/i;

export function photoError(file: File): PhotoError | null {
  if (CV_FILE.test(file.name) || /pdf|word|officedocument|text\//.test(file.type)) return "CV_FILE";
  if (!file.type.startsWith("image/")) return "NOT_IMAGE";
  if (file.size > MAX_INPUT_BYTES) return "TOO_LARGE";
  return null;
}

/**
 * The square crop: the whole width of a portrait picture, a little above its middle (faces sit in
 * the upper half), or the middle of a landscape one.
 */
export function squareCrop(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return {
    side,
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) * (height > width ? 0.3 : 0.5)),
  };
}

export async function photoFromFile(file: File): Promise<{ ok: true; dataUrl: string } | { ok: false; error: PhotoError }> {
  const error = photoError(file);
  if (error) return { ok: false, error };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file); // turned upright from the camera's EXIF orientation
  } catch {
    return { ok: false, error: "UNREADABLE" };
  }
  try {
    const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = PHOTO_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, error: "UNREADABLE" };
    ctx.fillStyle = "#ffffff"; // a transparent PNG gets white, not black, behind it
    ctx.fillRect(0, 0, PHOTO_PX, PHOTO_PX);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return PHOTO_DATA_URL.test(dataUrl) && dataUrl.length <= MAX_PHOTO_CHARS
      ? { ok: true, dataUrl }
      : { ok: false, error: "UNREADABLE" };
  } finally {
    bitmap.close();
  }
}
