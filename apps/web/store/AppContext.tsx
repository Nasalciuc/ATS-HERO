"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { api } from "../lib/api";
import { claimGuestWork } from "../lib/claim";
import { getGuestId } from "../lib/guest";
import { isClerkPublicConfigured } from "../lib/clerk-config";
import { emptyCvData, type Cv, type CvData, type User } from "../lib/types";
import { mutate } from "swr";

const CV_ID_KEY = "ats_hero_cv_id";

type AppState = {
  user: User | null;
  cv: Cv | null;
  data: CvData;
  saving: boolean;
  /** Last save failure (null when the latest save succeeded). Never silent — show it. */
  saveError: string | null;
  lastSavedAt: string | null;
  ready: boolean;

  login: (email?: string) => void;
  logout: () => void;

  ensureCv: () => Promise<string>;
  openCv: (id: string) => Promise<void>;
  update: (patch: Partial<CvData>) => void;
  save: () => Promise<void>;
  reset: () => void;
};

const AppContext = createContext<AppState | null>(null);

type ClerkAuth = {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
};

function AppProviderCore({
  children,
  auth,
}: {
  children: ReactNode;
  auth: ClerkAuth;
}) {
  const { user, isLoaded, isSignedIn, signOut } = auth;

  const [cv, setCv] = useState<Cv | null>(null);
  const [data, setData] = useState<CvData>(emptyCvData());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const cvRef = useRef(cv);
  cvRef.current = cv;

  // Save-flow bookkeeping (refs: read inside async work without re-subscribing).
  const readyRef = useRef(false); // initial CV load finished — autosave must not race it
  const dirtyRef = useRef(false); // local buffer holds edits the server has not confirmed
  const generationRef = useRef(0); // bumps on reset/openCv: stale async results are not adopted
  const creatingRef = useRef<Promise<Cv> | null>(null); // single-flight create of a new CV
  const claimingRef = useRef(false); // guest→account claim in progress

  useEffect(() => {
    const gen = generationRef.current;
    (async () => {
      const savedId = typeof window !== "undefined" ? localStorage.getItem(CV_ID_KEY) : null;
      if (savedId) {
        try {
          const { cv } = await api.getCv(savedId);
          if (gen === generationRef.current) {
            cvRef.current = cv;
            dataRef.current = cv.data;
            setCv(cv);
            setData(cv.data);
          }
        } catch {
          localStorage.removeItem(CV_ID_KEY);
        }
      }
      readyRef.current = true;
      setReady(true);
    })();
  }, []);

  /**
   * Creates the CV row once, even if autosave, the Save button and a double click all ask at
   * the same time. `mine` = this call started the create, so the row already holds `snapshot`.
   */
  const createOnce = useCallback((snapshot: CvData, gen: number): { promise: Promise<Cv>; mine: boolean } => {
    if (creatingRef.current) return { promise: creatingRef.current, mine: false };
    const promise = api.createCv("My resume", snapshot).then(({ cv: created }) => {
      if (gen === generationRef.current) {
        cvRef.current = created; // visible to the next save before React re-renders
        setCv(created); // NOT setData(created.data): the buffer may already hold newer edits
        if (typeof window !== "undefined") localStorage.setItem(CV_ID_KEY, created.id);
      }
      // A new row changes every CV list on screen (sidebar "My Resumes (n)", dashboard).
      void mutate((key) => Array.isArray(key) && key[0] === "cvs");
      return created;
    });
    creatingRef.current = promise;
    const clear = () => {
      if (creatingRef.current === promise) creatingRef.current = null;
    };
    promise.then(clear, clear);
    return { promise, mine: true };
  }, []);

  /**
   * The one save path (debounced autosave AND the Save button). Target CV + data snapshot are
   * captured synchronously, so a reset/openCv right after the call cannot redirect the write.
   * A brand-new CV is created on its first save — previously autosave only ran once a row
   * existed, so a guest who never pressed "Save" lost everything on refresh.
   */
  const autosave = useCallback(async (): Promise<void> => {
    // During the claim the row may still be guest-owned while the session is already signed
    // in, so the owner-scoped UPDATE would match 0 rows. dirtyRef stays true; the claim
    // effect saves again as soon as the claim lands.
    if (claimingRef.current) return;
    const snapshot = dataRef.current;
    const gen = generationRef.current;
    let target = cvRef.current;
    setSaving(true);
    try {
      let alreadySaved = false;
      if (!target) {
        const { promise, mine } = createOnce(snapshot, gen);
        target = await promise;
        alreadySaved = mine;
      }
      const saved = alreadySaved ? target : (await api.updateCv(target.id, snapshot, target.title)).cv;
      if (gen === generationRef.current) {
        if (cvRef.current?.id === saved.id) {
          cvRef.current = saved;
          setCv(saved);
        }
        setLastSavedAt(saved.updatedAt);
        setSaveError(null);
        if (dataRef.current === snapshot) dirtyRef.current = false; // newer edits keep it dirty
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (gen === generationRef.current) setSaveError(msg); // the next edit or Save retries
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  }, [createOnce]);

  // Claim runs once Clerk reports a signed-in session: the Server Actions read the same
  // session server-side, so there is no second auth handshake to wait for.
  const claimedRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || claimedRef.current) return;
    claimedRef.current = true;
    claimingRef.current = true;
    (async () => {
      try {
        await claimGuestWork({
          ensureUser: () => api.ensureUser(user ? { email: user.email } : undefined),
          claimGuest: () => api.claimGuest(getGuestId()),
        });
      } catch (e) {
        claimedRef.current = false;
        console.error("Account claim failed", e);
      } finally {
        claimingRef.current = false;
        if (dirtyRef.current) void autosave(); // edits made during the claim window
      }
    })();
  }, [isLoaded, isSignedIn, user, autosave]);

  /** Starts the pending debounced save NOW (before the refs move to another CV). */
  const flushPendingSave = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (dirtyRef.current && readyRef.current) void autosave();
  }, [autosave]);

  // Closing the tab / hard navigation inside the debounce window (or after a failed save)
  // would drop edits silently. Start the save immediately and let the browser ask to confirm.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      flushPendingSave();
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [flushPendingSave]);

  const update = useCallback(
    (patch: Partial<CvData>) => {
      setData((prev) => ({ ...prev, ...patch }));
      dirtyRef.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const tick = () => {
        if (!readyRef.current) {
          saveTimer.current = setTimeout(tick, 400); // never create a duplicate while the saved CV loads
          return;
        }
        saveTimer.current = null;
        void autosave();
      };
      saveTimer.current = setTimeout(tick, 800);
    },
    [autosave]
  );

  const ensureCv = useCallback(async (): Promise<string> => {
    if (cvRef.current) return cvRef.current.id;
    const { promise } = createOnce(dataRef.current, generationRef.current);
    return (await promise).id;
  }, [createOnce]);

  const openCv = useCallback(async (id: string): Promise<void> => {
    flushPendingSave();
    const gen = ++generationRef.current;
    creatingRef.current = null;
    const { cv } = await api.getCv(id);
    if (gen !== generationRef.current) return;
    cvRef.current = cv;
    dataRef.current = cv.data;
    dirtyRef.current = false;
    setCv(cv);
    setData(cv.data);
    setSaveError(null);
    if (typeof window !== "undefined") localStorage.setItem(CV_ID_KEY, cv.id);
  }, [flushPendingSave]);

  const save = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await autosave(); // never throws — failures land in saveError
  }, [autosave]);

  const login = useCallback((_email?: string) => {}, []);

  const logout = useCallback(() => {
    void (async () => {
      await mutate(() => true, undefined, { revalidate: false });
      await signOut();
    })();
  }, [signOut]);

  const reset = useCallback(() => {
    flushPendingSave(); // the previous CV's last edits still go to the previous CV
    generationRef.current++;
    creatingRef.current = null;
    const empty = emptyCvData();
    cvRef.current = null;
    dataRef.current = empty;
    dirtyRef.current = false;
    setCv(null);
    setData(empty);
    setSaveError(null);
    if (typeof window !== "undefined") localStorage.removeItem(CV_ID_KEY);
  }, [flushPendingSave]);

  const value = useMemo<AppState>(
    () => ({
      user,
      cv,
      data,
      saving,
      saveError,
      lastSavedAt,
      ready,
      login,
      logout,
      ensureCv,
      openCv,
      update,
      save,
      reset,
    }),
    [user, cv, data, saving, saveError, lastSavedAt, ready, login, logout, ensureCv, openCv, update, save, reset]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function AppProviderWithClerk({ children }: { children: ReactNode }) {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();

  const auth = useMemo<ClerkAuth>(
    () => ({
      user: clerkUser
        ? { id: clerkUser.id, email: clerkUser.primaryEmailAddress?.emailAddress ?? "" }
        : null,
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      signOut: () => clerk.signOut(),
    }),
    [clerkUser, isLoaded, isSignedIn, clerk]
  );

  return <AppProviderCore auth={auth}>{children}</AppProviderCore>;
}

function AppProviderGuest({ children }: { children: ReactNode }) {
  const auth = useMemo<ClerkAuth>(
    () => ({
      user: null,
      isLoaded: true,
      isSignedIn: false,
      signOut: async () => {},
    }),
    []
  );

  return <AppProviderCore auth={auth}>{children}</AppProviderCore>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  if (!isClerkPublicConfigured()) {
    return <AppProviderGuest>{children}</AppProviderGuest>;
  }
  return <AppProviderWithClerk>{children}</AppProviderWithClerk>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
