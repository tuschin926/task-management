import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { fmtDateTime } from "../utils";

interface Noti {
  id: string;
  title: string;
  body: string;
  taskId: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[]>([]);

  useEffect(() => {
    const load = () =>
      api
        .get("/notifications/unread-count")
        .then((r) => setCount(r.data.count))
        .catch(() => {});
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const r = await api.get("/notifications", { params: { limit: 10 } });
        setItems(r.data.items);
      } catch {
        /* bỏ qua */
      }
    }
  }

  async function click(n: Noti) {
    if (!n.isRead) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => {});
      setCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.taskId) navigate(`/tasks?taskId=${n.taskId}`);
  }

  async function readAll() {
    await api.post("/notifications/read-all").catch(() => {});
    setCount(0);
    setItems((cur) => cur.map((x) => ({ ...x, isRead: true })));
  }

  return (
    <div className="bell">
      <button className="bell-btn" onClick={toggle} aria-label="Thông báo">
        🔔
        {count > 0 && <span className="bell-badge">{count > 99 ? "99+" : count}</span>}
      </button>

      {open && (
        <>
          <div className="bell-backdrop" onClick={() => setOpen(false)} />
          <div className="bell-panel">
            <div className="bell-head">
              <strong>Thông báo</strong>
              <button className="link-btn" style={{ color: "#2563eb" }} onClick={readAll}>
                Đọc tất cả
              </button>
            </div>
            {items.length === 0 && <p className="muted" style={{ padding: 12 }}>Chưa có thông báo</p>}
            {items.map((n) => (
              <div
                key={n.id}
                className={n.isRead ? "bell-item" : "bell-item unread"}
                onClick={() => click(n)}
              >
                <div className="bell-title">{n.title}</div>
                <div className="small">{n.body}</div>
                <div className="muted small">{fmtDateTime(n.createdAt)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}