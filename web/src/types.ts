export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "CANCELLED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";

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
export const projectStatusLabel: Record<ProjectStatus, string> = {
  PLANNING: "Lập kế hoạch",
  ACTIVE: "Đang chạy",
  ON_HOLD: "Tạm dừng",
  COMPLETED: "Hoàn thành",
};

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department: string | null;
}

export interface UserRow extends User {
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface UserBrief {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface TaskType {
  id: string;
  code: string;
  name: string;
  slaHours: number | null;
  color: string | null;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  customerId?: string | null;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  owner: { id: string; fullName: string };
  _count?: { members: number; tasks: number };
  taskStats?: { total: number; done: number; percent: number };
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
  createdAt: string;
  projectId: string;
  creatorId: string;
  assigneeId: string | null;
  typeId: string | null;
  customerId: string | null;
  siteId: string | null;
  project: { id: string; code: string; name: string; ownerId: string };
  creator: UserBrief;
  assignee: UserBrief | null;
  type: TaskType | null;
  customer: Customer | null;
  site: Site | null;
  _count: { comments: number; attachments: number };
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
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string;
  createdAt: string;
  user: UserBrief;
}

export interface HistoryRow {
  id: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  note: string | null;
  createdAt: string;
  user: UserBrief;
}