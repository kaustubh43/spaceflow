import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { Dashboard } from "@/pages/Dashboard";
import { ProjectEditor } from "@/pages/ProjectEditor";
import { SharedView } from "@/pages/SharedView";
import { Loader2 } from "lucide-react";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="flex h-full items-center justify-center text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const init = useAuth((s) => s.init);
  const user = useAuth((s) => s.user);
  const loadSettings = useSettings((s) => s.load);
  useEffect(() => {
    init();
  }, [init]);
  // (re)load app settings once authenticated; also applies the saved theme
  useEffect(() => {
    loadSettings();
  }, [loadSettings, user]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {/* public, no-auth view-only client link */}
      <Route path="/shared/:token" element={<SharedView />} />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <Protected>
            <ProjectEditor />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
