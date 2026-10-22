import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import { roleLabel, type Role } from "../types";

interface MenuItem {
  to: string;
  label: string;
  roles: Role[];
}

const menu: MenuItem[] = [
  { to: "/", label: "Tổng quan", roles: ["ADMIN", "MANAGER", "EMPLOYEE"] },
  { to: "/tasks", label: "Công việc", roles: ["ADMIN", "MANAGER", "EMPLOYEE"] },
  { to: "/projects", label: "Dự án", roles: ["ADMIN", "MANAGER"] },
  { to: "/users", label: "Người dùng", roles: ["ADMIN"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Trí Lực VT</div>
        <nav>
          {menu
            .filter((m) => m.roles.includes(user.role))
            .map((m) => (
              <NavLink
                key={m.to}
                to={m.to}
                end={m.to === "/"}
                className={({ isActive }) => (isActive ? "nav active" : "nav")}
              >
                {m.label}
              </NavLink>
            ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Quản lý công việc</div>
          <div className="topbar-user">
            <div>
              <strong>{user.fullName}</strong>
              <span className="muted"> · {roleLabel[user.role]}</span>
            </div>
            <button className="btn btn-outline" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}