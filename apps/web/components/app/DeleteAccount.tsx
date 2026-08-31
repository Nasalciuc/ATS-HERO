"use client";
import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { deleteAccount } from "@/app/actions/users";

export function DeleteAccount() {
  const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false);
  const { signOut } = useClerk();
  return (
    <div className="danger-zone">
      <p>Type <b>DELETE</b> to permanently remove your account and all data.</p>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
      <button disabled={confirm !== "DELETE" || busy} className="btn btn--danger"
        onClick={async () => {
          setBusy(true);
          try {
            await deleteAccount();
            try {
              await signOut({ redirectUrl: "/" });
            } catch {
              window.location.href = "/";
            }
          } finally {
            setBusy(false);
          }
        }}>
        Delete my account
      </button>
    </div>
  );
}
