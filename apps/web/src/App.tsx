import { Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./hooks/use-session.js";
import { AppShell } from "./components/layout/app-shell.js";
import { LoginPage } from "./pages/login.js";
import { HomePage } from "./pages/home.js";
import { AddTourPage } from "./pages/add-tour.js";
import { MyToursPage } from "./pages/my-tours.js";
import { TourDetailPage } from "./pages/tour-detail.js";
import { WorklistPage } from "./pages/worklist.js";
import { AdminPage } from "./pages/admin.js";
import { SettlementPage } from "./pages/settlement.js";
import { DelegationsPage } from "./pages/delegations.js";
import { SettlementsPage } from "./pages/settlements.js";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <div className="p-8 text-sm text-steel-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Protected><HomePage /></Protected>} />
        <Route path="/add-tour" element={<Protected><AddTourPage /></Protected>} />
        <Route path="/my-tours" element={<Protected><MyToursPage /></Protected>} />
        <Route path="/tours/:id" element={<Protected><TourDetailPage /></Protected>} />
        <Route path="/settlements" element={<Protected><SettlementsPage /></Protected>} />
        <Route path="/tours/:id/settlement" element={<Protected><SettlementPage /></Protected>} />
        <Route
          path="/worklists/forwarding"
          element={<Protected><WorklistPage endpoint="forwarding" title="Manage Tour Forwarded" /></Protected>}
        />
        <Route
          path="/worklists/recommendation"
          element={<Protected><WorklistPage endpoint="recommendation" title="Recommendation Worklist" /></Protected>}
        />
        <Route
          path="/worklists/approval"
          element={<Protected><WorklistPage endpoint="approval" title="Manage Tour Approval" /></Protected>}
        />
        <Route path="/delegations" element={<Protected><DelegationsPage /></Protected>} />
        <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SessionProvider>
  );
}
