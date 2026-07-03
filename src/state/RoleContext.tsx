import { useAuth } from './AuthContext';
import type { Role } from '../types';
import type { ReactNode } from 'react';

/** Kept for API compatibility with existing pages that use useRole().
 *  role/user now come from the signed-in AppUser via AuthContext. */
export function RoleProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useRole(): { role: Role; user: string; setRole: () => void; setUser: () => void } {
  const { currentUser } = useAuth();
  return {
    role: currentUser?.role ?? 'Manager',
    user: currentUser?.displayName ?? 'unknown',
    setRole: () => {},
    setUser: () => {}
  };
}
