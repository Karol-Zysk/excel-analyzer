import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { DEFAULT_APP_ROUTE } from "./config/navigation";
import { RequireAuth } from "./auth/RequireAuth";
import { AppLayout } from "./layout/AppLayout";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FeatureInProgressPage } from "./pages/FeatureInProgressPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SettingsPage } from "./pages/SettingsPage";

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
            <Route path="team" element={<FeatureInProgressPage title="Zespol" />} />
          </Route>

          <Route path="/analytics">
            <Route index element={<Navigate to="imported-files" replace />} />
            <Route path="imported-files" element={<AnalyticsPage />} />
            <Route path="summarized" element={<FeatureInProgressPage title="Podsumowania analityczne" />} />
          </Route>

          <Route path="/orders">
            <Route index element={<Navigate to="list" replace />} />
            <Route path="list" element={<OrdersPage />} />
            <Route path="archive" element={<FeatureInProgressPage title="Archiwum zlecen" />} />
          </Route>

          <Route path="/account">
            <Route index element={<SettingsPage />} />
            <Route path="security" element={<FeatureInProgressPage title="Bezpieczenstwo konta" />} />
          </Route>

          <Route path="/settings" element={<Navigate to="/account" replace />} />
          <Route path="/settings/account" element={<Navigate to="/account" replace />} />
          <Route path="/settings/security" element={<Navigate to="/account/security" replace />} />

          <Route path="/integrations">
            <Route index element={<Navigate to="connections" replace />} />
            <Route path="connections" element={<IntegrationsPage />} />
            <Route path="api-keys" element={<FeatureInProgressPage title="Klucze API" />} />
            <Route path="webhooks" element={<FeatureInProgressPage title="Webhooks" />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={session ? DEFAULT_APP_ROUTE : "/auth"} replace />} />
    </Routes>
  );
}
