import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, errMsg } from "../api";
import Pagination from "../components/Pagination";
import ProjectForm from "../components/ProjectForm";
import { projectStatusLabel, type Project, type ProjectStatus } from "../types";
import { fmtDate } from "../utils";

const LIMIT = 10;

export default function Projects() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/projects", {
        params: { page, limit: LIMIT, search: search || undefined, status: status || undefined },
      })
      .then((r) => {
        if (cancelled) return;
        setItems(r.data.items);
        setTotal(r.data.total);
        setError("");
      })
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, search, status, reload]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div>
      <div className="page-head">
        <h2>Dự án</h2>
        <button className="btn" onClick={() => setCreating(true)}>+ Tạo dự án</button>
      </div>

      <form className="toolbar" onSubmit={onSearch}>
        <input
          placeholder="Tìm theo tên hoặc mã dự án..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">Tất cả trạng thái</option>
          {(Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => (
            <option key={s} value={s}>{projectStatusLabel[s]}</option>
          ))}
        </select>
        <button className="btn btn-outline" type="submit">Tìm</button>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên dự án</th>
              <th>Chủ dự án</th>
              <th>Trạng thái</th>
              <th>Thành viên</th>
              <th>Thời gian</th>
              <th style={{ width: 180 }}>Tiến độ</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="muted">Đang tải...</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="muted">Chưa có dự án</td></tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className="clickable" onClick={() => navigate(`/projects/${p.id}`)}>
                <td>{p.code}</td>
                <td><strong>{p.name}</strong></td>
                <td>{p.owner.fullName}</td>
                <td>{projectStatusLabel[p.status]}</td>
                <td>{p._count?.members ?? 0}</td>
                <td>{fmtDate(p.startDate)} → {fmtDate(p.endDate)}</td>
                <td>
                  <div className="progress">
                    <div className="progress-bar" style={{ width: `${p.taskStats?.percent ?? 0}%` }} />
                  </div>
                  <small>
                    {p.taskStats?.done ?? 0}/{p.taskStats?.total ?? 0} việc ({p.taskStats?.percent ?? 0}%)
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
      </div>

      {creating && (
        <ProjectForm
          project={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}