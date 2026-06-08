import React, { createContext, useContext, useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
  setCrmUser: (user: CRMUser | null) => void;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  createUser: (email: string, password: string, name: string, role: UserRole, department: string, managerId: string | null, designation?: string, companyName?: string) => Promise<void>;
  completeProfile: (name: string, role: UserRole, phone: string, address: string, department: string) => Promise<void>;
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
  const [networkError, setNetworkError] = useState<Error | null>(null);
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
          console.log("🔍 Auth user detected:", user.uid, user.email);
          setNetworkError(null);
          const userData = await fetchUserDoc(user.uid);
          console.log("✅ Firestore user data:", userData);
          setCrmUser(userData);
        } catch (e: any) {
          console.error("❌ Error fetching user doc:", e);
          // If error indicates offline/unavailable, show a full-page network error
          const code = (e && (e.code || e.code === 0) && e.code) || (e && e.message) || null;
          const isOffline = typeof code === "string" && (code === "unavailable" || code.toLowerCase().includes("offline") || code.toLowerCase().includes("internet"));
          if (isOffline) {
            setNetworkError(new Error("Unable to reach Firestore backend. Please check your internet connection."));
          } else {
            toast.error(e?.message || "Failed to load your profile. Please refresh and try again.");
            setCrmUser(null);
          }
        }
      } else {
        console.log("❌ No auth user");
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

  const resetPassword = async (email: string) => {
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured. Please add your Firebase config.");
    }
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    if (!isFirebaseConfigured) {
      setCrmUser(null);
      return;
    }
    await signOut(auth);
    setCrmUser(null);
  };

  const createUser = async (
    email: string,
    password: string,
    name: string,
    role: UserRole,
    department: string,
    managerId: string | null,
    designation?: string,
    companyName?: string
  ) => {
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured.");
    }
    // Note: Creating users from the client with createUserWithEmailAndPassword
    // will sign out the current user. For production, use Firebase Admin SDK via
    // a Cloud Function. For now this works for initial setup.
    const currentUser = auth.currentUser;
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role,
      department,
      managerId,
      designation: designation || "",
      companyName: companyName || "",
      createdAt: serverTimestamp(),
    });
    // Sign back in as the original user if they were logged in
    if (currentUser) {
      await auth.updateCurrentUser(currentUser);
    }
  };

  const completeProfile = async (
    name: string,
    role: UserRole,
    phone: string,
    address: string,
    department: string
  ) => {
    if (!isFirebaseConfigured) {
      throw new Error("Firebase is not configured.");
    }
    if (!firebaseUser) {
      throw new Error("No authenticated user found.");
    }

    const userDoc = {
      name,
      email: firebaseUser.email || "",
      role,
      department,
      managerId: null,
      phone,
      address,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, "users", firebaseUser.uid), userDoc);

    setCrmUser({
      id: firebaseUser.uid,
      name,
      email: firebaseUser.email || "",
      role,
      department,
      managerId: null,
      phone,
      address,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  if (networkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-2xl w-full text-center space-y-4">
          <h1 className="text-3xl font-bold">Opps!!!</h1>
          <p className="text-lg text-muted-foreground">{networkError.message}</p>
          <div className="pt-4">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg shadow-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, crmUser, setCrmUser, loading, login, resetPassword, logout, createUser, completeProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
