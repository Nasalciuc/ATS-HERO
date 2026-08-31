import { describe, expect, it } from "vitest";
import { K } from "./swr-keys";

describe("SWR keys identity scope", () => {
  it("scopes authenticated users by userId, not guestId", () => {
    expect(K.cvs("user-a", "guest-1")).toEqual(["cvs", "u:user-a"]);
    expect(K.scans("user-b")).toEqual(["scans", "u:user-b"]);
    expect(K.apps("user-a")).not.toEqual(K.apps("user-b"));
  });

  it("scopes guests by guestId and does not collide with auth", () => {
    expect(K.cvs(null, "guest-1")).toEqual(["cvs", "g:guest-1"]);
    expect(K.cvs(undefined, "guest-1")).toEqual(["cvs", "g:guest-1"]);
    expect(K.cvs(null)).toEqual(["cvs", "g:none"]);
    expect(K.cvs("user-a")).not.toEqual(K.cvs(null, "user-a"));
  });
});
