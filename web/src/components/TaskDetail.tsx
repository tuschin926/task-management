import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import {
  statusLabel,
  type Attachment,
  type Comment,
  type HistoryRow,
  type Task,
  type TaskStatus,
} from "../types";
import { allowedNext, fileUrl, fmtDateTime, fmtSize, isOverdue } from "../utils";
import { PriorityBadge, StatusBadge } from "./Badges";
import Modal from "./Modal";

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="muted small">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function TaskDetail({
  taskId,
  onClose,
  onChanged,
  onEdit,
}: {
  taskId: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (task: Task) => void;
}) {
  const { user: me } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    try {
      const [t, c, f, h] = await Promise.all([
        api.get<Task>(`/tasks/${taskId}`),
        api.get<Comment[]>(`/tasks/${taskId}/comments`),
        api.get<Attachment[]>(`/tasks/${taskId}/attachments`),
        api.get<HistoryRow[]>(`/tasks/${taskId}/history`),
      ]);
      setTask(t.data);
      setProgress(t.data.progress);
      setComments(c.data);
      setFiles(f.data);
      setHistory(h.data);
    } catch (e) {
      setError(errMsg(e));
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Chạy một thao tác, rồi tải lại dữ liệu và báo cho trang cha
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await loadAll();
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const isManager = me?.role === "ADMIN" || me?.role === "MANAGER";
  const isAssignee = !!task && task.assigneeId === me?.id;
  const isOpen = !!task && task.status !== "DONE" && task.status !== "CANCELLED";
  const canUpload = isManager || isAssignee;
  const canProgress = (isManager || isAssignee) && isOpen;
  const next = task && me ? allowedNext(task, me) : [];

  function changeStatus(s: TaskStatus) {
    run(async () => {
      await api.patch(`/tasks/${taskId}/status`, { status: s, note: note || undefined });
      setNote("");
    });
  }

  function saveProgress() {
    run(() => api.patch(`/tasks/${taskId}/progress`, { progress }));
  }

  function sendComment() {
    const content = text.trim();
    if (!content) return;
    run(async () => {
      await api.post(`/tasks/${taskId}/comments`, { content });
      setText("");
    });
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    const fd = new FormData();
    picked.forEach((f) => fd.append("files", f));
    run(() => api.post(`/tasks/${taskId}/attachments`, fd));
  }

  function removeFile(id: string) {
    if (!confirm("Xóa file này?")) return;
    run(() => api.delete(`/attachments/${id}`));
  }

  async function deleteTask() {
    if (!confirm("Xóa công việc này? Bình luận, file và lịch sử cũng bị xóa.")) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      onChanged();
      onClose();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <Modal title={task ? `${task.code} · ${task.title}` : "Chi tiết công việc"} onClose={onClose} wide>
      {error && <div className="error">{error}</div>}
      {!task ? (
        <p className="muted">{error ? "" : "Đang tải..."}</p>
      ) : (
        <>
          <div className="row gap wrap">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.type && (
              <span className="tag" style={{ background: task.type.color ?? "#6b7280" }}>
                {task.type.name}
              </span>
            )}
            {isOverdue(task) && <span className="badge st-overdue">Quá hạn</span>}
            <div className="spacer" />
            {isManager && (
              <>
                <button className="btn btn-outline btn-sm" onClick={() => onEdit(task)}>Sửa</button>
                <button className="btn btn-danger btn-sm" onClick={deleteTask}>Xóa</button>
              </>
            )}
          </div>

          {task.description && <p className="desc">{task.description}</p>}

          <div className="info-grid">
            <Info label="Dự án">{task.project.name}</Info>
            <Info label="Người giao">{task.creator.fullName}</Info>
            <Info label="Người thực hiện">{task.assignee?.fullName ?? "Chưa giao"}</Info>
            <Info label="Hạn chót">
              <span className={isOverdue(task) ? "danger-text" : ""}>{fmtDateTime(task.dueDate)}</span>
            </Info>
            <Info label="Khách hàng">
              {task.customer ? `${task.customer.name}${task.customer.phone ? " · " + task.customer.phone : ""}` : "-"}
            </Info>
            <Info label="Địa điểm">
              {task.site ? (
                <>
                  {task.site.name}
                  <div className="muted small">{task.site.address}</div>
                  {task.site.latitude != null && task.site.longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${task.site.latitude},${task.site.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở bản đồ
                    </a>
                  )}
                </>
              ) : (
                "-"
              )}
            </Info>
            <Info label="Bắt đầu">{fmtDateTime(task.startedAt)}</Info>
            <Info label="Hoàn thành">{fmtDateTime(task.completedAt)}</Info>
          </div>

          {/* Tiến độ */}
          <div className="section">
            <h4>Tiến độ: {progress}%</h4>
            {canProgress ? (
              <div className="row gap">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-sm"
                  disabled={busy || progress === task.progress}
                  onClick={saveProgress}
                >
                  Lưu
                </button>
              </div>
            ) : (
              <div className="progress">
                <div className="progress-bar" style={{ width: `${task.progress}%` }} />
              </div>
            )}
          </div>

          {/* Đổi trạng thái */}
          {next.length > 0 && (
            <div className="section">
              <h4>Chuyển trạng thái</h4>
              <input
                placeholder="Ghi chú (không bắt buộc)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ width: "100%", marginBottom: 8 }}
              />
              <div className="row gap wrap">
                {next.map((s) => (
                  <button key={s} className="btn btn-outline btn-sm" disabled={busy} onClick={() => changeStatus(s)}>
                    → {statusLabel[s]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isManager && isAssignee && isOpen && (
            <p className="muted small">Bạn chỉ được chuyển sang "Đang làm" hoặc "Chờ duyệt". Quản lý sẽ duyệt hoàn thành.</p>
          )}

          {/* File đính kèm */}
          <div className="section">
            <h4>File đính kèm ({files.length})</h4>
            <div className="files">
              {files.map((f) => (
                <div key={f.id} className="file">
                  <a href={fileUrl(f.fileUrl)} target="_blank" rel="noreferrer">
                    {f.mimeType?.startsWith("image/") ? (
                      <img src={fileUrl(f.fileUrl)} alt={f.fileName} />
                    ) : (
                      <div className="file-icon">📄</div>
                    )}
                  </a>
                  <div className="fname" title={f.fileName}>{f.fileName}</div>
                  <div className="muted small">{f.user.fullName} · {fmtSize(f.sizeBytes)}</div>
                  {(isManager || f.uploadedBy === me?.id) && (
                    <button className="link-btn" onClick={() => removeFile(f.id)}>Xóa</button>
                  )}
                </div>
              ))}
            </div>
            {canUpload && (
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={onPick}
                disabled={busy}
              />
            )}
            {canUpload && <p className="muted small">Ảnh JPG/PNG/WEBP hoặc PDF, tối đa 5 file, mỗi file 10MB.</p>}
          </div>

          {/* Bình luận */}
          <div className="section">
            <h4>Bình luận ({comments.length})</h4>
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <strong>{c.user.fullName}</strong>
                <span className="muted small"> · {fmtDateTime(c.createdAt)}</span>
                <div>{c.content}</div>
              </div>
            ))}
            <div className="row gap" style={{ marginTop: 8 }}>
              <textarea
                rows={2}
                placeholder="Viết bình luận..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn" disabled={busy || !text.trim()} onClick={sendComment}>Gửi</button>
            </div>
          </div>

          {/* Lịch sử */}
          <details className="section">
            <summary><strong>Lịch sử trạng thái ({history.length})</strong></summary>
            {history.map((h) => (
              <div key={h.id} className="comment">
                <span className="muted small">{fmtDateTime(h.createdAt)}</span> · {h.user.fullName}:{" "}
                {h.fromStatus ? statusLabel[h.fromStatus] : "—"} → <strong>{statusLabel[h.toStatus]}</strong>
                {h.note && <div className="muted small">Ghi chú: {h.note}</div>}
              </div>
            ))}
          </details>
        </>
      )}
    </Modal>
  );
}