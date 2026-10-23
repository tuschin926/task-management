import type { TaskStatus, User } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(
    d.getMonth() + 1
  )}/${d.getFullYear()}`;
}

export function isOverdue(t: { dueDate: string | null; status: TaskStatus }) {
  return (
    !!t.dueDate &&
    new Date(t.dueDate) < new Date() &&
    t.status !== "DONE" &&
    t.status !== "CANCELLED"
  );
}

// Giống hệt backend
export const transitions: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["REVIEW", "TODO", "DONE", "CANCELLED"],
  REVIEW: ["DONE", "IN_PROGRESS", "CANCELLED"],
  DONE: ["IN_PROGRESS"],
  CANCELLED: ["TODO"],
};

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