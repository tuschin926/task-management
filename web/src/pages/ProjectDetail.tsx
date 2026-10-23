import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import ProjectForm from "../components/ProjectForm";
import { projectStatusLabel, roleLabel, type Project, type Role, type UserRow } from "../types";
import { fmtDate } from "../utils";

interface Detail extends Project {
  members: { id: string; user: { id: string; fullName: string; email: string; role: Role } }[];
}

interface Stats {
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  cancelled: number;
  overdue: number;
  percent: number;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Detail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [addId, setAddId] = useState("");
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [p, s] = await Promise.all([
          api.get<Detail>(`/projects/${id}`),
          api.get<{ items: Stats[] }>("/reports/projects", { params: { projectId: id } }),
        ]);
        if (cancelled) return;
        setProject(p.data);
        setStats(s.data.items[0] ?? null);
        setError("");
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  useEffect(() => {
    api.get("/users", { params: { limit: 100 } })
      .then((r) => setUsers(r.data.items.filter((u: UserRow) => u.isActive)))
      .catch(() => {});
  }, []);

  if (error && !project) return <div className="error">{error}</div>;
  if (!project) return <p className="muted">Đang tải...</p>;

  const canManage = me?.role === "ADMIN" || project.owner.id === me?.id;
  const memberIds = new Set(project.members.map((m) => m.user.id));
  const candidates = users.filter((u) => !memberIds.has(u.id));

  async function act(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      setReload((n) => n + 1);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function addMember() {
    if (!addId) return;
    await act(() => api.post(`/projects/${id}/members`, { userId: addId }));
    setAddId("");
  }

  async function removeProject() {
    if (!confirm("Xóa dự án này? (Chỉ xóa được khi chưa có công việc)")) return;
    try {
      await api.delete(`/projects/${id}`);
      navigate("/projects", { replace: true });
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div>
      <p><Link to="/projects">← Danh sách dự án</Link></p>

      <div className="page-head">
        <h2>{project.code} · {project.name}</h2>
        <div className="row gap">
          <Link className="btn btn-outline" to={`/tasks?projectId=${project.id}`}>Xem công việc</Link>
          {canManage && <button className="btn btn-outline" onClick={() => setEditing(true)}>Sửa</button>}
          {me?.role === "ADMIN" && <button className="btn btn-danger" onClick={removeProject}>Xóa</button>}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="info-grid">
          <div><div className="muted small">Trạng thái</div>{projectStatusLabel[project.status]}</div>
          <div><div className="muted small">Chủ dự án</div>{project.owner.fullName}</div>
          <div><div className="muted small">Bắt đầu</div>{fmtDate(project.startDate)}</div>
          <div><div className="muted small">Kết thúc</div>{fmtDate(project.endDate)}</div>
        </div>
        {project.description && <p>{project.description}</p>}
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="stat-value">{stats?.total ?? 0}</div><div className="stat-label">Tổng công việc</div></div>
        <div className="stat"><div className="stat-value">{(stats?.todo ?? 0) + (stats?.inProgress ?? 0) + (stats?.review ?? 0)}</div><div className="stat-label">Đang mở</div></div>
        <div className="stat ok"><div className="stat-value">{stats?.done ?? 0}</div><div className="stat-label">Hoàn thành</div></div>
        <div className="stat danger"><div className="stat-value">{stats?.overdue ?? 0}</div><div className="stat-label">Quá hạn</div></div>
        <div className="stat ok"><div className="stat-value">{stats?.percent ?? 0}%</div><div className="stat-label">Tiến độ</div></div>
      </div>

      <div className="card">
        <h3>Thành viên ({project.members.length})</h3>
        <table>
          <thead>
            <tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th></th></tr>
          </thead>
          <tbody>
            {project.members.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.user.fullName}
                  {m.user.id === project.owner.id && <span className="tag" style={{ background: "#2563eb", marginLeft: 8 }}>Chủ dự án</span>}
                </td>
                <td>{m.user.email}</td>
                <td>{roleLabel[m.user.role]}</td>
                <td>
                  {canManage && m.user.id !== project.owner.id && (
                    <button
                      className="link-btn"
                      onClick={() => confirm("Xóa thành viên này?") && act(() => api.delete(`/projects/${id}/members/${m.user.id}`))}
                    >
                      Xóa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {canManage && (
          <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
            <select value={addId} onChange={(e) => setAddId(e.target.value)}>
              <option value="">-- Chọn người để thêm --</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({roleLabel[u.role]})</option>
              ))}
            </select>
            <button className="btn" onClick={addMember} disabled={!addId}>Thêm thành viên</button>
          </div>
        )}
      </div>

      {editing && (
        <ProjectForm
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}