import { create } from 'zustand';
import type { UserPreferences } from '@cravyr/shared';

interface PreferencesState {
  preferences: UserPreferences | null;
  isLoading: boolean;
  isSaving: boolean;
  // Local draft state for the Preferences screen form
  draftCuisines: string[];
  draftPriceRange: Array<1 | 2 | 3 | 4>;
  draftMaxDistance: 1 | 5 | 15;
  setPreferences: (prefs: UserPreferences) => void;
  setDraftCuisines: (cuisines: string[]) => void;
  toggleDraftCuisine: (cuisine: string) => void;
  setDraftPriceRange: (range: Array<1 | 2 | 3 | 4>) => void;
  toggleDraftPrice: (level: 1 | 2 | 3 | 4) => void;
  setDraftMaxDistance: (km: 1 | 5 | 15) => void;
  resetDraftToSaved: () => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()((set, get) => ({
  preferences: null,
  isLoading: false,
  isSaving: false,
  draftCuisines: [],
  draftPriceRange: [1, 2, 3, 4],
  draftMaxDistance: 5,
  setPreferences: (preferences) =>
    set({
      preferences,
      draftCuisines: preferences.cuisines,
      draftPriceRange: preferences.price_range,
      draftMaxDistance: preferences.max_distance_km,
    }),
  setDraftCuisines: (draftCuisines) => set({ draftCuisines }),
  toggleDraftCuisine: (cuisine) =>
    set((state) => ({
      draftCuisines: state.draftCuisines.includes(cuisine)
        ? state.draftCuisines.filter((c) => c !== cuisine)
        : [...state.draftCuisines, cuisine],
    })),
  setDraftPriceRange: (draftPriceRange) => set({ draftPriceRange }),
  toggleDraftPrice: (level) =>
    set((state) => ({
      draftPriceRange: state.draftPriceRange.includes(level)
        ? (state.draftPriceRange.filter((p) => p !== level) as Array<1 | 2 | 3 | 4>)
        : ([...state.draftPriceRange, level].sort() as Array<1 | 2 | 3 | 4>),
    })),
  setDraftMaxDistance: (draftMaxDistance) => set({ draftMaxDistance }),
  resetDraftToSaved: () => {
    const { preferences } = get();
    if (preferences) {
      set({
        draftCuisines: preferences.cuisines,
        draftPriceRange: preferences.price_range,
        draftMaxDistance: preferences.max_distance_km,
      });
    }
  },
  setLoading: (isLoading) => set({ isLoading }),
  setSaving: (isSaving) => set({ isSaving }),
}));
