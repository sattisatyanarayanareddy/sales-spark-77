import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { CRMUser } from "@/types/crm";

interface AuthContextType {
  firebaseUser: User | null;
  crmUser: CRMUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

// Demo users for when Firebase isn't configured
const DEMO_USERS: Record<string, CRMUser> = {
  "gm@demo.com": {
    id: "gm-001",
    name: "Sarah Johnson",
    email: "gm@demo.com",
    role: "general_manager",
    department: "Management",
    managerId: null,
    createdAt: new Date().toISOString(),
  },
  "sm@demo.com": {
    id: "sm-001",
    name: "Mike Chen",
    email: "sm@demo.com",
    role: "sub_manager",
    department: "Sales East",
    managerId: "gm-001",
    createdAt: new Date().toISOString(),
  },
  "sp@demo.com": {
    id: "sp-001",
    name: "Alex Rivera",
    email: "sp@demo.com",
    role: "sales",
    department: "Sales East",
    managerId: "sm-001",
    createdAt: new Date().toISOString(),
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [crmUser, setCrmUser] = useState<CRMUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isDemoMode = !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === "demo-api-key";

  useEffect(() => {
    if (isDemoMode) {
      // Check localStorage for demo session
      const demoEmail = localStorage.getItem("demo_user_email");
      if (demoEmail && DEMO_USERS[demoEmail]) {
        setCrmUser(DEMO_USERS[demoEmail]);
      }
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setCrmUser({ id: user.uid, ...userDoc.data() } as CRMUser);
          }
        } catch (e) {
          console.error("Error fetching user doc:", e);
        }
      } else {
        setCrmUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [isDemoMode]);

  const login = async (email: string, password: string) => {
    if (isDemoMode) {
      const user = DEMO_USERS[email];
      if (user) {
        setCrmUser(user);
        localStorage.setItem("demo_user_email", email);
        return;
      }
      throw new Error("Invalid demo credentials. Use gm@demo.com, sm@demo.com, or sp@demo.com");
    }
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (isDemoMode) {
      setCrmUser(null);
      localStorage.removeItem("demo_user_email");
      return;
    }
    await signOut(auth);
    setCrmUser(null);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, crmUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
