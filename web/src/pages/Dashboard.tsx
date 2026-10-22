import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";

interface Overview {
  total: number;
  status: Record<string, number>;
  priority: Record<string, number>;
  overdue: number;
  dueSoon: number;
  completionRate: number;
  onTimeRate: number;
}

interface TimelinePoint {
  date: string;
  created: number;
  completed: number;
}

interface EmployeeRow {
  user: { id: string; fullName: string; department: string | null };
  assigned: number;
  done: number;
  overdue: number;
  onTimeRate: number;
  avgHours: number | null;
}

interface ProjectRow {
  project: { id: string; code: string; name: string };
  total: number;
  done: number;
  overdue: number;
  percent: number;
}

const statusLabel: Record<string, string> = {
  TODO: "Chờ làm",
  IN_PROGRESS: "Đang làm",
  REVIEW: "Chờ duyệt",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

export default function Dashboard() {
  const { user } = useAuth();
  const isManager = user?.role !== "EMPLOYEE";

  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const ov = await api.get<Overview>("/reports/overview");
        setOverview(ov.data);

        if (isManager) {
          const [tl, emp, pro] = await Promise.all([
            api.get<{ items: TimelinePoint[] }>("/reports/timeline", {
              params: { days: 14 },
            }),
            api.get<{ items: EmployeeRow[] }>("/reports/employees"),
            api.get<{ items: ProjectRow[] }>("/reports/projects"),
          ]);
          setTimeline(
            tl.data.items.map((p) => ({ ...p, date: p.date.slice(5) }))
          );
          setEmployees(emp.data.items);
          setProjects(pro.data.items);
        }
      } catch (e) {
        setError(errMsg(e));
      }
    }
    load();
  }, [isManager]);

  if (error) return <div className="error">{error}</div>;
  if (!overview) return <p className="muted">Đang tải...</p>;

  const statusData = Object.entries(overview.status).map(([k, v]) => ({
    name: statusLabel[k],
    value: v,
  }));

  return (
    <div>
      <h2>Tổng quan</h2>

      <div className="stat-grid">
        <Stat label="Tổng công việc" value={overview.total} />
        <Stat label="Quá hạn" value={overview.overdue} tone="danger" />
        <Stat label="Sắp đến hạn (24h)" value={overview.dueSoon} tone="warn" />
        <Stat label="Tỷ lệ hoàn thành" value={`${overview.completionRate}%`} tone="ok" />
        <Stat label="Xong đúng hạn" value={`${overview.onTimeRate}%`} tone="ok" />
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Công việc theo trạng thái</h3>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" name="Số việc" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {isManager && (
          <div className="card">
            <h3>Việc tạo mới / hoàn thành (14 ngày)</h3>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="created" name="Tạo mới" stroke="#2563eb" strokeWidth={2} />
                  <Line type="monotone" dataKey="completed" name="Hoàn thành" stroke="#16a34a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {isManager && (
        <>
          <div className="card">
            <h3>Tiến độ dự án</h3>
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Dự án</th>
                  <th>Số việc</th>
                  <th>Hoàn thành</th>
                  <th>Quá hạn</th>
                  <th style={{ width: 200 }}>Tiến độ</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 && (
                  <tr><td colSpan={6} className="muted">Chưa có dữ liệu</td></tr>
                )}
                {projects.map((p) => (
                  <tr key={p.project.id}>
                    <td>{p.project.code}</td>
                    <td>{p.project.name}</td>
                    <td>{p.total}</td>
                    <td>{p.done}</td>
                    <td>{p.overdue}</td>
                    <td>
                      <div className="progress">
                        <div className="progress-bar" style={{ width: `${p.percent}%` }} />
                      </div>
                      <small>{p.percent}%</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Hiệu suất nhân viên</h3>
            <table>
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Được giao</th>
                  <th>Hoàn thành</th>
                  <th>Quá hạn</th>
                  <th>Đúng hạn</th>
                  <th>TB xử lý (giờ)</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr><td colSpan={6} className="muted">Chưa có dữ liệu</td></tr>
                )}
                {employees.map((r) => (
                  <tr key={r.user.id}>
                    <td>{r.user.fullName}</td>
                    <td>{r.assigned}</td>
                    <td>{r.done}</td>
                    <td>{r.overdue}</td>
                    <td>{r.onTimeRate}%</td>
                    <td>{r.avgHours ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "danger" | "warn" | "ok";
}) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}