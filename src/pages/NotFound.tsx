import { useLocation } from "react-router-dom";
import { useEffect } from "react";

interface NotFoundProps {
  envMissing?: boolean;
}

const NotFound = ({ envMissing }: NotFoundProps) => {
  const location = useLocation();

  useEffect(() => {
    if (envMissing) {
      console.error("Firebase Environment configuration is missing.");
    } else {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [location.pathname, envMissing]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-blue-500/5 to-transparent pointer-events-none" />
      
      <div className="text-center max-w-md w-full p-8 rounded-3xl border border-border/80 bg-card/70 backdrop-blur-md shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {envMissing ? (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center font-bold text-2xl">
              ⚠️
            </div>
            <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground font-display">Configuration Missing</h1>
            <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
              The required environment variables for Firebase connection were not found. Please verify your <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-destructive">.env</code> configuration.
            </p>
            <div className="text-left bg-muted/50 p-4 rounded-xl text-xs space-y-2 mb-6 border border-border/60">
              <p className="font-semibold text-muted-foreground">Required variables:</p>
              <ul className="list-disc pl-4 font-mono text-[10px] text-foreground space-y-1">
                <li>VITE_FIREBASE_API_KEY</li>
                <li>VITE_FIREBASE_PROJECT_ID</li>
                <li>VITE_FIREBASE_AUTH_DOMAIN</li>
                <li>VITE_FIREBASE_APP_ID</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">
              Please setup your project environment and restart the server.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-7xl font-extrabold tracking-tighter bg-gradient-to-r from-primary via-blue-600 to-blue-700 bg-clip-text text-transparent font-display">404</h1>
            <p className="mb-2 text-xl font-semibold text-foreground">Oops! Page not found</p>
            <p className="mb-6 text-sm text-muted-foreground">The page you are looking for might have been removed or doesn't exist.</p>
            <a href="/" className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-blue-700 px-8 text-sm font-medium text-white shadow-lg shadow-primary/20 hover:from-primary/95 hover:to-blue-700/95 hover:shadow-primary/25 transition-all">
              Return to Home
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default NotFound;
