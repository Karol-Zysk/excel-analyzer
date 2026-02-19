import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { LogoLoadingScreen } from "../components/LogoLoadingScreen";
import { useAuth } from "./AuthProvider";

const MIN_BOOT_LOADER_MS = 4000;

export function RequireAuth() {
  const { session, isLoading } = useAuth();
  const location = useLocation();
  const [minimumDelayPassed, setMinimumDelayPassed] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMinimumDelayPassed(true);
    }, MIN_BOOT_LOADER_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const shouldKeepShowingLoader = Boolean(session) && !minimumDelayPassed;

  if (isLoading || shouldKeepShowingLoader) {
    return <LogoLoadingScreen message="Trwa sprawdzanie sesji..." />;
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
