import { create } from 'zustand';
import type { Magazine, SearchResult } from '@/lib/types';

interface AppStore {
  activeMagazineId: number | null;
  setActiveMagazineId: (id: number | null) => void;

  highlightedSlotId: number | null;
  setHighlightedSlotId: (id: number | null) => void;

  searchResults: SearchResult[];
  setSearchResults: (results: SearchResult[]) => void;

  lastQuery: string;
  setLastQuery: (q: string) => void;

  magazines: Magazine[];
  setMagazines: (mags: Magazine[]) => void;

  notFoundBlink: boolean;
  triggerNotFoundBlink: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeMagazineId: null,
  setActiveMagazineId: (id) => set({ activeMagazineId: id }),

  highlightedSlotId: null,
  setHighlightedSlotId: (id) => set({ highlightedSlotId: id }),

  searchResults: [],
  setSearchResults: (results) => {
    const highlightedId = results.length > 0 ? results[0].slotId : null;
    set({ searchResults: results, highlightedSlotId: highlightedId });
  },

  lastQuery: '',
  setLastQuery: (q) => set({ lastQuery: q }),

  magazines: [],
  setMagazines: (mags) => set({ magazines: mags }),

  notFoundBlink: false,
  triggerNotFoundBlink: () => {
    set({ notFoundBlink: true });
    setTimeout(() => set({ notFoundBlink: false }), 3000);
  },
}));
