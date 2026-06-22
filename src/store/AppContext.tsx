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
import { api, getToken, setToken } from "../lib/api";
import { emptyCvData, type Cv, type CvData, type User } from "../lib/types";

const CV_ID_KEY = "ats_hero_cv_id";

type AppState = {
  user: User | null;
  cv: Cv | null;
  data: CvData;
  saving: boolean;
  lastSavedAt: string | null;
  ready: boolean;

  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;

  ensureCv: () => Promise<string>;
  update: (patch: Partial<CvData>) => void;
  save: () => Promise<void>;
  reset: () => void;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
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

  // Restore session + existing CV on first load.
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          const { user } = await api.me();
          setUser(user);
        } catch {
          setToken(null);
        }
      }
      const savedId = localStorage.getItem(CV_ID_KEY);
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
    localStorage.setItem(CV_ID_KEY, created.id);
    return created.id;
  }, []);

  const save = useCallback(async () => {
    await ensureCv();
    await persist();
  }, [ensureCv, persist]);

  const login = useCallback(async (email: string, password?: string) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
    // Claim the in-progress CV under the now-authenticated account.
    if (cvRef.current) {
      const { cv: updated } = await api.updateCv(cvRef.current.id, dataRef.current, cvRef.current.title);
      setCv(updated);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const reset = useCallback(() => {
    setCv(null);
    setData(emptyCvData());
    localStorage.removeItem(CV_ID_KEY);
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
      update,
      save,
      reset,
    }),
    [user, cv, data, saving, lastSavedAt, ready, login, logout, ensureCv, update, save, reset]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
