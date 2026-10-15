"use client";
import { TipsBulb, ChevronUp, PlusThin } from "../figma-icons";

/**
 * Figma "Pro Tips" card (252 wide). With a suggestion card under it (Work step → "Activities"),
 * the tips card shrinks to its 250px content height and the bulb is hidden, as in the Figma frame.
 * Phones (Figma mobile "ATS-Tips"): a 105px row card; the whole card opens the tips, and `note`
 * (e.g. "4/10 skills added") shows under the text.
 */
export default function ProTips({
  badge,
  onExplore,
  extra,
  note,
}: {
  badge: string;
  onExplore: () => void;
  extra?: { title: string; body: string; onAdd: () => void };
  note?: string;
}) {
  return (
    <div className="protips-col">
      <div className={`protips${extra ? " protips--compact" : ""}`} data-figma="tips">
        <span className="protips__badge" data-figma="tips-badge">{badge}</span>
        <h3 className="protips__title" data-figma="tips-title">Pro Tips</h3>
        <p className="protips__body" data-figma="tips-body">
          Explore best practices how to improve your chances of passing screening
        </p>
        {note && <p className="protips__note" data-figma="tips-note">{note}</p>}
        <button type="button" className="protips__explore" data-figma="tips-explore" onClick={onExplore}>
          Explore <ChevronUp />
        </button>
        <div className="protips__bulb" data-figma="tips-bulb" aria-hidden="true">
          <TipsBulb />
        </div>
      </div>

      {extra && (
        <div className="protips-extra" data-figma="tips-extra">
          <h3 className="protips-extra__title">{extra.title}</h3>
          <p className="protips-extra__body">{extra.body}</p>
          <button type="button" className="protips-extra__add" data-figma="tips-extra-add" onClick={extra.onAdd}>
            {/* 21px icon box like the Figma link; the plus fills 14px of it */}
            <PlusThin size={21} viewBox="3 3 18 18" /> Add section
          </button>
        </div>
      )}
    </div>
  );
}
