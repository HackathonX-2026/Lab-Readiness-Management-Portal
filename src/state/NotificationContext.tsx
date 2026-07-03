import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Notification } from '../types';

interface NotifCtx {
  notifications: Notification[];
  push: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markRead: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<NotifCtx | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const push: NotifCtx['push'] = n =>
    setNotifications(prev => [
      { ...n, id: `n-${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), read: false },
      ...prev
    ].slice(0, 50));

  const markRead = (id: string) =>
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));

  const clear = () => setNotifications([]);

  return <Ctx.Provider value={{ notifications, push, markRead, clear }}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
