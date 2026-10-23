import { useEffect, useState } from "react";
import { api } from "./api";
import type { Customer, Project, TaskType, UserRow } from "./types";

export interface Lookups {
  projects: Project[];
  users: UserRow[];
  types: TaskType[];
  customers: Customer[];
}

// Tải các danh sách dùng cho bộ lọc và form
export function useLookups(isManager: boolean): Lookups {
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [types, setTypes] = useState<TaskType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    api.get("/projects", { params: { limit: 100 } })
      .then((r) => setProjects(r.data.items))
      .catch(() => {});
    api.get("/task-types").then((r) => setTypes(r.data)).catch(() => {});
    if (isManager) {
      api.get("/users", { params: { limit: 100 } })
        .then((r) => setUsers(r.data.items.filter((u: UserRow) => u.isActive)))
        .catch(() => {});
      api.get("/customers", { params: { limit: 100 } })
        .then((r) => setCustomers(r.data.items))
        .catch(() => {});
    }
  }, [isManager]);

  return { projects, users, types, customers };
}