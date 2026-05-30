import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KnowledgeFlag } from '../data/knowledge';
import rawEntries from '../data/json/journalEntries.json';

export interface JournalEntry {
  id: string;
  triggerId: string;
  grantsKnowledge: KnowledgeFlag;
  title: string;
  text: string;
  unlockedAt?: number;
}

export interface DiscoveryEntry {
  resourceId: string;
  text: string;
  discoveredAt: number;
}

const ALL_ENTRIES: JournalEntry[] = rawEntries as JournalEntry[];

interface JournalStore {
  pending: JournalEntry[];
  accepted: JournalEntry[];
  discoveries: DiscoveryEntry[];
  isOpen: boolean;

  openJournal: () => void;
  closeJournal: () => void;
  triggerJournalEvent: (eventId: string) => void;
  acceptEntry: (entryId: string) => void;
  addDiscovery: (resourceId: string, text: string) => void;
  hasUnread: () => boolean;
  reset: () => void;
}

export const useJournalStore = create<JournalStore>()(
  persist(
    (set, get) => ({
      pending: [],
      accepted: [],
      discoveries: [],
      isOpen: false,

      openJournal: () => set({ isOpen: true }),
      closeJournal: () => set({ isOpen: false }),

      triggerJournalEvent: (eventId) => {
        const entry = ALL_ENTRIES.find(e => e.triggerId === eventId);
        if (!entry) return;
        const { pending, accepted } = get();
        const alreadyKnown = [...pending, ...accepted].some(e => e.id === entry.id);
        if (alreadyKnown) return;
        set(s => ({ pending: [...s.pending, entry] }));
      },

      acceptEntry: (entryId) => {
        const { pending } = get();
        const entry = pending.find(e => e.id === entryId);
        if (!entry) return;
        const accepted = { ...entry, unlockedAt: Date.now() };
        set(s => ({
          pending: s.pending.filter(e => e.id !== entryId),
          accepted: [accepted, ...s.accepted],
        }));
        import('./playerStore').then(({ usePlayerStore }) => {
          usePlayerStore.getState().learnKnowledge(entry.grantsKnowledge);
        });
      },

      addDiscovery: (resourceId, text) => {
        const already = get().discoveries.some(d => d.resourceId === resourceId);
        if (already) return;
        set(s => ({
          discoveries: [{ resourceId, text, discoveredAt: Date.now() }, ...s.discoveries],
        }));
      },

      hasUnread: () => get().pending.length > 0,

      reset: () => set({ pending: [], accepted: [], discoveries: [], isOpen: false }),
    }),
    { name: 'survival-journal-save' }
  )
);
