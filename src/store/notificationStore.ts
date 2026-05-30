import { create } from 'zustand';

export interface SkillNotification {
  id: string;
  message: string;
  type: 'xp' | 'levelup';
  expiresAt: number;
}

export interface MaterialNotification {
  id: string;
  resourceId: string;
  text: string;
  expiresAt: number;
  fading: boolean;
}

interface NotificationStore {
  notifications: SkillNotification[];
  materialNotifications: MaterialNotification[];

  addNotification: (message: string, type: SkillNotification['type']) => void;
  removeNotification: (id: string) => void;
  purgeExpired: () => void;

  addMaterialNotification: (resourceId: string, text: string) => void;
  removeMaterialNotification: (id: string) => void;
  fadeMaterialNotification: (id: string) => void;
}

const MATERIAL_TTL = 10_000;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  materialNotifications: [],

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

  addMaterialNotification: (resourceId, text) => {
    const id = `mat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const expiresAt = Date.now() + MATERIAL_TTL;
    set((s) => ({
      materialNotifications: [...s.materialNotifications.slice(-4), { id, resourceId, text, expiresAt, fading: false }],
    }));
    // Start fade 800ms before removal
    setTimeout(() => get().fadeMaterialNotification(id), MATERIAL_TTL - 800);
    setTimeout(() => get().removeMaterialNotification(id), MATERIAL_TTL);
  },

  fadeMaterialNotification: (id) => {
    set((s) => ({
      materialNotifications: s.materialNotifications.map((n) =>
        n.id === id ? { ...n, fading: true } : n
      ),
    }));
  },

  removeMaterialNotification: (id) => {
    set((s) => ({ materialNotifications: s.materialNotifications.filter((n) => n.id !== id) }));
  },
}));
