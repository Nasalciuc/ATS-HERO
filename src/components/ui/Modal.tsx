import { useEffect, type ReactNode } from "react";
import { Close } from "../icons";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  variant?: "center" | "side";
  children: ReactNode;
  width?: number;
};

export default function Modal({ open, onClose, variant = "center", children, width }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`modal modal--${variant}`} onMouseDown={onClose}>
      <div
        className="modal__panel"
        style={width ? { width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="Close">
          <Close />
        </button>
        {children}
      </div>
    </div>
  );
}
