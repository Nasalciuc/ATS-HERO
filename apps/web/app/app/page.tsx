"use client";
// Dashboard — the "/app" index. Lists the current user's (or guest's) saved CVs reactively via
// useCvs(). Works for both: a guest sees their on-device CVs; after sign-in + claim, the same CVs
// appear owned. Open routes into the builder; delete is reactive (the list updates itself).
//
// TODO(integration): the installed @clerk/nextjs@7.5.8 does NOT export <SignedIn>/<SignedOut>
// (they were removed in favour of <Show>), and <UserButton> no longer accepts `afterSignOutUrl`.
// To stay faithful to the package's UI we gate on Clerk's useUser() instead of the control
// components, and drop the prop. Everything else is the package's page as-is.
import { useRouter } from "next/navigation";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { useCvs } from "@/hooks/use-cvs";
import { useApp } from "@/store/AppContext";
import { api } from "@/lib/api";
import type { Doc } from "@/convex/_generated/dataModel";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const cvs = useCvs(); // undefined while loading, then Doc<"cvs">[]
  const { openCv, reset } = useApp();
  const { isSignedIn } = useUser();
  const router = useRouter();

  function newCv() {
    reset();
    router.push("/app/create");
  }
  async function open(id: string) {
    await openCv(id);
    router.push("/app/create");
  }
  async function remove(id: string) {
    if (typeof window !== "undefined" && !window.confirm("Delete this CV?")) return;
    await api.deleteCv(id); // reactive: useCvs() refreshes automatically
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Your CVs</h1>
          <p className="text-sm text-zinc-500">Build, score and tailor your resumes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={newCv}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            New CV
          </button>
          {isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                Sign in
              </button>
            </SignInButton>
          )}
        </div>
      </header>

      {!isSignedIn && (
        <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          You&apos;re working as a guest — your CVs are saved on this device.{" "}
          <SignInButton mode="modal">
            <button className="font-semibold underline underline-offset-2">Sign in</button>
          </SignInButton>{" "}
          to keep them across devices.
        </div>
      )}

      {cvs === undefined ? (
        <div className="py-24 text-center text-zinc-400">Loading…</div>
      ) : cvs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 py-24 text-center">
          <p className="text-zinc-600">No CVs yet.</p>
          <button
            onClick={newCv}
            className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Create your first CV
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cvs.map((cv: Doc<"cvs">) => (
            <li
              key={cv._id}
              className="group rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-sm"
            >
              <button onClick={() => open(cv._id)} className="block w-full text-left">
                <h3 className="truncate font-semibold text-zinc-900">{cv.title || "Untitled"}</h3>
                <p className="mt-1 text-xs text-zinc-400">Updated {formatDate(cv.updatedAt)}</p>
                <p className="mt-3 truncate text-sm text-zinc-500">
                  {cv.data?.summary?.position || cv.data?.personalInfo?.name || "Empty resume"}
                </p>
              </button>
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => open(cv._id)}
                  className="text-sm font-medium text-violet-700 hover:text-violet-900"
                >
                  Open →
                </button>
                <button
                  onClick={() => remove(cv._id)}
                  className="text-xs text-zinc-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
