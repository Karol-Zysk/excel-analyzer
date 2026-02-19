import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { DEFAULT_APP_ROUTE } from "./config/navigation";
import { RequireAuth } from "./auth/RequireAuth";
import { AppLayout } from "./layout/AppLayout";
import { AccountingPage } from "./pages/AccountingPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FeatureInProgressPage } from "./pages/FeatureInProgressPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TeamAdminPage } from "./pages/TeamAdminPage";

export default function App() {
  const { session, displayName } = useAuth();

  return (
    <Routes>
      <Route
        path="/auth"
        element={session ? <Navigate to={DEFAULT_APP_ROUTE} replace /> : <AuthPage />}
      />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout userName={displayName} />}>
          <Route path="/" element={<Navigate to={DEFAULT_APP_ROUTE} replace />} />

          <Route path="/dashboard">
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<DashboardPage />} />
            <Route path="team" element={<FeatureInProgressPage title="Zespół" />} />
          </Route>

          <Route path="/accounting">
            <Route index element={<Navigate to="analyze" replace />} />
            <Route path="analyze" element={<AccountingPage />} />
          </Route>

          <Route path="/results">
            <Route index element={<Navigate to="archive" replace />} />
            <Route path="archive" element={<FeatureInProgressPage title="Archiwum" />} />
            <Route path="analysis" element={<FeatureInProgressPage title="Analiza" />} />
          </Route>

          <Route path="/account">
            <Route index element={<SettingsPage />} />
            <Route path="security" element={<FeatureInProgressPage title="Bezpieczeństwo konta" />} />
            <Route path="team" element={<TeamAdminPage />} />
          </Route>

          {/* Legacy redirects */}
          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/settings/account" element={<Navigate to="/account" replace />} />
          <Route path="/settings/security" element={<Navigate to="/account/security" replace />} />
          <Route path="/analytics" element={<Navigate to="/accounting/analyze" replace />} />
          <Route path="/analytics/imported-files" element={<Navigate to="/accounting/analyze" replace />} />
          <Route path="/analytics/summarized" element={<Navigate to="/accounting/analyze" replace />} />
          <Route path="/orders" element={<Navigate to="/results/archive" replace />} />
          <Route path="/integrations" element={<Navigate to={DEFAULT_APP_ROUTE} replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={session ? DEFAULT_APP_ROUTE : "/auth"} replace />} />
    </Routes>
  );
}
