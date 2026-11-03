"use client";
/**
 * Tracker v2 (TRACKER-V2-DESIGN.md, Claude Design canvas "ATS Hero Tracker v2" approved by Scaler
 * on 3 Nov 2026): the board, a job's card, "Add a job" and "What did you send?". This file holds
 * the data and the handlers; views/tracker/ draws them.
 */
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app/AppShell";
import Modal from "@/components/ui/Modal";
import { DownloadArrow } from "@/components/icons";
import { useApp } from "@/store/AppContext";
import { useCvs } from "@/hooks/use-cvs";
import { useApplicationEvents, useApplicationMutations, useApplications } from "@/hooks/use-applications";
import { cvToText, type ApplicationStatus } from "@/lib/types";
import { jobFit, type JobFitReport } from "@/lib/job-fit";
import { trackerCsv, type TrackedJob } from "@/lib/tracker";
import type { FollowUpAnswer } from "@/app/actions/applications";
import TrackerBoard, { PlusBold, type Fit } from "@/views/tracker/TrackerBoard";
import JobPanel from "@/views/tracker/JobPanel";
import AddJobDialog from "@/views/tracker/AddJobDialog";
import SentDialog from "@/views/tracker/SentDialog";

function downloadCsv(jobs: TrackedJob[]) {
  const blob = new Blob([trackerCsv(jobs)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ats-hero-tracker.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

export default function TrackerPage() {
  const { user } = useApp();
  const { jobs, error, retry } = useApplications();
  const m = useApplicationMutations();
  const cvs = useCvs();
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // reopen: the job's card was open; it closes while the dialog asks (one dialog at a time) and comes back
  const [askCv, setAskCv] = useState<{ id: string; justApplied: boolean; reopen: boolean } | null>(null);
  // "Did you hear back?" comes due while the page is open too
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const [failed, setFailed] = useState<string | null>(null);
  const events = useApplicationEvents(openId);

  const list: TrackedJob[] = useMemo(() => jobs ?? [], [jobs]);
  const cvList = useMemo(() => cvs ?? [], [cvs]);

  // Job Fit per job: the post's text against the CV that was sent; when that isn't one of the
  // person's CVs (not marked, another file, deleted), against the latest one, and the card says so.
  const { reports, against } = useMemo(() => {
    const reports: Record<string, JobFitReport | undefined> = {};
    const against: Record<string, string | undefined> = {};
    for (const j of list) {
      const sent = cvList.find((c) => c.id === j.cvId);
      const cv = sent ?? cvList[0];
      if (!cv || !j.description) continue;
      reports[j.id] = jobFit(cvToText(cv.data), j.description);
      against[j.id] = sent ? `the CV you sent, ${cv.title}` : `your latest CV, ${cv.title}`;
    }
    return { reports, against };
  }, [list, cvList]);
  const fit = useMemo(() => {
    const out: Record<string, Fit | undefined> = {};
    for (const [id, r] of Object.entries(reports)) if (r) out[id] = r.required;
    return out;
  }, [reports]);

  const open = list.find((j) => j.id === openId) ?? null;
  const asked = list.find((j) => j.id === askCv?.id) ?? null;
  const cvTitle = (j: TrackedJob) =>
    j.cvId === "other" ? "Another file" : j.cvId ? cvList.find((c) => c.id === j.cvId)?.title ?? "A CV you deleted" : null;

  /** Runs a change; a failure shows above the board instead of vanishing. */
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setFailed(null);
    try {
      return await fn();
    } catch (err) {
      setFailed(err instanceof Error ? err.message : "That didn’t save. Try again.");
      return undefined;
    }
  };

  /** The same, for a dialog that stays open until its change is saved. */
  const save = async (fn: () => Promise<unknown>) => (await run(async () => { await fn(); return true; })) === true;

  function askWhichCv(id: string, justApplied: boolean) {
    const reopen = openId === id;
    if (reopen) setOpenId(null);
    setAskCv({ id, justApplied, reopen });
  }

  async function changeStatus(id: string, status: ApplicationStatus) {
    const before = list.find((j) => j.id === id);
    const done = await run(() => m.updateStatus(id, status));
    if (done && status === "applied" && before && !before.cvId && cvList.length > 0) askWhichCv(id, true);
  }

  const signedIn = Boolean(user);

  return (
    <AppShell
      title="Tracker"
      active="tracker"
      actions={
        signedIn && list.length > 0 ? (
          <>
            <button type="button" className="topbtn topbtn--ghost topbtn--no-phone" onClick={() => downloadCsv(list)}>
              <DownloadArrow size={18} aria-hidden="true" /> <span className="topbtn__label">Export CSV</span>
            </button>
            <button type="button" className="topbtn topbtn--dark trk-add" onClick={() => setAdding(true)}>
              <PlusBold /> <span className="topbtn__label">Add job</span>
            </button>
          </>
        ) : undefined
      }
    >
      {!signedIn ? (
        <div className="dash__banner">
          Sign in to keep a list of the jobs you want and the ones you applied to. The tracker is saved to your account.
        </div>
      ) : error && jobs === undefined ? (
        <div className="trk-fail" role="alert">
          <p>We couldn’t load your tracker. Your jobs are still saved.</p>
          <button type="button" className="trk-btn trk-btn--ghost" onClick={retry}>Try again</button>
        </div>
      ) : jobs === undefined ? (
        <div className="dash__loading">Loading…</div>
      ) : (
        <>
          {failed && <p className="trk-error" role="alert">{failed}</p>}
          <TrackerBoard
            jobs={list}
            now={now}
            fit={fit}
            onOpen={setOpenId}
            onAdd={() => setAdding(true)}
            onStatus={changeStatus}
            onFollowUp={(id, answer: FollowUpAnswer) => void run(() => m.followUp(id, answer))}
          />
        </>
      )}

      <AddJobDialog
        open={adding}
        jobs={list}
        onClose={() => setAdding(false)}
        onAdd={async (j) => {
          const made = await m.create({ url: j.url, company: j.company, role: j.role, description: j.description, status: j.status });
          setAdding(false);
          if (made.duplicate) setOpenId(made.id);
          else if (j.status === "applied" && cvList.length > 0) setAskCv({ id: made.id, justApplied: false, reopen: false });
          return made;
        }}
        onOpenJob={(id) => { setAdding(false); setOpenId(id); }}
      />

      <Modal open={open !== null} variant="side" onClose={() => setOpenId(null)} overlayClassName="trk-drawer" panelClassName="trk-drawer__panel">
        {open && (
          <JobPanel
            job={open}
            fit={reports[open.id] ?? null}
            fitAgainst={against[open.id] ?? null}
            cvSentTitle={cvTitle(open)}
            hasCv={cvList.length > 0}
            events={events}
            onClose={() => setOpenId(null)}
            onStatus={(s) => void changeStatus(open.id, s)}
            onSaveDetails={(patch) => save(() => m.updateDetails(open.id, patch))}
            onAskCv={() => askWhichCv(open.id, false)}
            onArchive={() => { void run(() => m.archive(open.id)); setOpenId(null); }}
            onUnarchive={() => void run(() => m.unarchive(open.id))}
            onDelete={() => {
              if (!window.confirm(`Delete ${open.role} at ${open.company} and its history?`)) return;
              const id = open.id;
              setOpenId(null);
              void run(() => m.remove(id));
            }}
          />
        )}
      </Modal>

      <SentDialog
        open={asked !== null}
        job={asked}
        justApplied={askCv?.justApplied ?? false}
        cvs={cvList}
        onClose={() => {
          if (askCv?.reopen) setOpenId(askCv.id);
          setAskCv(null);
        }}
        onSave={(choice) => save(() => m.setCvSent(asked!.id, choice))}
      />
    </AppShell>
  );
}
