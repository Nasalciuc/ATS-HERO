# AppContext patch — add `openCv(id)` (so the dashboard can open a saved CV)

Your `store/AppContext.tsx` is already complete (autosave, claim-on-sign-in, restore). The
dashboard needs ONE small addition: a way to load a specific CV into the editor when the user
clicks a card. Add `openCv` — three tiny edits. Do **not** rewrite the file.

### 1. In the `AppState` type, add `openCv` (next to `ensureCv`)
```ts
  ensureCv: () => Promise<string>;
  openCv: (id: string) => Promise<void>;   // ← add this line
  update: (patch: Partial<CvData>) => void;
```

### 2. Add the `openCv` callback (right after the existing `ensureCv` useCallback)
```ts
  const openCv = useCallback(async (id: string): Promise<void> => {
    const { cv } = await api.getCv(id);
    setCv(cv);
    setData(cv.data);
    if (typeof window !== "undefined") localStorage.setItem(CV_ID_KEY, cv.id);
  }, []);
```

### 3. Expose it in the `value` useMemo (add to BOTH the object and the deps array)
```ts
  const value = useMemo<AppState>(
    () => ({
      user, cv, data, saving, lastSavedAt, ready,
      login, logout,
      ensureCv,
      openCv,          // ← add here
      update, save, reset,
    }),
    [user, cv, data, saving, lastSavedAt, ready, login, logout, ensureCv, openCv, update, save, reset]
    //                                                                      ↑ add openCv here
  );
```

That's it — `openCv` reuses your existing `api.getCv` + the same `CV_ID_KEY` the restore effect
uses, so opening from the dashboard is consistent with reload behaviour.
