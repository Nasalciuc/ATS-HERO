"use client";
/**
 * "Which CV gets answers" (canvas "ATS Hero Tracker v2", page "Search & agent", Desktop · Which CV
 * gets answers). Counts from resultsByCv(): applications sent 21 or more days ago, per CV; "x of y",
 * no percentages; a comparison only from MIN_SENT_TO_COMPARE sent. Drawn as the score page's rows
 * (a circle, a bold name, the counts under one line each); it stays a table for screen readers.
 */
import { ANSWER_WAIT_DAYS, MIN_SENT_TO_COMPARE, type CvResults as Results } from "@/lib/tracker";

export interface CvResultsProps {
  results: Results;
  /** a CV's title and what it is, by id ("other": a file made somewhere else) */
  cvLabel: (cvId: string) => { title: string; kind: string };
  /** opens the first sent job with no CV marked */
  onMark: () => void;
}

export default function CvResults({ results, cvLabel, onMark }: CvResultsProps) {
  if (results.rows.length === 0 && results.unmarked === 0) return null;
  return (
    <section className="trk-bycv" aria-labelledby="trk-bycv-title">
      <div className="trk-bycv__head">
        <h2 id="trk-bycv-title" className="trk-bycv__title">Which CV gets answers</h2>
        <span className="trk-bycv__sub">Applications sent {ANSWER_WAIT_DAYS} or more days ago · newer ones have had no time to be answered</span>
      </div>

      {results.rows.length > 0 ? (
        <div className="trk-bycv__scroll">
          <table className="trk-bycv__table">
            <thead>
              <tr>
                <th scope="col">CV you sent</th>
                <th scope="col">Sent</th>
                <th scope="col">Answered</th>
                <th scope="col">Interviews</th>
                <th scope="col"><span className="trk-sr">Note</span></th>
              </tr>
            </thead>
            <tbody>
              {results.rows.map((r) => {
                const cv = cvLabel(r.cvId);
                return (
                  <tr key={r.cvId}>
                    <th scope="row">
                      <span className="trk-bycv__cv">
                        <span className="trk-bycv__icon" aria-hidden="true">📄</span>
                        <span className="trk-bycv__name">
                          {cv.title}
                          <span className="trk-bycv__kind">{cv.kind}</span>
                          {r.tooFew && <span className="trk-bycv__few">Too few to compare</span>}
                        </span>
                      </span>
                    </th>
                    <td>{r.sent}</td>
                    <td><strong>{r.answered}</strong> <span className="trk-muted">of {r.sent}</span></td>
                    <td><strong>{r.interviews}</strong> <span className="trk-muted">of {r.sent}</span></td>
                    <td className="trk-bycv__note">{r.tooFew ? "Too few to compare" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="trk-bycv__empty">Nothing to count yet: no application with a CV marked was sent {ANSWER_WAIT_DAYS} or more days ago.</p>
      )}

      {results.unmarked > 0 && (
        <div className="trk-bycv__mark">
          <span>
            <strong>{results.unmarked === 1 ? "1 application has" : `${results.unmarked} applications have`} no CV marked.</strong>{" "}
            Mark what you sent, so {results.unmarked === 1 ? "it counts" : "they count"} here.
          </span>
          <button type="button" className="trk-pill" onClick={onMark}>Mark {results.unmarked === 1 ? "it" : "them"}</button>
        </div>
      )}

      <p className="trk-bycv__foot">
        A few applications say little. We compare two CVs only when each was sent at least {MIN_SENT_TO_COMPARE} times. Answered
        counts every reply, a rejection too; Interviews counts the jobs that reached an interview, even if a rejection came after.
      </p>
    </section>
  );
}
