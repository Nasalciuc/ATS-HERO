"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog with the keyboard contract aria-modal promises: focus moves in on open (first form field,
 * else the close button), Tab stays inside, Escape closes, focus returns to the trigger on close.
 * The dialog is named after its first heading.
 */
export default function Modal({
  open,
  onClose,
  variant = "center",
  children,
  width,
  overlayClassName,
  panelClassName,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Parents pass inline handlers; keep the latest one without re-running the open effect
  // (re-running it would yank focus back to the first field on every re-render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const heading = panel?.querySelector<HTMLElement>("h1, h2, h3");
    if (panel && heading) {
      heading.id ||= titleId;
      panel.setAttribute("aria-labelledby", heading.id);
    }
    const first = panel?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea") ?? panel?.querySelector<HTMLElement>(".modal__close");
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const inside = panel.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === firstItem)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === lastItem)) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, titleId]);

  if (!open) return null;

  return (
    <div
      className={`modal modal--${variant}${overlayClassName ? ` ${overlayClassName}` : ""}`}
      data-figma="modal-overlay"
      onMouseDown={onClose}
    >
      <div
        ref={panelRef}
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
