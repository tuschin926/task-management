import { useEffect, useState, type FormEvent } from "react";
import { api, errMsg } from "../api";
import { useAuth } from "../auth";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { roleLabel, type Role, type UserRow } from "../types";
import { fmtDate } from "../utils";

const LIMIT = 10;

export default function Users() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/users", {
        params: { page, limit: LIMIT, search: search || undefined, role: role || undefined },
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
  }, [page, search, role, reload]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div>
      <div className="page-head">
        <h2>Người dùng</h2>
        <button className="btn" onClick={() => setEditing("new")}>
          + Thêm người dùng
        </button>
      </div>

      <form className="toolbar" onSubmit={onSearch}>
        <input
          placeholder="Tìm theo tên hoặc email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value);
          }}
        >
          <option value="">Tất cả vai trò</option>
          {(Object.keys(roleLabel) as Role[]).map((r) => (
            <option key={r} value={r}>{roleLabel[r]}</option>
          ))}
        </select>
        <button className="btn btn-outline" type="submit">Tìm</button>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Điện thoại</th>
              <th>Vai trò</th>
              <th>Phòng ban</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="muted">Đang tải...</td></tr>}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="muted">Không có dữ liệu</td></tr>
            )}
            {items.map((u) => (
              <tr key={u.id}>
                <td><strong>{u.fullName}</strong></td>
                <td>{u.email}</td>
                <td>{u.phone ?? "-"}</td>
                <td>{roleLabel[u.role]}</td>
                <td>{u.department ?? "-"}</td>
                <td>
                  <span className={u.isActive ? "badge st-DONE" : "badge st-CANCELLED"}>
                    {u.isActive ? "Hoạt động" : "Đã khóa"}
                  </span>
                </td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditing(u)}>
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
      </div>

      {editing && (
        <UserForm
          target={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function UserForm({
  target,
  onClose,
  onSaved,
}: {
  target: UserRow | "new";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: me } = useAuth();
  const u = target === "new" ? null : target;
  const isSelf = !!u && u.id === me?.id;

  const [email, setEmail] = useState(u?.email ?? "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(u?.fullName ?? "");
  const [phone, setPhone] = useState(u?.phone ?? "");
  const [role, setRole] = useState<Role>(u?.role ?? "EMPLOYEE");
  const [department, setDepartment] = useState(u?.department ?? "");
  const [isActive, setIsActive] = useState(u?.isActive ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (u) {
        await api.patch(`/users/${u.id}`, {
          fullName,
          phone: phone || null,
          department: department || null,
          password: password || undefined,
          // Backend không cho tự đổi vai trò / tự khóa chính mình
          ...(isSelf ? {} : { role, isActive }),
        });
      } else {
        await api.post("/users", {
          email,
          password,
          fullName,
          phone: phone || undefined,
          role,
          department: department || undefined,
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
    <Modal title={u ? "Sửa người dùng" : "Thêm người dùng"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!u} required />

        <label>{u ? "Đặt lại mật khẩu (bỏ trống nếu không đổi)" : "Mật khẩu"}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required={!u}
          placeholder="Tối thiểu 6 ký tự"
        />

        <label>Họ tên</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />

        <div className="form-row">
          <div>
            <label>Điện thoại</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label>Phòng ban</label>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
        </div>

        <label>Vai trò</label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
          {(Object.keys(roleLabel) as Role[]).map((r) => (
            <option key={r} value={r}>{roleLabel[r]}</option>
          ))}
        </select>

        {u && (
          <label className="check">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSelf}
            />
            Tài khoản đang hoạt động
          </label>
        )}
        {isSelf && <p className="muted small">Bạn không thể tự đổi vai trò hoặc tự khóa tài khoản của mình.</p>}

        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Hủy</button>
          <button className="btn" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
        </div>
      </form>
    </Modal>
  );
}