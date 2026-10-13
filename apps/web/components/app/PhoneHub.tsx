"use client";
// Phone home screen (Figma mobile page 17:1152, frame 55:322 "ATS-Inspector"), in the desktop
// style: the app name, a sign-in card (the desktop sidebar's hint), the three actions of the
// desktop menu, and "My Resumes" as a row of cards. Rendered by /app under 721px; the desktop
// dashboard is hidden there (styles.css, PHONE block).
import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { scoreCv } from "@/lib/analyzer/ats-scorer";
import { downloadCvPdf } from "@/lib/exportPdf";
import { useBuilderStore } from "@/stores/cv-builder-store";
import { ChevronUp, EditLine, TrashOutline, UserOutline } from "../figma-icons";
import { FeedbackLink } from "./FeedbackLink";
import type { CvData } from "@/lib/types";

type CvRow = {
  id: string;
  title?: string | null;
  updatedAt: number;
  data?: CvData | null;
  /** latest saved scan first */
  scans?: { generalScore: number }[];
};

const ACTIONS = [
  { key: "create", emoji: "📝", title: "Create ATS Resume", text: "Step by step, ATS-checked" },
  { key: "improve", emoji: "🛠️", title: "Improve My Resume", text: "See what an ATS reads", href: "/app/improve" },
  { key: "jobfit", emoji: "🎯", title: "Check Job Fit", text: "Match your CV to a job", href: "/app/jobfit" },
] as const;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function PhoneHub({
  cvs,
  signedIn,
  account,
  onSignIn,
  onNew,
  onOpen,
  onDelete,
}: {
  cvs: CvRow[] | undefined;
  signedIn: boolean;
  /** the signed-in user's account button (Clerk's UserButton) */
  account?: ReactNode;
  onSignIn: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const templateId = useBuilderStore((s) => s.templateId);
  const accent = useBuilderStore((s) => s.accent);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  // the last saved scan's score, else the same Tier-1 score the Score page computes on the device
  const scores = useMemo(
    () =>
      new Map(
        (cvs ?? []).map((cv) => {
          const saved = cv.scans?.[0]?.generalScore;
          return [cv.id, saved ?? (cv.data ? scoreCv(cv.data).generalScore : null)] as const;
        }),
      ),
    [cvs],
  );

  const download = async (cv: CvRow) => {
    if (!cv.data) return;
    setBusy(cv.id);
    try {
      await downloadCvPdf(cv.data, templateId, accent);
    } catch (err) {
      console.error(err);
      window.alert("The PDF couldn’t be created. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="hub" data-figma="hub">
      <div className="hub__top">
        <h1 className="hub__title" data-figma="hub-title">ATS Hero</h1>
        {signedIn ? (
          <span className="hub__account">{account}</span>
        ) : (
          <button type="button" className="hub__account hub__account--btn" data-figma="hub-account" aria-label="Sign in" onClick={onSignIn}>
            <UserOutline width={18} height={18} />
          </button>
        )}
      </div>

      {!signedIn && (
        <div className="hub__banner" data-figma="hub-banner">
          <p>Sign in to save your progress and continue editing anytime</p>
          <button type="button" className="hub__signin" onClick={onSignIn}>
            <UserOutline width={15.43} height={18} viewBox="128 64 768 896" /> Sign in
          </button>
        </div>
      )}

      <nav className="hub__actions" aria-label="What do you want to do?">
        {ACTIONS.map((a, i) => {
          const body = (
            <>
              <span className="hub-act__icon" aria-hidden="true">{a.emoji}</span>
              <span className="hub-act__txt">
                <b>{a.title}</b>
                <span>{a.text}</span>
                <em>
                  Start <ChevronUp width={16} height={16} className="hub-act__chev" />
                </em>
              </span>
            </>
          );
          return "href" in a ? (
            <Link key={a.key} href={a.href} className="hub-act" data-figma={`hub-act-${i}`}>
              {body}
            </Link>
          ) : (
            <button key={a.key} type="button" className="hub-act" data-figma={`hub-act-${i}`} onClick={onNew}>
              {body}
            </button>
          );
        })}
        {signedIn && (
          <Link href="/app/tracker" className="hub__tracker">
            Application tracker →
          </Link>
        )}
      </nav>

      <section className="hub__history" aria-labelledby="hub-history-title">
        <div className="hub__history-head">
          <h2 id="hub-history-title" data-figma="hub-history-title">My Resumes</h2>
          {(cvs?.length ?? 0) > 1 && (
            <button type="button" className="hub__see-all" aria-expanded={all} onClick={() => setAll((v) => !v)}>
              {all ? "Show less" : "See all"}
            </button>
          )}
        </div>
        {cvs === undefined ? (
          <p className="hub__empty">Loading…</p>
        ) : cvs.length === 0 ? (
          <p className="hub__empty">No CVs yet. Start with “Create ATS Resume”.</p>
        ) : (
          <ul className={`hub__cvs${all ? " is-all" : ""}`}>
            {cvs.map((cv, i) => {
              const title = cv.title || cv.data?.summary?.position || cv.data?.personalInfo?.name || "Untitled";
              const score = scores.get(cv.id);
              return (
                <li key={cv.id} className="hub-cv" data-figma={`hub-cv-${i}`}>
                  <button type="button" className="hub-cv__title" onClick={() => onOpen(cv.id)}>
                    {title}
                  </button>
                  <span className="hub-cv__score">
                    ATS score{" "}
                    <strong className={score == null || score >= 80 ? undefined : score >= 50 ? "is-fair" : "is-poor"}>
                      {score == null ? "—" : Math.round(score)}
                    </strong>
                    /100
                  </span>
                  <span className="hub-cv__date">Updated {formatDate(cv.updatedAt)}</span>
                  <button type="button" className="hub-cv__pdf" disabled={busy !== null || !cv.data} onClick={() => void download(cv)}>
                    {busy === cv.id ? "Preparing…" : "Download PDF"}
                  </button>
                  <span className="hub-cv__tools">
                    <button type="button" aria-label={`Edit ${title}`} onClick={() => onOpen(cv.id)}>
                      <EditLine />
                    </button>
                    <button type="button" aria-label={`Delete ${title}`} onClick={() => onDelete(cv.id)}>
                      <TrashOutline width={20} height={20} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="hub__foot">
        <FeedbackLink />
      </div>
    </div>
  );
}
