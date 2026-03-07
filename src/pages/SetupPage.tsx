import React from "react";
import { BarChart3, CheckCircle, Copy, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

const steps = [
  {
    title: "1. Create a Firebase Project",
    content: `Go to console.firebase.google.com → Click "Add Project" → Follow the wizard to create your project.`,
  },
  {
    title: "2. Enable Authentication",
    content: `In your Firebase project → Authentication → Sign-in method → Enable "Email/Password".`,
  },
  {
    title: "3. Create Firestore Database",
    content: `Cloud Firestore → Create database → Start in test mode (you'll add security rules later).`,
  },
  {
    title: "4. Enable Storage",
    content: `Storage → Get started → Accept defaults. This is used for product image uploads.`,
  },
  {
    title: "5. Get Your Web App Config",
    content: `Project Settings (gear icon) → General → Your Apps → Click </> (Web) → Register app → Copy the config object values.`,
  },
  {
    title: "6. Add Environment Variables",
    content: `Create a .env file in your project root with these variables (replace with your values):`,
    code: `VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef`,
  },
  {
    title: "7. Create Your First User",
    content: `In Firebase Console → Authentication → Add user → Create with email/password. Then go to Firestore → Create "users" collection → Add a document with ID = the user's UID:`,
    code: `{
  "name": "Your Name",
  "email": "your@email.com",
  "role": "general_manager",
  "department": "Management",
  "managerId": null
}`,
  },
  {
    title: "8. Create Counters Collection",
    content: `In Firestore → Create "counters" collection → Add document with ID "quotations":`,
    code: `{
  "count": 0
}`,
  },
];

const firestoreRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['general_manager', 'sub_manager'];
    }
    
    // Quotations collection
    match /quotations/{quotationId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && (
        resource.data.salesPersonId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['general_manager', 'sub_manager']
      );
    }
    
    // Counters
    match /counters/{counterId} {
      allow read, write: if request.auth != null;
    }
  }
}`;

const storageRules = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /product-images/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}`;

const SetupPage: React.FC = () => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <BarChart3 className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold font-display">SalesCRM Setup</h1>
          <p className="text-muted-foreground mt-2">
            Firebase is not configured yet. Follow these steps to connect your Firebase project.
          </p>
        </motion.div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="p-5">
                <h3 className="font-display font-semibold text-base mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.content}</p>
                {step.code && (
                  <div className="mt-3 relative">
                    <pre className="bg-secondary rounded-lg p-4 text-xs font-mono overflow-x-auto">{step.code}</pre>
                    <button
                      onClick={() => copyToClipboard(step.code!)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-card hover:bg-muted transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Security Rules */}
        <Card className="p-5">
          <h3 className="font-display font-semibold text-base mb-2">9. Firestore Security Rules</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Go to Firestore → Rules tab → Replace with:
          </p>
          <div className="relative">
            <pre className="bg-secondary rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-64">{firestoreRules}</pre>
            <button
              onClick={() => copyToClipboard(firestoreRules)}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-card hover:bg-muted transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-base mb-2">10. Storage Security Rules</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Go to Storage → Rules tab → Replace with:
          </p>
          <div className="relative">
            <pre className="bg-secondary rounded-lg p-4 text-xs font-mono overflow-x-auto">{storageRules}</pre>
            <button
              onClick={() => copyToClipboard(storageRules)}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-card hover:bg-muted transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </Card>

        <Card className="p-5 border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-display font-semibold text-base">Collections Summary</h3>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li><strong>users</strong> — User profiles with roles (doc ID = Firebase Auth UID)</li>
                <li><strong>quotations</strong> — All quotations with products, stages, follow-ups</li>
                <li><strong>counters</strong> — Auto-increment counter for quotation numbers</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                After adding environment variables, restart your dev server and refresh the page.
              </p>
            </div>
          </div>
        </Card>

        <div className="text-center pb-8">
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Open Firebase Console <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
