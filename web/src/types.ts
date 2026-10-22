export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  department: string | null;
}

export const roleLabel: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  EMPLOYEE: "Nhân viên",
};