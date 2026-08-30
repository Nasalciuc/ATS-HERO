"use client";
import { useState, type FormEvent } from "react";
import AppShell from "@/components/app/AppShell";
import { useApp } from "@/store/AppContext";
import { useApplications, useApplicationMutations } from "@/hooks/use-applications";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function TrackerPage() {
  const { user } = useApp();
  const rows = useApplications();
  const { create, updateStatus, remove } = useApplicationMutations();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await create({ company, role, url, notes });
      setCompany("");
      setRole("");
      setUrl("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add application");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Tracker" active="tracker">
      {!user ? (
        <div className="dash__banner">
          Sign in to keep a list of the jobs you applied to. The tracker is saved to your account.
        </div>
      ) : (
        <>
          <form className="tracker__form" onSubmit={onAdd}>
            <label className="tracker__field">
              <span>Company</span>
              <input value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={120} />
            </label>
            <label className="tracker__field">
              <span>Role</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} required maxLength={120} />
            </label>
            <label className="tracker__field">
              <span>Job URL</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" placeholder="https://" maxLength={500} />
            </label>
            <label className="tracker__field tracker__field--wide">
              <span>Notes</span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} />
            </label>
            <button className="btn btn--dark" type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add application"}
            </button>
          </form>
          {error && <p className="tracker__error">{error}</p>}

          {rows === undefined ? (
            <div className="dash__loading">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="dash__empty">
              <p>No applications yet. Add the first role you applied to.</p>
            </div>
          ) : (
            <div className="tracker__table-wrap">
              <table className="tracker__table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Applied</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        {row.url ? (
                          <a href={row.url} target="_blank" rel="noreferrer">{row.company}</a>
                        ) : (
                          row.company
                        )}
                      </td>
                      <td>{row.role}</td>
                      <td>
                        <select
                          className="tracker__status"
                          value={row.status}
                          aria-label={`Status for ${row.role} at ${row.company}`}
                          onChange={(e) => updateStatus(row.id, e.target.value as ApplicationStatus)}
                        >
                          {APPLICATION_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="tracker__notes">{row.notes || "—"}</td>
                      <td>{formatDate(row.appliedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="dash-card__delete"
                          onClick={() => {
                            if (typeof window !== "undefined" && !window.confirm("Remove this application?")) return;
                            void remove(row.id);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
