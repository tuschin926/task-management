export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "CANCELLED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const roleLabel: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  EMPLOYEE: "Nhân viên",
};
export const statusLabel: Record<TaskStatus, string> = {
  TODO: "Chờ làm",
  IN_PROGRESS: "Đang làm",
  REVIEW: "Chờ duyệt",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
export const priorityLabel: Record<Priority, string> = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
};

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department: string | null;
}

export interface UserBrief {
  id: string;
  fullName: string;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  progress: number;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  project: { id: string; code: string; name: string };
  creator: UserBrief;
  assignee: UserBrief | null;
  type: { id: string; name: string; color: string | null } | null;
  customer: { id: string; name: string; phone?: string | null } | null;
  site: {
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

export interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: UserBrief;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedBy: string;
  user: UserBrief;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  taskId: string | null;
  isRead: boolean;
  createdAt: string;
}