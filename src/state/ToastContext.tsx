import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CircleCheck, CircleX, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react';

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
  const styles: Record<ToastKind, { color: string; icon: LucideIcon }> = {
    success: { color: 'status-good', icon: CircleCheck },
    error:   { color: 'status-bad', icon: CircleX },
    info:    { color: 'status-info', icon: Info },
    warning: { color: 'status-warn', icon: TriangleAlert }
  };
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map(t => {
        const s = styles[t.kind];
        return (
          <div
            key={t.id}
            className="popover pointer-events-auto flex animate-[slideIn_0.2s_ease-out] items-start gap-3 px-4 py-3"
            role="status"
          >
            <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${s.color}`}><s.icon size={15} aria-hidden="true" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{t.title}</div>
              {t.message && <div className="mt-1 break-words text-xs text-muted">{t.message}</div>}
            </div>
            <button
              className="btn-icon h-6 w-6"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
