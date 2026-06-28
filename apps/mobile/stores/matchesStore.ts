import { create } from 'zustand';
import type { Restaurant } from '@cravyr/shared';

interface MatchesState {
  matches: Restaurant[];
  isLoading: boolean;
  hasError: boolean;
  setMatches: (matches: Restaurant[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (hasError: boolean) => void;
}

export const useMatchesStore = create<MatchesState>()((set) => ({
  matches: [],
  isLoading: false,
  hasError: false,
  setMatches: (matches) => set({ matches, hasError: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (hasError) => set({ hasError }),
}));
