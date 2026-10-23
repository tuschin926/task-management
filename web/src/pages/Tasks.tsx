import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import { PriorityBadge, StatusBadge } from "../components/Badges";
import Pagination from "../components/Pagination";
import TaskDetail from "../components/TaskDetail";
import TaskForm from "../components/TaskForm";
import { useLookups } from "../hooks";
import { priorityLabel, statusLabel, type Priority, type Task, type TaskStatus } from "../types";
import { fmtDateTime, isOverdue } from "../utils";

const LIST_LIMIT = 10;
const KANBAN_COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];

export default function Tasks() {
  const { user } = useAuth();
  const isManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const lookups = useLookups(isManager);
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<"list" | "kanban">("list");
  const [items, setItems] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [projectId, setProjectId] = useState(searchParams.get("projectId") ?? "");
  const [mine, setMine] = useState(false);
  const [overdue, setOverdue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Task | "new" | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const isList = view === "list";

  // Mở chi tiết khi đến từ chuông thông báo (/tasks?taskId=...)
useEffect(() => {
  const t = searchParams.get("taskId");
  if (t) setOpenId(t);
}, [searchParams]);

function closeDetail() {
  setOpenId(null);
  if (searchParams.has("taskId")) {
    const p = new URLSearchParams(searchParams);
    p.delete("taskId");
    setSearchParams(p, { replace: true });
  }
}

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/tasks", {
        params: {
          page: isList ? page : 1,
          limit: isList ? LIST_LIMIT : 100,
          search: search || undefined,
          status: isList ? status || undefined : undefined,
          priority: priority || undefined,
          projectId: projectId || undefined,
          mine: mine ? "true" : undefined,
          overdue: overdue ? "true" : undefined,
        },
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
  }, [isList, page, search, status, priority, projectId, mine, overdue, reload]);

  function refresh() {
    setReload((n) => n + 1);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  // Đổi một bộ lọc thì về trang 1
  function filter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  async function moveTask(id: string, to: TaskStatus) {
    const t = items.find((i) => i.id === id);
    if (!t || t.status === to) return;
    setError("");
    try {
      await api.patch(`/tasks/${id}/status`, { status: to });
      refresh();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2>Công việc</h2>
        <div className="row gap">
          <div className="seg">
            <button className={isList ? "on" : ""} onClick={() => setView("list")}>Bảng</button>
            <button className={!isList ? "on" : ""} onClick={() => setView("kanban")}>Kanban</button>
          </div>
          {isManager && (
            <button className="btn" onClick={() => setForm("new")}>+ Tạo công việc</button>
          )}
        </div>
      </div>

      <form className="toolbar" onSubmit={onSearch}>
        <input
          placeholder="Tìm theo tiêu đề hoặc mã..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {isList && (
          <select value={status} onChange={(e) => filter(setStatus)(e.target.value)}>
            <option value="">Mọi trạng thái</option>
            {(Object.keys(statusLabel) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>{statusLabel[s]}</option>
            ))}
          </select>
        )}
        <select value={priority} onChange={(e) => filter(setPriority)(e.target.value)}>
          <option value="">Mọi mức ưu tiên</option>
          {(Object.keys(priorityLabel) as Priority[]).map((p) => (
            <option key={p} value={p}>{priorityLabel[p]}</option>
          ))}
        </select>
        <select value={projectId} onChange={(e) => filter(setProjectId)(e.target.value)}>
          <option value="">Mọi dự án</option>
          {lookups.projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => filter(setMine)(e.target.checked)} />
          Việc của tôi
        </label>
        <label className="check">
          <input type="checkbox" checked={overdue} onChange={(e) => filter(setOverdue)(e.target.checked)} />
          Quá hạn
        </label>
        <button className="btn btn-outline" type="submit">Tìm</button>
      </form>

      {error && <div className="error">{error}</div>}

      {isList ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Công việc</th>
                <th>Dự án</th>
                <th>Người làm</th>
                <th>Hạn chót</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
                <th style={{ width: 110 }}>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="muted">Đang tải...</td></tr>}
              {!loading && items.length === 0 && (
                <tr><td colSpan={8} className="muted">Không có công việc</td></tr>
              )}
              {items.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => setOpenId(t.id)}>
                  <td>{t.code}</td>
                  <td>
                    <span className="dot" style={{ background: t.type?.color ?? "#9ca3af" }} />
                    <strong>{t.title}</strong>
                    {t.customer && <div className="muted small">{t.customer.name}</div>}
                  </td>
                  <td>{t.project.name}</td>
                  <td>{t.assignee?.fullName ?? "-"}</td>
                  <td className={isOverdue(t) ? "danger-text" : ""}>{fmtDateTime(t.dueDate)}</td>
                  <td><PriorityBadge priority={t.priority} /></td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>
                    <div className="progress">
                      <div className="progress-bar" style={{ width: `${t.progress}%` }} />
                    </div>
                    <small>{t.progress}%</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} total={total} limit={LIST_LIMIT} onChange={setPage} />
        </div>
      ) : (
        <>
          <p className="muted small">
            Kéo thẻ sang cột khác để đổi trạng thái (theo đúng quy tắc phân quyền). Hiển thị tối đa 100 việc, không gồm việc đã hủy.
          </p>
          <div className="kanban">
            {KANBAN_COLUMNS.map((col) => {
              const list = items.filter((t) => t.status === col);
              return (
                <div
                  key={col}
                  className="kcol"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) moveTask(dragId, col);
                    setDragId(null);
                  }}
                >
                  <div className="kcol-head">
                    <StatusBadge status={col} /> <span className="muted">{list.length}</span>
                  </div>
                  {list.map((t) => (
                    <div
                      key={t.id}
                      className="kcard"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", t.id);
                        setDragId(t.id);
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setOpenId(t.id)}
                    >
                      <div className="muted small">{t.code}</div>
                      <div className="ktitle">{t.title}</div>
                      <div className="row gap wrap">
                        <PriorityBadge priority={t.priority} />
                        {t.type && <span className="dot" style={{ background: t.type.color ?? "#9ca3af" }} title={t.type.name} />}
                      </div>
                      <div className="muted small" style={{ marginTop: 6 }}>
                        {t.assignee?.fullName ?? "Chưa giao"}
                      </div>
                      <div className={isOverdue(t) ? "danger-text small" : "muted small"}>
                        {t.dueDate ? `Hạn: ${fmtDateTime(t.dueDate)}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      {openId && (
        <TaskDetail
          taskId={openId}
          onClose={closeDetail}
          onChanged={refresh}
          onEdit={(t) => {
            closeDetail();
            setForm(t);
          }}
        />
      )}

      {form && (
        <TaskForm
          task={form === "new" ? null : form}
          lookups={lookups}
          defaultProjectId={projectId || undefined}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}