import { describe, it, expect, vi } from "vitest";
import { mutate } from "swr";
import { claimGuestWork, isClaimedList } from "./claim";
import { K } from "./swr-keys";

vi.mock("swr", async (importOriginal) => ({ ...(await importOriginal<typeof import("swr")>()), mutate: vi.fn() }));

describe("claimGuestWork (guest → account)", () => {
  it("creates the user, moves the guest's rows, then refetches every CV and scan list", async () => {
    const calls: string[] = [];
    const refetch = vi.fn(() => { calls.push("refetch"); });
    await claimGuestWork({
      ensureUser: async () => { calls.push("ensureUser"); },
      claimGuest: async () => { calls.push("claimGuest"); },
      refetch,
    });
    expect(calls).toEqual(["ensureUser", "claimGuest", "refetch"]);
    expect(refetch).toHaveBeenCalledWith(isClaimedList);
  });

  it("refetches the lists /app and the sidebar show, in both scopes, and nothing else", () => {
    expect(isClaimedList(K.cvs("user_1", "guest_1"))).toBe(true);   // the account's list
    expect(isClaimedList(K.cvs(null, "guest_1"))).toBe(true);       // the guest's list
    expect(isClaimedList(K.scans("user_1", "guest_1"))).toBe(true);
    expect(isClaimedList(K.cv("cv_1"))).toBe(false);                // the open CV: not reloaded under the editor
    expect(isClaimedList(K.apps("user_1"))).toBe(false);
    expect(isClaimedList(["subscription"])).toBe(false);
    expect(isClaimedList("cvs")).toBe(false);
    expect(isClaimedList(undefined)).toBe(false);
  });

  it("refetches nothing when a step fails, so AppContext can try the claim again", async () => {
    const refetch = vi.fn();
    const claimGuest = vi.fn(async () => {});
    await expect(claimGuestWork({ ensureUser: async () => { throw new Error("offline"); }, claimGuest, refetch }))
      .rejects.toThrow("offline");
    expect(claimGuest).not.toHaveBeenCalled();
    await expect(claimGuestWork({ ensureUser: async () => {}, claimGuest: async () => { throw new Error("db"); }, refetch }))
      .rejects.toThrow("db");
    expect(refetch).not.toHaveBeenCalled();
  });

  it("uses SWR's global mutate by default (the cache every useSWR list reads)", async () => {
    await claimGuestWork({ ensureUser: async () => {}, claimGuest: async () => {} });
    expect(mutate).toHaveBeenCalledWith(isClaimedList);
  });
});
