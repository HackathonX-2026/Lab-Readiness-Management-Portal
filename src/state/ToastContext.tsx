import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  timeout: number;
}

interface ToastCtx {
  toasts: Toast[];
  push: (kind: ToastKind, title: string, message?: string, timeout?: number) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const push = useCallback((kind: ToastKind, title: string, message?: string, timeout = 4000) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts(prev => [...prev, { id, kind, title, message, timeout }]);
    if (timeout > 0) setTimeout(() => dismiss(id), timeout);
  }, [dismiss]);

  const value: ToastCtx = {
    toasts,
    push,
    success: (t, m) => push('success', t, m),
    error: (t, m) => push('error', t, m, 6000),
    info: (t, m) => push('info', t, m),
    warning: (t, m) => push('warning', t, m, 5000),
    dismiss
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const styles: Record<ToastKind, { bg: string; icon: string; ring: string }> = {
    success: { bg: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-700', icon: '✅', ring: 'ring-emerald-500' },
    error:   { bg: 'bg-rose-50 border-rose-300 dark:bg-rose-900/40 dark:border-rose-700', icon: '🚨', ring: 'ring-rose-500' },
    info:    { bg: 'bg-sky-50 border-sky-300 dark:bg-sky-900/40 dark:border-sky-700', icon: 'ℹ️', ring: 'ring-sky-500' },
    warning: { bg: 'bg-amber-50 border-amber-300 dark:bg-amber-900/40 dark:border-amber-700', icon: '⚠️', ring: 'ring-amber-500' }
  };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map(t => {
        const s = styles[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border shadow-lg px-4 py-3 flex items-start gap-3 ${s.bg} animate-[slideIn_0.2s_ease-out]`}
            role="status"
          >
            <div className="text-lg leading-none mt-0.5">{s.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t.title}</div>
              {t.message && <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 break-words">{t.message}</div>}
            </div>
            <button
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 text-sm leading-none"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
