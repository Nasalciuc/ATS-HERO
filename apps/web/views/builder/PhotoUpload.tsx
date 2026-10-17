"use client";
import { useEffect, useId, useRef, useState } from "react";
import { UploadRounded } from "../../components/figma-icons";
import { photoFromFile, PHOTO_MSG, type PhotoError } from "../../lib/photo";
import { photoPicker } from "../../lib/photo-picker";
import { droppedFile, isFileDrag } from "../../lib/cv-file";

/**
 * Personal info → Photo (optional). Figma draws only the "Upload" button; it used to do nothing.
 * It now takes a picture (button or drop), keeps a small square copy in the CV (lib/photo.ts) and
 * shows it beside the button, which then reads "Change", with "Remove" after it. The Classic and
 * Modern templates print the photo; Minimal never does.
 *
 * People with a CV file look for "upload" here: a PDF or Word file gets a pointer to Improve My
 * Resume instead of a silent failure.
 */
export function PhotoUpload({ value, onChange }: { value: string; onChange: (photo: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<PhotoError | null>(null);

  // A picture still loading when the user clicks Remove, picks another or leaves the step is
  // dropped (lib/photo-picker.ts). onChange is read through a ref: the picker outlives renders.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const [picker] = useState(() =>
    photoPicker({
      load: photoFromFile,
      onChange: (photo) => onChangeRef.current(photo),
      onBusy: setBusy,
      onError: setError,
    }),
  );
  useEffect(() => () => picker.dispose(), [picker]);
  const take = (file: File) => picker.take(file);

  return (
    <div className="field field--photo field--photo-gap">
      <span className="field__label" data-figma="photo-label" id={labelId}>
        PHOTO (OPTIONAL)
      </span>
      <div className="photo-row">
        {value && <img className="photo-thumb" src={value} alt="Your CV photo" width={37} height={37} />}
        <button
          type="button"
          className={`field__upload${over ? " is-over" : ""}`}
          data-figma="upload"
          aria-describedby={labelId}
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            const file = droppedFile(e);
            if (!file) return;
            e.preventDefault();
            setOver(false);
            void take(file);
          }}
        >
          {/* Figma flattened material-symbols:upload-rounded to a bare 16×15 vector: crop to the glyph */}
          <UploadRounded width={16} height={15} viewBox="4 4.425 16 15.575" preserveAspectRatio="none" />{" "}
          {busy ? "Loading…" : value ? "Change" : "Upload"}
          <span className="sr-only"> photo</span>
        </button>
        {value && (
          <button type="button" className="photo-remove" onClick={() => picker.remove()}>
            Remove<span className="sr-only"> photo</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // so picking the same picture again still counts
          if (file) void take(file);
        }}
      />
      {error && (
        <p className="field__error" role="alert">
          {PHOTO_MSG[error]}
          {error === "CV_FILE" && (
            <>
              {" "}
              <a href="/app/improve">Check your CV in Improve My Resume</a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
