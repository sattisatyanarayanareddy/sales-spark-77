import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SetupPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Firebase Setup Required</h1>
          <p className="text-muted-foreground text-lg">
            Your Firebase configuration is missing or incomplete
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Missing</AlertTitle>
          <AlertDescription>
            Please configure your Firebase credentials in the <code className="px-2 py-1 bg-muted rounded">.env</code> file to continue.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="text-xl font-semibold">Required Environment Variables</h2>
          <p className="text-sm text-muted-foreground">
            Create a <code className="px-2 py-1 bg-muted rounded">.env</code> file in the root directory with the following variables:
          </p>
          
          <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
            <div>VITE_FIREBASE_API_KEY=your_api_key</div>
            <div>VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com</div>
            <div>VITE_FIREBASE_PROJECT_ID=your_project_id</div>
            <div>VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com</div>
            <div>VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id</div>
            <div>VITE_FIREBASE_APP_ID=your_app_id</div>
            <div className="pt-2">VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name</div>
            <div>VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset</div>
          </div>

          <div className="space-y-2 pt-4">
            <h3 className="font-semibold">How to get Firebase credentials:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Firebase Console</a></li>
              <li>Select your project or create a new one</li>
              <li>Go to Project Settings → General</li>
              <li>Scroll down to "Your apps" and select Web app</li>
              <li>Copy the configuration values</li>
            </ol>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">How to get Cloudinary credentials:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Go to <a href="https://cloudinary.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Cloudinary</a></li>
              <li>Sign up or log in to your account</li>
              <li>Go to Dashboard to find your Cloud Name</li>
              <li>Go to Settings → Upload → Upload presets to create an unsigned preset</li>
            </ol>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              After adding the environment variables, restart the development server for changes to take effect.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
};

export default SetupPage;
