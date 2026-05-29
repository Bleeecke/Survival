import { create } from 'zustand';

export interface SkillNotification {
  id: string;
  message: string;
  type: 'xp' | 'levelup';
  expiresAt: number;
}

interface NotificationStore {
  notifications: SkillNotification[];
  addNotification: (message: string, type: SkillNotification['type']) => void;
  removeNotification: (id: string) => void;
  purgeExpired: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (message, type) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const expiresAt = Date.now() + (type === 'levelup' ? 4000 : 2500);
    set((s) => ({
      notifications: [...s.notifications.slice(-4), { id, message, type, expiresAt }],
    }));
    setTimeout(() => get().removeNotification(id), type === 'levelup' ? 4200 : 2700);
  },

  removeNotification: (id) => {
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
  },

  purgeExpired: () => {
    const now = Date.now();
    set((s) => ({ notifications: s.notifications.filter((n) => n.expiresAt > now) }));
  },
}));
