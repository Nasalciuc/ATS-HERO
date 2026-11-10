"use client";
/**
 * Tracker v2: "Add a job" (Claude Design canvas "ATS Hero Tracker v2", Desktop · First day and Add
 * job). A link that is already in the tracker is caught while it is typed (the same key the server
 * dedupes on, lib/job-url.ts), and the dialog offers the job that exists instead of a second one.
 * Drawn as the pop-ups are (a centred title, the ring that closes), with the builder's grey card
 * for the fields and the way on at the right (PROVISIONAL, AGENTS.md rule 6).
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";
import { ArrowUp } from "@/components/figma-icons";
import { jobUrlKey } from "@/lib/job-url";
import { MAX_DESCRIPTION_CHARS, STATUS_LABEL, shortDate, type TrackedJob } from "@/lib/tracker";

export interface NewJob {
  url: string;
  company: string;
  role: string;
  description: string;
  status: "saved" | "applied";
}

export interface AddJobDialogProps {
  open: boolean;
  jobs: TrackedJob[];
  onClose: () => void;
  /** makes the job (the page then shows it, or the one that already had this link) */
  onAdd: (job: NewJob) => Promise<unknown>;
  /** the link is already in the tracker: open that job instead */
  onOpenJob: (id: string) => void;
  /**
   * The Interview Trainer's "Add and practice" (IV-19): the job goes in as Saved, so the dialog
   * doesn't ask where it is, and it starts from what was pasted.
   */
  practice?: boolean;
  initial?: { url?: string; description?: string };
}

function existingLine(j: TrackedJob): string {
  if (j.archivedAt) return `archived ${shortDate(j.archivedAt)}`;
  if (j.status === "saved") return `saved ${shortDate(j.appliedAt)}`;
  const sent = j.submittedAt != null ? `sent ${shortDate(j.submittedAt)}` : "";
  if (j.status === "applied") return sent || "applied";
  return [STATUS_LABEL[j.status].toLowerCase(), sent].filter(Boolean).join(", ");
}

export default function AddJobDialog({ open, jobs, onClose, onAdd, onOpenJob, practice = false, initial }: AddJobDialogProps) {
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"saved" | "applied">("saved");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // what was pasted, each time the dialog opens
  const initialUrl = initial?.url ?? "";
  const initialDescription = initial?.description ?? "";
  useEffect(() => {
    if (!open || (!initialUrl && !initialDescription)) return;
    setUrl(initialUrl);
    setDescription(initialDescription);
  }, [open, initialUrl, initialDescription]);

  const existing = useMemo(() => {
    const key = jobUrlKey(url.trim());
    return key ? jobs.find((j) => jobUrlKey(j.url) === key) ?? null : null;
  }, [url, jobs]);

  function reset() {
    setUrl(""); setCompany(""); setRole(""); setDescription(""); setStatus("saved"); setError(null);
  }
  function close() { reset(); onClose(); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (existing) { reset(); onOpenJob(existing.id); return; }
    setBusy(true);
    setError(null);
    try {
      await onAdd({ url: url.trim(), company: company.trim(), role: role.trim(), description, status: practice ? "saved" : status });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the job. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} overlayClassName="trk-modal" panelClassName="trk-dialog">
      <form className="trk-dialog__form" onSubmit={submit}>
        <h2 className="trk-dialog__title">{practice ? "Add a job to practice for" : "Add a job"}</h2>

        <div className="trk-fcard">
        <label className="trk-field">
          <span>Job link</span>
          <input type="url" inputMode="url" placeholder="https://" maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} />
        </label>

        {existing && (
          <p className="trk-note" role="status">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M11 12h1v4h1" /></svg>
            <span>
              This job is already in your tracker: <strong>{existing.role} at {existing.company}</strong>, {existingLine(existing)}.{" "}
              <button type="button" className="trk-link trk-link--inline" onClick={() => { reset(); onOpenJob(existing.id); }}>{practice ? "Practice for it" : "Open it"}</button>
            </span>
          </p>
        )}

        {!existing && (
          <>
            <div className="trk-dialog__pair">
              <label className="trk-field">
                <span>Company</span>
                <input required maxLength={120} placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label className="trk-field">
                <span>Role</span>
                <input required maxLength={120} placeholder="Role" value={role} onChange={(e) => setRole(e.target.value)} />
              </label>
            </div>

            <label className="trk-field">
              <span>The post’s text <em>{practice ? "optional · the questions ask about what it asks for" : "optional · we check what it asks for against your CV"}</em></span>
              <textarea rows={5} maxLength={MAX_DESCRIPTION_CHARS} placeholder="Paste the job description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>

            {practice ? (
              <p className="trk-panel__note">We add it to your Tracker as Saved.</p>
            ) : (
              <fieldset className="trk-choice">
                <legend>Where is it?</legend>
                <div className="trk-choice__row">
                  <label className={`trk-radio${status === "saved" ? " is-on" : ""}`}>
                    <input type="radio" name="trk-where" checked={status === "saved"} onChange={() => setStatus("saved")} /> Saved, not sent yet
                  </label>
                  <label className={`trk-radio${status === "applied" ? " is-on" : ""}`}>
                    <input type="radio" name="trk-where" checked={status === "applied"} onChange={() => setStatus("applied")} /> I already applied
                  </label>
                </div>
              </fieldset>
            )}
          </>
        )}
        </div>

        {error && <p className="trk-error" role="alert">{error}</p>}

        <div className="trk-dialog__buttons">
          <button type="button" className="topbtn topbtn--ghost" onClick={close}>Cancel</button>
          <button type="submit" className="topbtn topbtn--dark" disabled={busy}>
            {existing ? (practice ? "Practice for it" : "Open the job") : busy ? "Adding…" : practice ? "Add and practice" : "Add job"}
            <ArrowUp className="topbtn__arrow--right" />
          </button>
        </div>
      </form>
    </Modal>
  );
}
