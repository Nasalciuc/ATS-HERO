"use client";
// Dashboard — the "/app" index. Lists the current user's (or guest's) saved CVs reactively via
// useCvs(). Works for both: a guest sees their on-device CVs; after sign-in + claim, the same CVs
// appear owned. Open routes into the builder; delete is reactive (the list updates itself).
//
// TODO(integration): the installed @clerk/nextjs@7.5.8 does NOT export <SignedIn>/<SignedOut>
// (they were removed in favour of <Show>), and <UserButton> no longer accepts `afterSignOutUrl`.
// To stay faithful to the package's UI we gate on Clerk's useUser() instead of the control
// components, and drop the prop. Everything else is the package's page as-is.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import SignInModal from "@/components/modals/SignInModal";
import { useCvs } from "@/hooks/use-cvs";
import { useApp } from "@/store/AppContext";
import { api } from "@/lib/api";
import type { Doc } from "@/convex/_generated/dataModel";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const cvs = useCvs(); // undefined while loading, then Doc<"cvs">[]
  const { openCv, reset } = useApp();
  const { isSignedIn } = useUser();
  const router = useRouter();
  const [signInOpen, setSignInOpen] = useState(false);

  function newCv() {
    reset();
    router.push("/app/create");
  }
  async function open(id: string) {
    await openCv(id);
    router.push("/app/create");
  }
  async function remove(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this CV?")) return;
    await api.deleteCv(id); // reactive: useCvs() refreshes automatically
  }

  return (
    <main className="dash">
      <div className="container dash__inner">
        <div className="dash__topbar">
          <a href="/" className="dash__logo">ATS Hero</a>
          {isSignedIn ? (
            <UserButton />
          ) : (
            <button type="button" className="btn btn--outline-dark dash__signin" onClick={() => setSignInOpen(true)}>
              Sign in
            </button>
          )}
        </div>

        <header className="dash__head">
          <div>
            <h1 className="dash__title">Your CVs</h1>
            <p className="dash__subtitle">Build, score and tailor your resumes.</p>
          </div>
          <button className="btn btn--dark dash__new" onClick={newCv}>
            + New CV
          </button>
        </header>

        {!isSignedIn && (
          <div className="dash__banner">
            You&apos;re working as a guest — your CVs are saved on this device.{" "}
            <button type="button" className="dash__banner-link" onClick={() => setSignInOpen(true)}>
              Sign in
            </button>{" "}
            to keep them across devices.
          </div>
        )}

        {cvs === undefined ? (
          <div className="dash__loading">Loading…</div>
        ) : cvs.length === 0 ? (
          <div className="dash__empty">
            <p>No CVs yet.</p>
            <button className="btn btn--dark" onClick={newCv}>
              Create your first CV
            </button>
          </div>
        ) : (
          <ul className="dash__grid">
            {cvs.map((cv: Doc<"cvs">) => (
              <li key={cv._id} className="dash-card">
                <button onClick={() => open(cv._id)} className="dash-card__body">
                  <h3 className="dash-card__title">{cv.title || "Untitled"}</h3>
                  <p className="dash-card__date">Updated {formatDate(cv.updatedAt)}</p>
                  <p className="dash-card__meta">
                    {cv.data?.summary?.position || cv.data?.personalInfo?.name || "Empty resume"}
                  </p>
                </button>
                <div className="dash-card__foot">
                  <button onClick={() => open(cv._id)} className="dash-card__open">
                    Open →
                  </button>
                  <button onClick={() => remove(cv._id)} className="dash-card__delete">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </main>
  );
}
