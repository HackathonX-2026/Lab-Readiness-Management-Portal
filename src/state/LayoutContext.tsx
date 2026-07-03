import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface LayoutCtx {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

const Ctx = createContext<LayoutCtx | null>(null);
const KEY = 'lab-readiness:sidebar-collapsed';

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(KEY) === '1');

  useEffect(() => {
    localStorage.setItem(KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <Ctx.Provider
      value={{
        sidebarCollapsed: collapsed,
        toggleSidebar: () => setCollapsed(v => !v),
        setSidebarCollapsed: setCollapsed
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLayout must be used inside LayoutProvider');
  return ctx;
}
