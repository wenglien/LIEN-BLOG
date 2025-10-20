import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';

const ADMIN_EMAIL = 'ian921030@gmail.com';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  firebaseUser: User | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  // Listen for Firebase auth state
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthenticated(Boolean(user && ADMIN_EMAIL && user.email === ADMIN_EMAIL));
    });

    return () => unsubscribe();
  }, []);

  const login = async (password: string) => {
    if (!auth || !ADMIN_EMAIL) {
      throw new Error('管理員登入尚未設定，請檢查 Firebase 設定。');
    }

    const credential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    if (credential.user.email !== ADMIN_EMAIL) {
      await signOut(auth);
      throw new Error('此帳號沒有管理員權限。');
    }

    setIsAuthenticated(true);
    setIsAuthModalOpen(false);
  };

  const logout = async () => {
    try {
      // Sign out Firebase
      if (auth) {
        await signOut(auth);
      }
      setIsAuthenticated(false);
      setFirebaseUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const setAuthModalOpen = (open: boolean) => {
    setIsAuthModalOpen(open);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        isAuthModalOpen,
        setAuthModalOpen,
        firebaseUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
