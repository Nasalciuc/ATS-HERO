// Global UI chrome — Zustand. Replaces the UI bits of the old React Context.
import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  activeModal: string | null;

  toggleSidebar: () => void;
  setSidebar: (collapsed: boolean) => void;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  activeModal: null,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebar: (collapsed) => set({ sidebarCollapsed: collapsed }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
