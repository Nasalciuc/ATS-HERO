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

  const confirm = () => {
    onAdd([...checked]);
    setChecked(new Set());
  };

  return (
    <Modal open={open} onClose={onClose} variant="center" width={548}>
      <div className="addsection">
        <h2 className="addsection__title">Add section</h2>
        <p className="addsection__subtitle">
          Your resume is ATS-ready. You can add more sections to improve your chances.
        </p>
        <div className="addsection__list">
          {options.length === 0 && (
            <p className="addsection__empty">All sections have been added.</p>
          )}
          {options.map((o) => {
            const isOn = checked.has(o.key);
            return (
              <button
                key={o.key}
                className="addsection__check"
                onClick={() => toggle(o.key)}
              >
                <span className={`addsection__box${isOn ? " is-on" : ""}`}>
                  {isOn && <Check size={13} />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
        <button
          className="btn btn--dark addsection__confirm"
          disabled={checked.size === 0}
          onClick={confirm}
        >
          Continue
        </button>
      </div>
    </Modal>
  );
}
