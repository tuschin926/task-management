import { useEffect, useState, type FormEvent } from "react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import Modal from "./Modal";
import {
  projectStatusLabel,
  roleLabel,
  type Project,
  type ProjectStatus,
  type UserRow,
} from "../types";

export default function ProjectForm({
  project,
  onClose,
  onSaved,
}: {
  project: Project | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: me } = useAuth();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "PLANNING");
  const [startDate, setStartDate] = useState(project?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(project?.endDate?.slice(0, 10) ?? "");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Khi tạo mới: cần danh sách người dùng để chọn thành viên
  useEffect(() => {
    if (project) return;
    api.get("/users", { params: { limit: 100 } })
      .then((r) => setUsers(r.data.items.filter((u: UserRow) => u.isActive)))
      .catch(() => {});
  }, [project]);

  function toggleMember(id: string) {
    setMemberIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (project) {
        await api.patch(`/projects/${project.id}`, {
          name,
          description: description || null,
          status,
          startDate: startDate || null,
          endDate: endDate || null,
        });
      } else {
        await api.post("/projects", {
          name,
          description: description || undefined,
          status,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          ownerId: me?.role === "ADMIN" && ownerId ? ownerId : undefined,
          memberIds,
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
    <Modal title={project ? "Sửa dự án" : "Tạo dự án"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Tên dự án</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required />

        <label>Mô tả</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />

        <label>Trạng thái</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
          {(Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => (
            <option key={s} value={s}>{projectStatusLabel[s]}</option>
          ))}
        </select>

        <div className="form-row">
          <div>
            <label>Ngày bắt đầu</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label>Ngày kết thúc</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {!project && me?.role === "ADMIN" && (
          <>
            <label>Chủ dự án (bỏ trống = chính bạn)</label>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">-- Tôi --</option>
              {users
                .filter((u) => u.role !== "EMPLOYEE")
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
            </select>
          </>
        )}

        {!project && (
          <>
            <label>Thành viên</label>
            <div className="member-list">
              {users.map((u) => (
                <label key={u.id} className="check">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                  />
                  {u.fullName} <span className="muted small">({roleLabel[u.role]})</span>
                </label>
              ))}
            </div>
          </>
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