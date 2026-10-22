import { Router } from "express";
import { Prisma, TaskStatus } from "@prisma/client";
import { z } from "zod";
import prisma from "../../prisma";
import { authenticate, AuthUser, requireRole } from "../../middlewares/auth";
import { HttpError } from "../../utils/httpError";
import { assertProjectAccess } from "../../utils/access";
import { nextTaskCode } from "../../utils/codes";
import { notify } from "../notifications/notifications.service";

const router = Router();
router.use(authenticate);

// ---------- Hằng số & helper ----------

const userBrief = { id: true, fullName: true, avatarUrl: true };

const taskInclude = {
  project: { select: { id: true, code: true, name: true, ownerId: true } },
  creator: { select: userBrief },
  assignee: { select: userBrief },
  type: true,
  customer: { select: { id: true, code: true, name: true, phone: true } },
  site: true,
  _count: { select: { comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

const statusEnum = z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE", "CANCELLED"]);
const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const statusLabel: Record<TaskStatus, string> = {
  TODO: "Chờ làm",
  IN_PROGRESS: "Đang làm",
  REVIEW: "Chờ duyệt",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

// Luồng chuyển trạng thái hợp lệ
const transitions: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["REVIEW", "TODO", "DONE", "CANCELLED"],
  REVIEW: ["DONE", "IN_PROGRESS", "CANCELLED"],
  DONE: ["IN_PROGRESS"], // mở lại
  CANCELLED: ["TODO"],
};

// Ai được xem công việc nào
function visibleWhere(user: AuthUser): Prisma.TaskWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "MANAGER") {
    return {
      project: {
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
    };
  }
  return { OR: [{ assigneeId: user.id }, { creatorId: user.id }] };
}

async function getVisibleTask(user: AuthUser, id: string) {
  const task = await prisma.task.findFirst({
    where: { AND: [{ id }, visibleWhere(user)] },
    include: taskInclude,
  });
  if (!task) throw new HttpError(404, "Không tìm thấy công việc");
  return task;
}

const isManagerRole = (u: AuthUser) => u.role === "ADMIN" || u.role === "MANAGER";

// Gán người làm: phải là user đang hoạt động, tự thêm vào dự án nếu chưa có
async function ensureAssignee(projectId: string, assigneeId: string) {
  const u = await prisma.user.findUnique({ where: { id: assigneeId } });
  if (!u || !u.isActive) throw new HttpError(400, "Người được giao không hợp lệ");
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId: assigneeId } },
    update: {},
    create: { projectId, userId: assigneeId },
  });
}

// ---------- GET /api/tasks ----------
router.get("/", async (req, res, next) => {
  try {
    const user = req.user!;
    const q = z
      .object({
        search: z.string().optional(),
        projectId: z.string().optional(),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        assigneeId: z.string().optional(),
        typeId: z.string().optional(),
        customerId: z.string().optional(),
        overdue: z.enum(["true", "false"]).optional(),
        mine: z.enum(["true", "false"]).optional(), // việc được giao cho tôi
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const filters: Prisma.TaskWhereInput = {
      ...(q.projectId && { projectId: q.projectId }),
      ...(q.status && { status: q.status }),
      ...(q.priority && { priority: q.priority }),
      ...(q.assigneeId && { assigneeId: q.assigneeId }),
      ...(q.typeId && { typeId: q.typeId }),
      ...(q.customerId && { customerId: q.customerId }),
      ...(q.mine === "true" && { assigneeId: user.id }),
      ...(q.overdue === "true" && {
        dueDate: { lt: new Date() },
        status: { notIn: ["DONE", "CANCELLED"] },
      }),
      ...(q.search && {
        OR: [
          { title: { contains: q.search, mode: "insensitive" } },
          { code: { contains: q.search, mode: "insensitive" } },
        ],
      }),
    };

    const where: Prisma.TaskWhereInput = { AND: [visibleWhere(user), filters] };

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.task.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit });
  } catch (e) {
    next(e);
  }
});

// ---------- POST /api/tasks ----------
const createSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tiêu đề"),
  description: z.string().optional(),
  priority: priorityEnum.default("MEDIUM"),
  dueDate: z.coerce.date().optional(),
  projectId: z.string().min(1, "Vui lòng chọn dự án"),
  assigneeId: z.string().optional(),
  typeId: z.string().optional(),
  customerId: z.string().optional(),
  siteId: z.string().optional(),
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const user = req.user!;
    const data = createSchema.parse(req.body);

    await assertProjectAccess(user, data.projectId);
    if (data.assigneeId) await ensureAssignee(data.projectId, data.assigneeId);

    // Nếu không nhập hạn chót, tự tính theo SLA của loại công việc
    let dueDate = data.dueDate;
    if (!dueDate && data.typeId) {
      const type = await prisma.taskType.findUnique({ where: { id: data.typeId } });
      if (type?.slaHours) {
        dueDate = new Date(Date.now() + type.slaHours * 3600 * 1000);
      }
    }

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          ...data,
          dueDate,
          code: await nextTaskCode(),
          creatorId: user.id,
        },
        include: taskInclude,
      });
      await tx.taskHistory.create({
        data: {
          taskId: created.id,
          userId: user.id,
          toStatus: "TODO",
          note: "Tạo công việc",
        },
      });
      return created;
    });

    await notify(
      [task.assigneeId],
      {
        type: "TASK_ASSIGNED",
        title: "Bạn được giao công việc mới",
        body: `${task.code} - ${task.title}`,
        taskId: task.id,
      },
      user.id
    );

    res.status(201).json(task);
  } catch (e) {
    next(e);
  }
});

// ---------- GET /api/tasks/:id ----------
router.get("/:id", async (req, res, next) => {
  try {
    res.json(await getVisibleTask(req.user!, String(req.params.id)));
  } catch (e) {
    next(e);
  }
});

// ---------- PATCH /api/tasks/:id (sửa thông tin, chỉ Admin/Manager) ----------
const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  priority: priorityEnum.optional(),
  dueDate: z.coerce.date().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  typeId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  siteId: z.string().nullable().optional(),
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const task = await getVisibleTask(user, id);
    const data = updateSchema.parse(req.body);

    const assigneeChanged =
      data.assigneeId !== undefined && data.assigneeId !== task.assigneeId;
    if (assigneeChanged && data.assigneeId) {
      await ensureAssignee(task.projectId, data.assigneeId);
    }

    const updated = await prisma.task.update({
      where: { id },
      data,
      include: taskInclude,
    });

    if (assigneeChanged) {
      await notify(
        [data.assigneeId],
        {
          type: "TASK_ASSIGNED",
          title: "Bạn được giao công việc",
          body: `${updated.code} - ${updated.title}`,
          taskId: id,
        },
        user.id
      );
    } else {
      await notify(
        [updated.assigneeId],
        {
          type: "TASK_UPDATED",
          title: "Công việc được cập nhật",
          body: `${updated.code} - ${updated.title}`,
          taskId: id,
        },
        user.id
      );
    }
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ---------- PATCH /api/tasks/:id/status (đổi trạng thái + ghi lịch sử) ----------
router.patch("/:id/status", async (req, res, next) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const { status, note } = z
      .object({ status: statusEnum, note: z.string().optional() })
      .parse(req.body);

    const task = await getVisibleTask(user, id);
    const isAssignee = task.assigneeId === user.id;

    if (!isManagerRole(user)) {
      // Nhân viên: chỉ việc của mình, chỉ chuyển sang Đang làm / Chờ duyệt
      if (!isAssignee) throw new HttpError(403, "Bạn không phải người thực hiện công việc này");
      if (task.status === "DONE" || task.status === "CANCELLED") {
        throw new HttpError(403, "Công việc đã đóng, liên hệ quản lý để mở lại");
      }
      if (status !== "IN_PROGRESS" && status !== "REVIEW") {
        throw new HttpError(403, "Bạn chỉ được chuyển sang Đang làm hoặc Chờ duyệt");
      }
    }

    if (status === task.status) throw new HttpError(400, "Công việc đã ở trạng thái này");
    if (!transitions[task.status].includes(status)) {
      throw new HttpError(
        400,
        `Không thể chuyển từ "${statusLabel[task.status]}" sang "${statusLabel[status]}"`
      );
    }

    const data: Prisma.TaskUpdateInput = { status };
    if (status === "IN_PROGRESS" && !task.startedAt) data.startedAt = new Date();
    if (status === "DONE") {
      data.completedAt = new Date();
      data.progress = 100;
    } else if (task.status === "DONE") {
      data.completedAt = null; // mở lại
    }

    const [updated] = await prisma.$transaction([
      prisma.task.update({ where: { id }, data, include: taskInclude }),
      prisma.taskHistory.create({
        data: {
          taskId: id,
          userId: user.id,
          fromStatus: task.status,
          toStatus: status,
          note,
        },
      }),
    ]);

    // Người làm đổi trạng thái -> báo người giao + chủ dự án. Quản lý đổi -> báo người làm.
    const recipients = isAssignee
      ? [task.creatorId, task.project.ownerId]
      : [task.assigneeId];
    await notify(
      recipients,
      {
        type: "TASK_UPDATED",
        title: `${task.code}: ${statusLabel[status]}`,
        body: `${user.fullName} chuyển "${task.title}" sang ${statusLabel[status]}`,
        taskId: id,
      },
      user.id
    );

    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// ---------- PATCH /api/tasks/:id/progress ----------
router.patch("/:id/progress", async (req, res, next) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const { progress } = z
      .object({ progress: z.number().int().min(0).max(100) })
      .parse(req.body);

    const task = await getVisibleTask(user, id);
    if (!isManagerRole(user) && task.assigneeId !== user.id) {
      throw new HttpError(403, "Bạn không phải người thực hiện công việc này");
    }
    if (task.status === "DONE" || task.status === "CANCELLED") {
      throw new HttpError(400, "Công việc đã đóng, không cập nhật tiến độ");
    }
    res.json(
      await prisma.task.update({
        where: { id },
        data: { progress },
        include: taskInclude,
      })
    );
  } catch (e) {
    next(e);
  }
});

// ---------- DELETE /api/tasks/:id ----------
router.delete("/:id", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await getVisibleTask(req.user!, id);
    await prisma.task.delete({ where: { id } });
    res.json({ message: "Đã xóa công việc" });
  } catch (e) {
    next(e);
  }
});

// ---------- Lịch sử trạng thái ----------
router.get("/:id/history", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await getVisibleTask(req.user!, id);
    res.json(
      await prisma.taskHistory.findMany({
        where: { taskId: id },
        include: { user: { select: userBrief } },
        orderBy: { createdAt: "asc" },
      })
    );
  } catch (e) {
    next(e);
  }
});

// ---------- Bình luận ----------
router.get("/:id/comments", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await getVisibleTask(req.user!, id);
    res.json(
      await prisma.comment.findMany({
        where: { taskId: id },
        include: { user: { select: userBrief } },
        orderBy: { createdAt: "asc" },
      })
    );
  } catch (e) {
    next(e);
  }
});

router.post("/:id/comments", async (req, res, next) => {
  try {
    const user = req.user!;
    const id = String(req.params.id);
    const { content } = z
      .object({ content: z.string().trim().min(1, "Nội dung không được trống") })
      .parse(req.body);

    const task = await getVisibleTask(user, id);
    const comment = await prisma.comment.create({
      data: { taskId: id, userId: user.id, content },
      include: { user: { select: userBrief } },
    });

    await notify(
      [task.creatorId, task.assigneeId],
      {
        type: "TASK_COMMENTED",
        title: `Bình luận mới - ${task.code}`,
        body: `${user.fullName}: ${content.slice(0, 100)}`,
        taskId: id,
      },
      user.id
    );
    res.status(201).json(comment);
  } catch (e) {
    next(e);
  }
});

export default router;