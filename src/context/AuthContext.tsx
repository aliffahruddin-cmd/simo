import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { auth, db, onAuthStateChanged, signOut } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { apiRequest } from '../lib/api';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkLocalToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) return false;

      try {
        const data = await apiRequest('/auth/me');
        if (isMounted) {
          setUser({
            uid: data.id,
            noAnggota: data.no_anggota,
            namaLengkap: data.nama_lengkap,
            role: data.role as UserRole,
            wilayah: data.wilayah,
            email: data.extra_email || ''
          });
          return true;
        }
      } catch (err) {
        console.error('Local token recovery failed:', err);
      }
      return false;
    };

    const initAuth = async () => {
      setIsLoading(true);
      
      // 1. Try local token first (fastest)
      const recovered = await checkLocalToken();
      if (recovered) {
        setIsLoading(false);
        // We still might want to subscribe to onAuthStateChanged later, 
        // but for now we are good.
      }

      // 2. Setup Firebase listener as secondary
      try {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!isMounted) return;
          
          if (firebaseUser) {
            try {
              const token = await firebaseUser.getIdToken();
              localStorage.setItem('token', token);
              
              let userData: any = null;
              try {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                  userData = userDoc.data();
                }
              } catch (fsErr) {
                // Ignore firestore errors during auth init if possible
              }

              if (userData && isMounted) {
                setUser({
                  uid: firebaseUser.uid,
                  noAnggota: userData.no_anggota || '',
                  namaLengkap: userData.nama_lengkap || firebaseUser.displayName || 'User',
                  email: firebaseUser.email || '',
                  role: (userData.role || 'PAC') as UserRole,
                  wilayah: userData.wilayah || 'PUSAT',
                  createdAt: userData.created_at,
                });
              } else if (isMounted) {
                // Check if we already have a user from local recovery
                // If not, use the firebase user as a guest
                setUser(prev => prev || {
                  uid: firebaseUser.uid,
                  noAnggota: 'G-' + firebaseUser.uid.substring(0, 5),
                  namaLengkap: firebaseUser.displayName || 'User',
                  email: firebaseUser.email || '',
                  role: firebaseUser.email === 'aliffahruddin@gmail.com' ? 'ADMIN' : 'PAC' as UserRole,
                  wilayah: 'PUSAT',
                });
              }
            } catch (error) {
              console.error('Firebase Auth sync error:', error);
            }
          } else if (!recovered && isMounted) {
             // Only null if we didn't recover from local token
             setUser(null);
          }
          
          setIsLoading(false);
        }, (error) => {
          console.error('onAuthStateChanged error:', error);
          setIsLoading(false);
        });

        return unsubscribe;
      } catch (e) {
        console.error('Failed to setup onAuthStateChanged:', e);
        setIsLoading(false);
        return () => {};
      }
    };

    let unsubscribeFn: () => void = () => {};
    initAuth().then(unsub => {
      unsubscribeFn = unsub;
    });

    return () => {
      isMounted = false;
      unsubscribeFn();
    };
  }, []);

  const logout = async () => {
    try {
      localStorage.removeItem('token');
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
