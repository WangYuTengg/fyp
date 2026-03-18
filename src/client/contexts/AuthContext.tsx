import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { AuthContext } from './auth-context';

const API_BASE = import.meta.env.VITE_API_URL || '';
const ADMIN_VIEW_AS_KEY = 'uml-platform.adminViewAs';
const CUSTOM_TOKEN_KEY = 'uml-platform.customToken';

export type DbUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'staff' | 'student';
  supabaseId: string;
} | null;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminViewAsPreference, setAdminViewAsState] = useState<'student' | 'staff' | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = window.localStorage.getItem(ADMIN_VIEW_AS_KEY);
    return stored === 'student' || stored === 'staff' ? stored : null;
  });

  // Fetch user role from database
  const fetchDbUser = async (accessToken: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDbUser(data.user);
      } else {
        setDbUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error);
      setDbUser(null);
    }
  };

  useEffect(() => {
    // Check for custom JWT token first (password-based login)
    const customToken = localStorage.getItem(CUSTOM_TOKEN_KEY);
    if (customToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchDbUser(customToken).finally(() => setLoading(false));
      // Still listen for Supabase auth changes below
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!customToken && session?.access_token) {
        fetchDbUser(session.access_token).finally(() => setLoading(false));
      } else if (!customToken) {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.access_token) {
        fetchDbUser(session.access_token);
      } else {
        setDbUser(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const adminViewAs = dbUser?.role === 'admin' ? adminViewAsPreference ?? 'staff' : null;

  const setAdminViewAs = (role: 'student' | 'staff') => {
    // Only admins can change impersonation mode.
    if (!dbUser || dbUser.role !== 'admin') return;
    setAdminViewAsState(role);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_VIEW_AS_KEY, role);
    }
  };

  const setCustomToken = (token: string, customDbUser: NonNullable<DbUser>) => {
    localStorage.setItem(CUSTOM_TOKEN_KEY, token);
    setDbUser(customDbUser);
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setDbUser(null);
    setAdminViewAsState(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_VIEW_AS_KEY);
      window.localStorage.removeItem(CUSTOM_TOKEN_KEY);
      window.localStorage.removeItem('uml-platform.refreshToken'); // S9: clear refresh token
    }
  };

  const hasRole = (role: string | string[]) => {
    if (!dbUser) return false;
    if (Array.isArray(role)) {
      return role.includes(dbUser.role);
    }
    return dbUser.role === role;
  };

  const isStaff = () => hasRole(['admin', 'staff']);

  const effectiveRole: 'admin' | 'staff' | 'student' | null = (() => {
    if (!dbUser) return null;
    if (dbUser.role !== 'admin') return dbUser.role;
    // For admins, treat view-as role as the UI role.
    return adminViewAs ?? 'staff';
  })();

  const value = {
    user,
    dbUser,
    session,
    loading,
    signOut,
    hasRole,
    isStaff,
    effectiveRole,
    adminViewAs,
    setAdminViewAs,
    setCustomToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
