import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { fetchUserDoc } from "@/lib/firestore-service";
import { CRMUser, UserRole } from "@/types/crm";

interface AuthContextType {
  firebaseUser: User | null;
  crmUser: CRMUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createUser: (email: string, password: string, name: string, role: UserRole, department: string, managerId: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [crmUser, setCrmUser] = useState<CRMUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const userData = await fetchUserDoc(user.uid);
          setCrmUser(userData);
        } catch (e) {
          console.error("Error fetching user doc:", e);
          setCrmUser(null);
        }
      } else {
        setCrmUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured. Please add your Firebase config.");
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setCrmUser(null);
  };

  const createUser = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    department: string,
    managerId: string | null
  ) => {
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured.");
    }
    // Note: Creating users from the client with createUserWithEmailAndPassword
    // will sign out the current user. For production, use Firebase Admin SDK via
    // a Cloud Function. For now this works for initial setup.
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role,
      department,
      managerId,
      createdAt: serverTimestamp(),
    });
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, crmUser, loading, login, logout, createUser }}>
      {children}
    </AuthContext.Provider>
  );
};
