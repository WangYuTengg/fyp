import { createContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';

export type DbUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'staff' | 'student';
  supabaseId: string;
} | null;

export interface AuthContextType {
  user: User | null;
  dbUser: DbUser;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (role: string | string[]) => boolean;
  isStaff: () => boolean;
  /**
   * Effective role used for UI rendering/navigation.
   * For admins, this can be toggled between 'student' and 'staff'.
   */
  effectiveRole: 'admin' | 'staff' | 'student' | null;
  /** Admin-only UI impersonation setting. */
  adminViewAs: 'student' | 'staff' | null;
  setAdminViewAs: (role: 'student' | 'staff') => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
