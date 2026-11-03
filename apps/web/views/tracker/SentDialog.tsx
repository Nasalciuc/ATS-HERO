"use client";
/**
 * Tracker v2: "What did you send?" (Claude Design canvas "ATS Hero Tracker v2", Phone · Job card).
 * A sheet from the bottom on a phone, a dialog on a computer. Asked when a job moves to Applied;
 * "Skip for now" leaves it unmarked, and the job's card asks again.
 */
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { shortDate } from "@/lib/tracker";

export interface SentCv {
  id: string;
  title: string;
  updatedAt: number;
}

export interface SentDialogProps {
  open: boolean;
  job: { role: string; company: string; cvId: string | null } | null;
  /** true when the dialog opened because the job just moved to Applied */
  justApplied: boolean;
  cvs: SentCv[];
  onClose: () => void;
  onSave: (choice: { cvId: string } | { other: true }) => Promise<unknown>;
}

export default function SentDialog({ open, job, justApplied, cvs, onClose, onSave }: SentDialogProps) {
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picked = choice ?? job?.cvId ?? null;

  function close() { setChoice(null); onClose(); }

  async function save() {
    if (!picked) return;
    setBusy(true);
    try {
      await onSave(picked === "other" ? { other: true } : { cvId: picked });
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open && job !== null} onClose={close} overlayClassName="trk-modal trk-modal--sheet" panelClassName="trk-dialog trk-sheet">
      <div className="trk-sheet__grip" aria-hidden="true" />
      <h2 className="trk-dialog__title">What did you send?</h2>
      {job && (
        <p className="trk-dialog__lead">
          {justApplied ? `You moved ${job.role} at ${job.company} to Applied. ` : `${job.role} at ${job.company}. `}
          Which CV went with it? It stays on the job’s card.
        </p>
      )}
      <fieldset className="trk-cvs">
        <legend className="trk-sr">The CV you sent</legend>
        {cvs.map((cv) => (
          <label key={cv.id} className={`trk-cv${picked === cv.id ? " is-on" : ""}`}>
            <input type="radio" name="trk-cv" checked={picked === cv.id} onChange={() => setChoice(cv.id)} />
            <span className="trk-cv__text"><strong>{cv.title}</strong><span>Saved in ATS Hero · {shortDate(cv.updatedAt)}</span></span>
          </label>
        ))}
        <label className={`trk-cv${picked === "other" ? " is-on" : ""}`}>
          <input type="radio" name="trk-cv" checked={picked === "other"} onChange={() => setChoice("other")} />
          <span className="trk-cv__text"><strong>Another file</strong><span>One I made somewhere else</span></span>
        </label>
      </fieldset>
      <button type="button" className="trk-btn trk-btn--wide" disabled={!picked || busy} onClick={save}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button type="button" className="trk-text-btn trk-text-btn--center" onClick={close}>Skip for now</button>
    </Modal>
  );
}
