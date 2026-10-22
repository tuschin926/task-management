import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Placeholder from "./pages/Placeholder";
import type { ReactNode } from "react";
import type { Role } from "./types";

function Protected({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Placeholder title="Công việc" />} />
        <Route
          path="projects"
          element={
            <Protected roles={["ADMIN", "MANAGER"]}>
              <Placeholder title="Dự án" />
            </Protected>
          }
        />
        <Route
          path="users"
          element={
            <Protected roles={["ADMIN"]}>
              <Placeholder title="Người dùng" />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}