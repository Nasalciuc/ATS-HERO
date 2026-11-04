"use client";
/**
 * Daily search (canvas "ATS Hero Tracker v2", page "Search & agent": Desktop · Daily search, Phone ·
 * Daily search): the strip over the tracker and the settings panel. Presentational: the page passes
 * the search, the CVs and the handlers.
 */
import { useState } from "react";
import type { JobSearchInput, MyJobSearch } from "@/app/actions/job-search";
import { BOARD_LABEL, countryOf, JOB_BOARDS, JOB_COUNTRIES, PER_DAY_CHOICES } from "@/lib/job-search";
import { shortDate } from "@/lib/tracker";
import type { JobBoard } from "@/lib/types";

type Outcome = { ok: true } | { ok: false; message: string };
export type RunOutcome = ({ ok: true; summary: { found: number; added: number; repeats: number; failed: string[] } }) | { ok: false; message: string };

const when = (at: number, now: number) => {
  const time = new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return new Date(at).toDateString() === new Date(now).toDateString() ? `today, ${time}` : `${shortDate(at)}, ${time}`;
};

const place = (s: Pick<MyJobSearch, "city" | "country" | "remoteOnly">) =>
  [s.city, countryOf(s.country)?.label].filter(Boolean).join(", ") + (s.remoteOnly ? " · remote" : "");

export interface SearchStripProps {
  search: MyJobSearch | null;
  /** jobs today's search added, and how many of them meet every required item */
  today: { added: number; allMet: number };
  onEdit: () => void;
}

/** Over the tracker: what the daily search does, or the way to start one. */
export function SearchStrip({ search, today, onEdit }: SearchStripProps) {
  return (
    <section className="trk-strip" aria-label="Daily search">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b45e0" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
      <p className="trk-strip__text">
        {!search ? (
          <><strong>Find new jobs every morning.</strong> A daily search puts the ones that fit your CV best in Saved.</>
        ) : !search.enabled ? (
          <><strong>Daily search is off:</strong> {search.searchTerm} · {place(search)}.</>
        ) : (
          <>
            <strong>Daily search:</strong> {search.searchTerm} · {place(search)} · up to {search.perDay} a day.
            {today.added > 0 && <> Today: {today.added} new{today.allMet > 0 ? `, ${today.allMet} meet every required item` : ""}.</>}
          </>
        )}
      </p>
      <button type="button" className="trk-link" onClick={onEdit}>{search ? "Edit" : "Set it up"}</button>
    </section>
  );
}

export interface SearchPanelProps {
  search: MyJobSearch | null;
  cvs: { id: string; title: string }[];
  now: number;
  onClose: () => void;
  onSave: (input: JobSearchInput) => Promise<Outcome>;
  onRunNow: (input: JobSearchInput) => Promise<RunOutcome>;
}

export default function SearchPanel({ search, cvs, now, onClose, onSave, onRunNow }: SearchPanelProps) {
  const [title, setTitle] = useState(search?.searchTerm ?? "");
  const [country, setCountry] = useState(search?.country ?? "romania");
  const [city, setCity] = useState(search?.city ?? "");
  const [remoteOnly, setRemoteOnly] = useState(search?.remoteOnly ?? false);
  const [perDay, setPerDay] = useState<number>(search?.perDay ?? 10);
  const [cvId, setCvId] = useState<string>(search?.cvId ?? "");
  const [boards, setBoards] = useState<JobBoard[]>(search?.boards ?? ["indeed", "linkedin"]);
  const [busy, setBusy] = useState<"save" | "run" | "off" | null>(null);
  const [said, setSaid] = useState<{ error: boolean; text: string } | null>(null);
  /** a search just ran from here: its result is said below, so the "Last search" box would repeat it */
  const [ran, setRan] = useState(false);

  const hasIndeed = Boolean(countryOf(country)?.indeed);
  const input = (enabled = search?.enabled ?? true): JobSearchInput => ({
    searchTerm: title, country, city: city || undefined, remoteOnly, perDay, cvId: cvId || null, enabled,
    boards: boards.filter((b) => b !== "indeed" || hasIndeed),
  });
  const toggle = (b: JobBoard) => setBoards((bs) => (bs.includes(b) ? bs.filter((x) => x !== b) : [...bs, b]));

  async function act(kind: "save" | "run" | "off") {
    setBusy(kind);
    setSaid(null);
    try {
      if (kind === "run") {
        // a search the person turned off stays off: this runs it once
        const r = await onRunNow(input());
        if (!r.ok) return setSaid({ error: true, text: r.message });
        setRan(true);
        const { found, added, failed } = r.summary;
        const out = found - added;
        setSaid({
          error: false,
          text: `Found ${found} · ${added} added to Saved${out > 0 ? ` · ${out} left out: already in your tracker, or they fit your CV less` : ""}.${failed.length ? ` ${failed.join(" and ")} didn’t answer.` : ""}`,
        });
      } else {
        const r = await onSave(input(kind === "off" ? false : true));
        setSaid(r.ok ? { error: false, text: kind === "off" ? "Daily search is off." : "Saved. The next search runs tomorrow morning." } : { error: true, text: r.message });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="trk-panel trk-search" aria-label="Daily search settings">
      <button type="button" className="trk-panel__back" onClick={onClose}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        Tracker
      </button>
      <div className="trk-panel__head">
        <div className="trk-panel__title">
          <h2 className="trk-panel__role">Daily search</h2>
          <p className="trk-search__lead">
            Each morning we look for jobs posted in the last day and add the ones that fit your CV best to Saved. You decide what to apply to.
          </p>
        </div>
        <button type="button" className="trk-round trk-panel__close" aria-label="Close" onClick={onClose}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
        </button>
      </div>

      <label className="trk-field">
        <span>Job title</span>
        <input type="text" value={title} maxLength={100} placeholder="Data Analyst" onChange={(e) => setTitle(e.target.value)} />
      </label>

      <div className="trk-search__pair">
        <label className="trk-field">
          <span>Country</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)}>
            {JOB_COUNTRIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="trk-field">
          <span>City <em>(optional)</em></span>
          <input type="text" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} />
        </label>
      </div>

      <label className="trk-check">
        <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote jobs only
      </label>

      <fieldset className="trk-search__set">
        <legend className="trk-label">New jobs a day, at most</legend>
        <div className="trk-search__seg">
          {PER_DAY_CHOICES.map((n) => (
            <label key={n} className={`trk-seg${perDay === n ? " is-on" : ""}`}>
              <input type="radio" name="trk-per-day" checked={perDay === n} onChange={() => setPerDay(n)} /> {n}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="trk-field">
        <span>Checked against</span>
        <select value={cvId} onChange={(e) => setCvId(e.target.value)}>
          <option value="">The CV you changed last</option>
          {cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.title}</option>)}
        </select>
      </label>

      <fieldset className="trk-search__set">
        <legend className="trk-label">Where we look</legend>
        {JOB_BOARDS.map((b) => {
          const off = b === "indeed" && !hasIndeed;
          return (
            <label key={b} className="trk-check">
              <input type="checkbox" checked={!off && boards.includes(b)} disabled={off} onChange={() => toggle(b)} />
              {BOARD_LABEL[b]}
              {b === "linkedin" && <span className="trk-muted"> · we only read the public job list</span>}
              {off && <span className="trk-muted"> · not in {countryOf(country)?.label}</span>}
            </label>
          );
        })}
        <p className="trk-search__note">The job title and the place go to these sites when we search. Your CV doesn’t.</p>
      </fieldset>

      {search?.lastRunAt != null && !ran && (
        <div className="trk-search__last">
          <span><strong>Last search:</strong> {when(search.lastRunAt, now)}</span>
          {search.lastError ? (
            <span className="trk-error">{search.lastError}</span>
          ) : (
            <span className="trk-muted">
              Found {search.lastFound ?? 0} · {search.lastAdded ?? 0} added to Saved
              {(search.lastFound ?? 0) > (search.lastAdded ?? 0) ? ` · ${(search.lastFound ?? 0) - (search.lastAdded ?? 0)} left out: already in your tracker, or they fit your CV less` : ""}
            </span>
          )}
        </div>
      )}

      {said && <p className={said.error ? "trk-error" : "trk-search__said"} role={said.error ? "alert" : "status"}>{said.text}</p>}

      <div className="trk-search__buttons">
        <button type="button" className="trk-btn" disabled={busy !== null} onClick={() => act("save")}>{busy === "save" ? "Saving…" : "Save"}</button>
        <button type="button" className="trk-btn trk-btn--ghost" disabled={busy !== null} onClick={() => act("run")}>{busy === "run" ? "Searching…" : "Search now"}</button>
        {search?.enabled && (
          <button type="button" className="trk-text-btn trk-text-btn--danger" disabled={busy !== null} onClick={() => act("off")}>Turn off</button>
        )}
      </div>
    </aside>
  );
}
