import type { Priority, TaskStatus } from "./types";

export const colors = {
  primary: "#2563eb",
  bg: "#f3f4f6",
  card: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  danger: "#dc2626",
  ok: "#16a34a",
};

export const statusStyle: Record<TaskStatus, { bg: string; fg: string }> = {
  TODO: { bg: "#e5e7eb", fg: "#374151" },
  IN_PROGRESS: { bg: "#dbeafe", fg: "#1d4ed8" },
  REVIEW: { bg: "#fef3c7", fg: "#b45309" },
  DONE: { bg: "#dcfce7", fg: "#15803d" },
  CANCELLED: { bg: "#f3f4f6", fg: "#9ca3af" },
};

export const priorityStyle: Record<Priority, { bg: string; fg: string }> = {
  LOW: { bg: "#f3f4f6", fg: "#6b7280" },
  MEDIUM: { bg: "#e0f2fe", fg: "#0369a1" },
  HIGH: { bg: "#ffedd5", fg: "#c2410c" },
  URGENT: { bg: "#fee2e2", fg: "#b91c1c" },
};