import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SkillId } from '../types/skills';
import type { KnowledgeFlag } from '../data/knowledge';
import rawEntries from '../data/json/journalEntries.json';

export interface JournalEntry {
  id: string;
  skillId: SkillId;
  skillLevel: number;
  grantsKnowledge: KnowledgeFlag;
  title: string;
  text: string;
  unlockedAt?: number;
}

const ALL_ENTRIES: JournalEntry[] = rawEntries as JournalEntry[];

interface JournalStore {
  pending: JournalEntry[];      // level-up triggered, not yet accepted
  accepted: JournalEntry[];     // read + knowledge granted
  isOpen: boolean;

  openJournal: () => void;
  closeJournal: () => void;
  addPendingEntry: (skillId: SkillId, skillLevel: number) => void;
  acceptEntry: (entryId: string) => void;
  hasUnread: () => boolean;
  reset: () => void;
}

export const useJournalStore = create<JournalStore>()(
  persist(
    (set, get) => ({
      pending: [],
      accepted: [],
      isOpen: false,

      openJournal: () => set({ isOpen: true }),
      closeJournal: () => set({ isOpen: false }),

      addPendingEntry: (skillId, skillLevel) => {
        const entry = ALL_ENTRIES.find(
          e => e.skillId === skillId && e.skillLevel === skillLevel
        );
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
        // Grant knowledge flag
        import('./playerStore').then(({ usePlayerStore }) => {
          usePlayerStore.getState().learnKnowledge(entry.grantsKnowledge);
        });
      },

      hasUnread: () => get().pending.length > 0,

      reset: () => set({ pending: [], accepted: [], isOpen: false }),
    }),
    { name: 'survival-journal-save' }
  )
);
