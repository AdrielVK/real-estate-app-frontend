'use client';

import { create } from 'zustand';

export interface PropertyListState {
  query: string;
  currentPage: number;
  setQuery: (query: string) => void;
  setPage: (page: number) => void;
  reset: () => void;
}

const DEFAULTS = { query: '', currentPage: 1 } as const;

export function createPropertyListStore() {
  return create<PropertyListState>()((set) => ({
    ...DEFAULTS,
    setQuery: (query: string): void => set({ query, currentPage: 1 }),
    setPage: (page: number): void => set({ currentPage: page }),
    reset: (): void => set({ ...DEFAULTS }),
  }));
}

export const usePropertyListStore = createPropertyListStore();
