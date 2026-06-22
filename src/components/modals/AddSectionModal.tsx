import { useState } from "react";
import Modal from "../ui/Modal";
import { RadioDot } from "../icons";
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
  onAdd: (key: SectionKey) => void;
}) {
  const options = OPTIONAL_SECTIONS.filter((s) => available.includes(s.key));
  const [selected, setSelected] = useState<SectionKey | null>(options[0]?.key ?? null);

  return (
    <Modal open={open} onClose={onClose} variant="center" width={548}>
      <div className="addsection">
        <h2 className="addsection__title">Add section</h2>
        <p className="addsection__subtitle">
          Choose an additional section to showcase more of your experience
        </p>
        <div className="addsection__list">
          {options.length === 0 && (
            <p className="addsection__empty">All sections have been added.</p>
          )}
          {options.map((o) => (
            <button
              key={o.key}
              className="addsection__option"
              onClick={() => setSelected(o.key)}
            >
              <span className={selected === o.key ? "is-checked" : ""}>
                <RadioDot checked={selected === o.key} />
              </span>
              {o.emoji} {o.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn--dark addsection__confirm"
          disabled={!selected}
          onClick={() => selected && onAdd(selected)}
        >
          Add section
        </button>
      </div>
    </Modal>
  );
}
