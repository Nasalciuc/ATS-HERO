"use client";
import { useState } from "react";
import Modal from "../ui/Modal";
import { Check } from "../icons";
import { OPTIONAL_SECTIONS, type SectionKey } from "../../lib/types";

export default function AddSectionModal({
  open,
  onClose,
  available,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  available: SectionKey[];
  onAdd: (keys: SectionKey[]) => void;
}) {
  const options = OPTIONAL_SECTIONS.filter((s) => available.includes(s.key));
  const [checked, setChecked] = useState<Set<SectionKey>>(new Set());

  const toggle = (key: SectionKey) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // Figma's "Continue" is always enabled: with nothing ticked it just closes.
  const confirm = () => {
    if (checked.size === 0) onClose();
    else onAdd([...checked]);
    setChecked(new Set());
  };

  return (
    <Modal open={open} onClose={onClose} variant="center" panelClassName="modal__panel--dialog">
      <div className="dialog addsection">
        <h2 className="dialog__title" data-figma="dialog-title">Add section</h2>
        <p className="dialog__text">
          Your resume is ATS-ready.
          <br />
          You can add more sections to improve your chances.
        </p>
        <div className="addsection__list">
          {options.length === 0 && <p className="addsection__empty">All sections have been added.</p>}
          {options.map((o) => {
            const isOn = checked.has(o.key);
            return (
              <button
                key={o.key}
                type="button"
                role="checkbox"
                aria-checked={isOn}
                className="addsection__check"
                onClick={() => toggle(o.key)}
              >
                <span className={`addsection__box${isOn ? " is-on" : ""}`} aria-hidden="true">
                  {isOn && <Check size={12} />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="topbtn topbtn--dark dialog__btn addsection__confirm"
          data-figma="dialog-primary"
          onClick={confirm}
        >
          Continue
        </button>
      </div>
    </Modal>
  );
}
