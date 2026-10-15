"use client";
import Modal from "../ui/Modal";

export default function AlmostThereModal({
  open,
  onClose,
  onContinueEditing,
  onCompleteAnyway,
}: {
  open: boolean;
  onClose: () => void;
  onContinueEditing: () => void;
  onCompleteAnyway: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} variant="center" panelClassName="modal__panel--dialog">
      <div className="dialog almost">
        <h2 className="dialog__title" data-figma="dialog-title">Almost there</h2>
        <p className="dialog__text" data-figma="dialog-text">Some additional sections are not filled in yet</p>
        <div className="dialog__actions">
          <button type="button" className="topbtn topbtn--ghost dialog__btn dialog__btn--narrow"
            data-figma="dialog-secondary" onClick={onContinueEditing}>
            Continue editing
          </button>
          <button type="button" className="topbtn topbtn--dark dialog__btn" data-figma="dialog-primary" onClick={onCompleteAnyway}>
            Complete anyway
          </button>
        </div>
      </div>
    </Modal>
  );
}
