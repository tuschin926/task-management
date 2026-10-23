import { useEffect, useState, type FormEvent } from "react";
import { api, errMsg } from "../api";
import type { Lookups } from "../hooks";
import {
  priorityLabel,
  roleLabel,
  type Priority,
  type Site,
  type Task,
} from "../types";
import { toLocalInput } from "../utils";
import Modal from "./Modal";

export default function TaskForm({
  task,
  lookups,
  defaultProjectId,
  onClose,
  onSaved,
}: {
  task: Task | null;
  lookups: Lookups;
  defaultProjectId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(toLocalInput(task?.dueDate));
  const [projectId, setProjectId] = useState(task?.projectId ?? defaultProjectId ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [typeId, setTypeId] = useState(task?.typeId ?? "");
  const [customerId, setCustomerId] = useState(task?.customerId ?? "");
  const [siteId, setSiteId] = useState(task?.siteId ?? "");
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Địa điểm lọc theo khách hàng đã chọn
  useEffect(() => {
    api.get("/sites", { params: { customerId: customerId || undefined } })
      .then((r) => setSites(r.data))
      .catch(() => setSites([]));
  }, [customerId]);

  const selectedType = lookups.types.find((t) => t.id === typeId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const dueIso = dueDate ? new Date(dueDate).toISOString() : null;
      if (task) {
        await api.patch(`/tasks/${task.id}`, {
          title,
          description: description || null,
          priority,
          dueDate: dueIso,
          assigneeId: assigneeId || null,
          typeId: typeId || null,
          customerId: customerId || null,
          siteId: siteId || null,
        });
      } else {
        await api.post("/tasks", {
          title,
          description: description || undefined,
          priority,
          dueDate: dueIso ?? undefined,
          projectId,
          assigneeId: assigneeId || undefined,
          typeId: typeId || undefined,
          customerId: customerId || undefined,
          siteId: siteId || undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={task ? `Sửa ${task.code}` : "Tạo công việc"} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <label>Tiêu đề</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />

        <label>Mô tả</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="form-row">
          <div>
            <label>Dự án</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required disabled={!!task}>
              <option value="">-- Chọn dự án --</option>
              {lookups.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Người thực hiện</label>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">-- Chưa giao --</option>
              {lookups.users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} ({roleLabel[u.role]})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Loại công việc</label>
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">-- Không chọn --</option>
              {lookups.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.slaHours ? ` (SLA ${t.slaHours}h)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Độ ưu tiên</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(priorityLabel) as Priority[]).map((p) => (
                <option key={p} value={p}>{priorityLabel[p]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div>
            <label>Khách hàng</label>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setSiteId("");
              }}
            >
              <option value="">-- Không chọn --</option>
              {lookups.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Địa điểm</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">-- Không chọn --</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        <label>Hạn chót</label>
        <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        {!task && selectedType?.slaHours && !dueDate && (
          <p className="muted small">
            Để trống: hệ thống tự đặt hạn chót = bây giờ + {selectedType.slaHours} giờ (SLA của loại này).
          </p>
        )}

        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
          <button className="btn" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </div>
      </form>
    </Modal>
  );
}