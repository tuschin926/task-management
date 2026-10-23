import type { TaskStatus, User } from "./types";

export const fileUrl = (path: string) => `${import.meta.env.VITE_API_URL}${path}`;

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN") : "-";

export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("vi-VN", { hour12: false }) : "-";

// ISO -> giá trị cho <input type="datetime-local">
export function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function fmtSize(bytes?: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function isOverdue(t: { dueDate: string | null; status: TaskStatus }) {
  return (
    !!t.dueDate &&
    new Date(t.dueDate) < new Date() &&
    t.status !== "DONE" &&
    t.status !== "CANCELLED"
  );
}

// Luồng chuyển trạng thái (giống hệt backend)
export const transitions: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["REVIEW", "TODO", "DONE", "CANCELLED"],
  REVIEW: ["DONE", "IN_PROGRESS", "CANCELLED"],
  DONE: ["IN_PROGRESS"],
  CANCELLED: ["TODO"],
};

// Các trạng thái mà user này được chuyển tới
export function allowedNext(
  task: { status: TaskStatus; assigneeId: string | null },
  user: User
): TaskStatus[] {
  const base = transitions[task.status];
  if (user.role !== "EMPLOYEE") return base;
  if (task.assigneeId !== user.id) return [];
  if (task.status === "DONE" || task.status === "CANCELLED") return [];
  return base.filter((s) => s === "IN_PROGRESS" || s === "REVIEW");
}