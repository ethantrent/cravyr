import { create } from 'zustand';
import type { SavedRestaurant } from '@cravyr/shared';

interface PicksState {
  picks: SavedRestaurant[];
  isLoading: boolean;
  hasError: boolean;
  setPicks: (picks: SavedRestaurant[]) => void;
  addPick: (pick: SavedRestaurant) => void;
  removePick: (saveId: string) => void;   // optimistic delete by saves.id
  setLoading: (loading: boolean) => void;
  setError: (hasError: boolean) => void;
}

export const usePicksStore = create<PicksState>()((set) => ({
  picks: [],
  isLoading: false,
  hasError: false,
  setPicks: (picks) => set({ picks, hasError: false }),
  addPick: (pick) => set((state) => ({ picks: [pick, ...state.picks] })),
  removePick: (saveId) =>
    set((state) => ({ picks: state.picks.filter((p) => p.id !== saveId) })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (hasError) => set({ hasError }),
}));
