import {
  priorityLabel,
  statusLabel,
  type Priority,
  type TaskStatus,
} from "../types";

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge st-${status}`}>{statusLabel[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`badge pr-${priority}`}>{priorityLabel[priority]}</span>;
}