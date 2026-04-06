import { create } from 'zustand';
import type { Restaurant } from '@cravyr/shared';

interface SwipeDeckState {
  deck: Restaurant[];
  undoStack: Restaurant[];      // last swiped cards for undo (max 1 level)
  isLoading: boolean;
  hasError: boolean;
  isDeckEmpty: boolean;
  setDeck: (deck: Restaurant[]) => void;
  pushUndo: (restaurant: Restaurant) => void;
  popUndo: () => Restaurant | undefined;
  clearDeck: () => void;
  setLoading: (loading: boolean) => void;
  setError: (hasError: boolean) => void;
}

export const useSwipeDeckStore = create<SwipeDeckState>()((set, get) => ({
  deck: [],
  undoStack: [],
  isLoading: false,
  hasError: false,
  isDeckEmpty: false,
  setDeck: (deck) => set({ deck, isDeckEmpty: deck.length === 0, hasError: false }),
  pushUndo: (restaurant) =>
    set((state) => ({ undoStack: [...state.undoStack, restaurant] })),
  popUndo: () => {
    const { undoStack } = get();
    const last = undoStack[undoStack.length - 1];
    if (last) set((state) => ({ undoStack: state.undoStack.slice(0, -1) }));
    return last;
  },
  clearDeck: () => set({ deck: [], undoStack: [], isDeckEmpty: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (hasError) => set({ hasError }),
}));
