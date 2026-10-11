"use client";
import { useEffect, type ReactNode } from "react";
import { PlusThin } from "../figma-icons";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  variant?: "center" | "side";
  children: ReactNode;
  width?: number;
  overlayClassName?: string;
  panelClassName?: string;
};

export default function Modal({
  open,
  onClose,
  variant = "center",
  children,
  width,
  overlayClassName,
  panelClassName,
}: ModalProps) {
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
    <div
      className={`modal modal--${variant}${overlayClassName ? ` ${overlayClassName}` : ""}`}
      data-figma="modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className={`modal__panel${panelClassName ? ` ${panelClassName}` : ""}`}
        role="dialog"
        aria-modal="true"
        data-figma="modal-panel"
        style={width ? { width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Figma: a 44px ring with mynaui:plus (34px) turned 45° */}
        <button type="button" className="modal__close" data-figma="modal-close" onClick={onClose} aria-label="Close">
          <PlusThin size={34} />
        </button>
        {children}
      </div>
    </div>
  );
}
