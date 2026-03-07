import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyCTw613mq7s7XcLkghBn9YAZ8A5WeNqaMI",
  authDomain: "salescrm-3440c.firebaseapp.com",
  projectId: "salescrm-3440c",
  storageBucket: "salescrm-3440c.firebasestorage.app",
  messagingSenderId: "661361221595",
  appId: "1:661361221595:web:0ff2be0664665d8b4a51fe",
  measurementId: "G-WJ99J9YTWS",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId,
};

const hasAllRequiredFirebaseConfig = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.trim().length > 0
);

export const isFirebaseConfigured = hasAllRequiredFirebaseConfig && firebaseConfig.apiKey !== "demo-api-key";

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : (null as never);
export const db = app ? getFirestore(app) : (null as never);
export const storage = app ? getStorage(app) : (null as never);
export default app;
