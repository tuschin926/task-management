import { Router } from "express";
import { Prisma, TaskStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../prisma";
import { authenticate, AuthUser, requireRole } from "../../middlewares/auth";
import { taskVisibleWhere } from "../../utils/access";

const router = Router();
router.use(authenticate);

// ---------- Helper ----------
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

const filterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(), // ngày cuối, đã bao gồm cả ngày đó
  projectId: z.string().optional(),
});

// Điều kiện lọc: quyền xem + dự án + khoảng ngày tạo việc
function buildWhere(
  user: AuthUser,
  q: z.infer<typeof filterSchema>
): Prisma.TaskWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (q.from) createdAt.gte = q.from;
  if (q.to) createdAt.lt = new Date(q.to.getTime() + DAY);

  return {
    AND: [
      taskVisibleWhere(user),
      q.projectId ? { projectId: q.projectId } : {},
      q.from || q.to ? { createdAt } : {},
    ],
  };
}

const openStatuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW"];

// ---------- GET /api/reports/overview ----------
// Thẻ số liệu cho dashboard. Nhân viên chỉ thấy số liệu việc của mình.
router.get("/overview", async (req, res, next) => {
  try {
    const q = filterSchema.parse(req.query);
    const where = buildWhere(req.user!, q);
    const now = new Date();
    const open = { status: { in: openStatuses } };

    const [byStatus, byPriority, overdue, dueSoon, doneTasks] = await Promise.all([
      prisma.task.groupBy({ by: ["status"], where, _count: true }),
      prisma.task.groupBy({ by: ["priority"], where, _count: true }),
      prisma.task.count({ where: { AND: [where, open, { dueDate: { lt: now } }] } }),
      prisma.task.count({
        where: {
          AND: [
            where,
            open,
            { dueDate: { gte: now, lte: new Date(now.getTime() + DAY) } },
          ],
        },
      }),
      prisma.task.findMany({
        where: { AND: [where, { status: "DONE" }] },
        select: { dueDate: true, completedAt: true },
      }),
    ]);

    const status: Record<string, number> = {
      TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0, CANCELLED: 0,
    };
    byStatus.forEach((s) => (status[s.status] = s._count));

    const priority: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    byPriority.forEach((p) => (priority[p.priority] = p._count));

    const total = Object.values(status).reduce((a, b) => a + b, 0);
    const done = status.DONE;
    const onTime = doneTasks.filter(
      (t) => !t.dueDate || (t.completedAt && t.completedAt <= t.dueDate)
    ).length;

    res.json({
      total,
      status,
      priority,
      overdue, // đang mở và đã quá hạn
      dueSoon, // đang mở, hết hạn trong 24 giờ tới
      completionRate: pct(done, total - status.CANCELLED), // % hoàn thành
      onTimeRate: pct(onTime, done), // % việc xong đúng hạn
    });
  } catch (e) {
    next(e);
  }
});

// ---------- GET /api/reports/projects ----------
router.get("/projects", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const q = filterSchema.parse(req.query);
    const where = buildWhere(req.user!, q);
    const now = new Date();

    const [byStatus, overdueByProject] = await Promise.all([
      prisma.task.groupBy({ by: ["projectId", "status"], where, _count: true }),
      prisma.task.groupBy({
        by: ["projectId"],
        where: {
          AND: [where, { status: { in: openStatuses } }, { dueDate: { lt: now } }],
        },
        _count: true,
      }),
    ]);

    const projectIds = [...new Set(byStatus.map((s) => s.projectId))];
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true, code: true, name: true, status: true, endDate: true,
        owner: { select: { id: true, fullName: true } },
      },
    });

    const items = projects
      .map((p) => {
        const mine = byStatus.filter((s) => s.projectId === p.id);
        const count = (st: string) => mine.find((s) => s.status === st)?._count ?? 0;
        const total = mine.reduce((sum, s) => sum + s._count, 0);
        const cancelled = count("CANCELLED");
        return {
          project: p,
          total,
          todo: count("TODO"),
          inProgress: count("IN_PROGRESS"),
          review: count("REVIEW"),
          done: count("DONE"),
          cancelled,
          overdue: overdueByProject.find((o) => o.projectId === p.id)?._count ?? 0,
          percent: pct(count("DONE"), total - cancelled),
        };
      })
      .sort((a, b) => b.total - a.total);

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ---------- GET /api/reports/employees ----------
// Hiệu suất từng nhân viên
router.get("/employees", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const q = filterSchema.parse(req.query);
    const where = buildWhere(req.user!, q);
    const now = Date.now();

    const tasks = await prisma.task.findMany({
      where: { AND: [where, { assigneeId: { not: null } }] },
      select: {
        status: true, dueDate: true, createdAt: true, completedAt: true,
        assignee: { select: { id: true, fullName: true, department: true } },
      },
    });

    interface Row {
      user: { id: string; fullName: string; department: string | null };
      assigned: number; done: number; inProgress: number;
      overdueOpen: number; doneOnTime: number; doneHours: number;
    }
    const map = new Map<string, Row>();

    for (const t of tasks) {
      if (!t.assignee || t.status === "CANCELLED") continue;
      let r = map.get(t.assignee.id);
      if (!r) {
        r = {
          user: t.assignee, assigned: 0, done: 0, inProgress: 0,
          overdueOpen: 0, doneOnTime: 0, doneHours: 0,
        };
        map.set(t.assignee.id, r);
      }
      r.assigned++;
      if (t.status === "IN_PROGRESS" || t.status === "REVIEW") r.inProgress++;
      if (openStatuses.includes(t.status) && t.dueDate && t.dueDate.getTime() < now) {
        r.overdueOpen++;
      }
      if (t.status === "DONE" && t.completedAt) {
        r.done++;
        r.doneHours += (t.completedAt.getTime() - t.createdAt.getTime()) / HOUR;
        if (!t.dueDate || t.completedAt <= t.dueDate) r.doneOnTime++;
      }
    }

    const items = [...map.values()]
      .map((r) => ({
        user: r.user,
        assigned: r.assigned,
        done: r.done,
        inProgress: r.inProgress,
        overdue: r.overdueOpen,
        completionRate: pct(r.done, r.assigned),
        onTimeRate: pct(r.doneOnTime, r.done),
        avgHours: r.done ? round1(r.doneHours / r.done) : null, // giờ xử lý trung bình
      }))
      .sort((a, b) => b.done - a.done);

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ---------- GET /api/reports/sla ----------
// Tuân thủ thời gian xử lý tối đa (SLA) theo loại công việc
router.get("/sla", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const q = filterSchema.parse(req.query);
    const where = buildWhere(req.user!, q);
    const now = Date.now();

    const tasks = await prisma.task.findMany({
      where: { AND: [where, { typeId: { not: null } }, { status: { not: "CANCELLED" } }] },
      select: {
        status: true, createdAt: true, completedAt: true,
        type: { select: { id: true, code: true, name: true, slaHours: true, color: true } },
      },
    });

    interface Row {
      type: NonNullable<(typeof tasks)[number]["type"]>;
      total: number; done: number; breached: number; doneHours: number;
    }
    const map = new Map<string, Row>();

    for (const t of tasks) {
      if (!t.type || !t.type.slaHours) continue;
      let r = map.get(t.type.id);
      if (!r) {
        r = { type: t.type, total: 0, done: 0, breached: 0, doneHours: 0 };
        map.set(t.type.id, r);
      }
      const end = t.status === "DONE" && t.completedAt ? t.completedAt.getTime() : now;
      const hours = (end - t.createdAt.getTime()) / HOUR;

      r.total++;
      if (t.status === "DONE") {
        r.done++;
        r.doneHours += hours;
      }
      if (hours > t.type.slaHours) r.breached++; // xong trễ SLA, hoặc đang mở mà đã quá SLA
    }

    const items = [...map.values()].map((r) => ({
      type: r.type,
      total: r.total,
      done: r.done,
      breached: r.breached,
      slaComplianceRate: pct(r.total - r.breached, r.total),
      avgHours: r.done ? round1(r.doneHours / r.done) : null,
    }));

    res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ---------- GET /api/reports/timeline?days=30 ----------
// Số việc tạo mới và hoàn thành theo ngày (vẽ biểu đồ đường/cột)
router.get("/timeline", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const { days } = z
      .object({ days: z.coerce.number().int().min(1).max(365).default(30) })
      .parse(req.query);
    const q = filterSchema.pick({ projectId: true }).parse(req.query);

    const VN = 7 * HOUR; // múi giờ Việt Nam UTC+7
    const dayKey = (d: Date) => new Date(d.getTime() + VN).toISOString().slice(0, 10);

    const since = new Date(Date.now() - (days - 1) * DAY);
    since.setUTCHours(0, 0, 0, 0);
    since.setTime(since.getTime() - VN);

    const base = buildWhere(req.user!, q);
    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          base,
          { OR: [{ createdAt: { gte: since } }, { completedAt: { gte: since } }] },
        ],
      },
      select: { createdAt: true, completedAt: true },
    });

    const buckets = new Map<string, { date: string; created: number; completed: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const key = dayKey(new Date(Date.now() - i * DAY));
      buckets.set(key, { date: key, created: 0, completed: 0 });
    }
    for (const t of tasks) {
      const c = buckets.get(dayKey(t.createdAt));
      if (c && t.createdAt >= since) c.created++;
      if (t.completedAt && t.completedAt >= since) {
        const d = buckets.get(dayKey(t.completedAt));
        if (d) d.completed++;
      }
    }

    res.json({ items: [...buckets.values()] });
  } catch (e) {
    next(e);
  }
});

export default router;