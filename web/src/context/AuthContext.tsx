import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiUrl } from '../utils/api';

export interface AuthUser {
  userId: number;
  loginId: string;
  role: 'ADMIN' | 'HOSTEL_OFFICE' | 'CHIEF_WARDEN' | 'WARDEN' | 'MESS_MANAGER' | 'CARETAKER' | 'STUDENT';
  mustChangePassword?: boolean;
  isActive?: boolean;
  student?: {
    student_id: number;
    roll_no: string;
    full_name: string;
    gender: string;
    branch: string;
    batch_year: number;
    merit_rank: number;
  } | null;
  authority?: {
    authority_id: number;
    hostel_id: number | null;
    designation: string;
    full_name: string;
  } | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  csrfToken: string | null;
  login: (loginId: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateMustChangePassword: (mustChange: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to read csrf token from cookie if available
  const getCsrfFromCookie = () => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(^|;\s*)csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[2]) : null;
  };

  const refreshUser = async () => {
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' });
      if (res.ok) {
        const text = await res.text();
        if (!text) {
          setUser(null);
          return;
        }
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          setUser(null);
          return;
        }
        if (!data || !data.user) {
          setUser(null);
          return;
        }
        const cookieCsrf = getCsrfFromCookie();
        if (cookieCsrf) setCsrfToken(cookieCsrf);
        setUser({
          userId: data.user.user_id,
          loginId: data.user.login_id,
          role: data.user.role,
          mustChangePassword: Boolean(data.user.must_change_password),
          isActive: Boolean(data.user.is_active),
          student: data.user.student,
          authority: data.user.authority,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (loginId: string, password: string): Promise<AuthUser> => {
    let res: Response;
    try {
      res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_id: loginId, password }),
        credentials: 'include',
      });
    } catch (networkErr: any) {
      throw new Error('Network error: Unable to reach the server. Please check your internet connection.');
    }

    const text = await res.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      const message =
        data?.message ||
        data?.error ||
        (res.status === 404
          ? 'API route not found (404). Please ensure the backend is deployed.'
          : res.status === 405
          ? 'Method not allowed (405). The API endpoint is not receiving POST requests.'
          : res.status >= 500
          ? 'Server error (500). Please check database connectivity.'
          : `Login failed (HTTP ${res.status}).`);
      throw new Error(message);
    }

    if (!data || !data.user) {
      throw new Error('Invalid response from server. Please try again.');
    }

    if (data.csrfToken) {
      setCsrfToken(data.csrfToken);
    }

    const authUser: AuthUser = {
      userId: data.user.userId,
      loginId: data.user.loginId,
      role: data.user.role,
      mustChangePassword: Boolean(data.user.mustChangePassword),
    };
    setUser(authUser);
    // Refresh full profile in background
    refreshUser();
    return authUser;
  };

  const logout = async () => {
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
      setCsrfToken(null);
    }
  };

  const updateMustChangePassword = (mustChange: boolean) => {
    setUser((prev) => (prev ? { ...prev, mustChangePassword: mustChange } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        csrfToken: csrfToken || getCsrfFromCookie(),
        login,
        logout,
        refreshUser,
        updateMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
