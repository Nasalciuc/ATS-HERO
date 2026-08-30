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
import { getGuestId } from "../lib/guest";
import { isClerkPublicConfigured } from "../lib/clerk-config";
import { emptyCvData, type Cv, type CvData, type User } from "../lib/types";

const CV_ID_KEY = "ats_hero_cv_id";

type AppState = {
  user: User | null;
  cv: Cv | null;
  data: CvData;
  saving: boolean;
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const cvRef = useRef(cv);
  cvRef.current = cv;

  useEffect(() => {
    (async () => {
      const savedId = typeof window !== "undefined" ? localStorage.getItem(CV_ID_KEY) : null;
      if (savedId) {
        try {
          const { cv } = await api.getCv(savedId);
          setCv(cv);
          setData(cv.data);
        } catch {
          localStorage.removeItem(CV_ID_KEY);
        }
      }
      setReady(true);
    })();
  }, []);

  // Claim runs once Clerk reports a signed-in session: the Server Actions read the same
  // session server-side, so there is no second auth handshake to wait for.
  const claimedRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || claimedRef.current) return;
    claimedRef.current = true;
    (async () => {
      try {
        await api.ensureUser(user ? { email: user.email } : undefined);
        await api.claimGuest(getGuestId());
      } catch (e) {
        claimedRef.current = false;
        console.error("Account claim failed", e);
      }
    })();
  }, [isLoaded, isSignedIn, user]);

  const persist = useCallback(async () => {
    const current = cvRef.current;
    if (!current) return;
    setSaving(true);
    try {
      const { cv: updated } = await api.updateCv(current.id, dataRef.current, current.title);
      setCv(updated);
      setLastSavedAt(updated.updatedAt);
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(
    (patch: Partial<CvData>) => {
      setData((prev) => ({ ...prev, ...patch }));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (cvRef.current) void persist();
      }, 800);
    },
    [persist]
  );

  const ensureCv = useCallback(async (): Promise<string> => {
    if (cvRef.current) return cvRef.current.id;
    const { cv: created } = await api.createCv("My resume", dataRef.current);
    setCv(created);
    setData(created.data);
    if (typeof window !== "undefined") localStorage.setItem(CV_ID_KEY, created.id);
    return created.id;
  }, []);

  const openCv = useCallback(async (id: string): Promise<void> => {
    const { cv } = await api.getCv(id);
    setCv(cv);
    setData(cv.data);
    if (typeof window !== "undefined") localStorage.setItem(CV_ID_KEY, cv.id);
  }, []);

  const save = useCallback(async () => {
    await ensureCv();
    await persist();
  }, [ensureCv, persist]);

  const login = useCallback((_email?: string) => {}, []);

  const logout = useCallback(() => {
    void signOut();
  }, [signOut]);

  const reset = useCallback(() => {
    setCv(null);
    setData(emptyCvData());
    if (typeof window !== "undefined") localStorage.removeItem(CV_ID_KEY);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      user,
      cv,
      data,
      saving,
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
    [user, cv, data, saving, lastSavedAt, ready, login, logout, ensureCv, openCv, update, save, reset]
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
