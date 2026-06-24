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
    <Modal open={open} onClose={onClose} variant="center" width={420}>
      <div className="almost">
        <h2 className="almost__title">Almost there</h2>
        <p className="almost__subtitle">Some additional sections are not filled in yet</p>
        <div className="almost__actions">
          <button className="btn btn--outline-dark" onClick={onContinueEditing}>
            Continue editing
          </button>
          <button className="btn btn--dark" onClick={onCompleteAnyway}>
            Complete anyway
          </button>
        </div>
      </div>
    </Modal>
  );
}
