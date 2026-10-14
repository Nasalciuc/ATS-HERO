import { mutate } from "swr";

/** SWR keys of the lists a claim changes: every CV list and every scan list, in any scope. */
export function isClaimedList(key: unknown): boolean {
  return Array.isArray(key) && (key[0] === "cvs" || key[0] === "scans");
}

/**
 * Guest → account: create the user row, move the guest's CVs and scans to the account, then
 * fetch every CV and scan list on screen again.
 *
 * Without the refetch a new account saw "No CVs yet" until a reload: the OAuth redirect lands
 * on /app, whose list (requested from a layout effect) reaches the server as the new account
 * before the claim (requested from AppContext's passive effect) moves the guest's rows, and
 * Server Actions run one at a time, in that order.
 */
export async function claimGuestWork(steps: {
  ensureUser: () => Promise<unknown>;
  claimGuest: () => Promise<unknown>;
  refetch?: (matches: (key: unknown) => boolean) => unknown;
}): Promise<void> {
  await steps.ensureUser();
  await steps.claimGuest();
  void (steps.refetch ?? mutate)(isClaimedList);
}
