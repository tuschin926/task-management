import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../../prisma";
import { authenticate, requireRole } from "../../middlewares/auth";
import { HttpError } from "../../utils/httpError";
import { assertProjectAccess, canManageProject } from "../../utils/access";
import { nextProjectCode } from "../../utils/codes";

const router = Router();
router.use(authenticate);

const userBrief = { id: true, fullName: true, email: true, avatarUrl: true, role: true };

const statusEnum = z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"]);

// GET /api/projects?search=&status=&page=&limit=
router.get("/", async (req, res, next) => {
  try {
    const user = req.user!;
    const q = z
      .object({
        search: z.string().optional(),
        status: statusEnum.optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const visible: Prisma.ProjectWhereInput =
      user.role === "ADMIN"
        ? {}
        : { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] };

    const where: Prisma.ProjectWhereInput = {
      AND: [
        visible,
        q.status ? { status: q.status } : {},
        q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" } },
                { code: { contains: q.search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          owner: { select: userBrief },
          _count: { select: { members: true, tasks: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.project.count({ where }),
    ]);

    // Thống kê số việc theo trạng thái cho từng dự án trong trang này
    const stats = await prisma.task.groupBy({
      by: ["projectId", "status"],
      where: { projectId: { in: projects.map((p) => p.id) } },
      _count: true,
    });

    const items = projects.map((p) => {
      const mine = stats.filter((s) => s.projectId === p.id);
      const totalTasks = mine.reduce((sum, s) => sum + s._count, 0);
      const done = mine.find((s) => s.status === "DONE")?._count ?? 0;
      return {
        ...p,
        taskStats: {
          total: totalTasks,
          done,
          percent: totalTasks ? Math.round((done / totalTasks) * 100) : 0,
        },
      };
    });

    res.json({ items, total, page: q.page, limit: q.limit });
  } catch (e) {
    next(e);
  }
});

// POST /api/projects
const createSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên dự án"),
  description: z.string().optional(),
  status: statusEnum.default("PLANNING"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  ownerId: z.string().optional(), // chỉ Admin được chỉ định chủ dự án khác
  memberIds: z.array(z.string()).default([]),
});

router.post("/", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const user = req.user!;
    const data = createSchema.parse(req.body);

    const ownerId = user.role === "ADMIN" && data.ownerId ? data.ownerId : user.id;
    const memberIds = [...new Set([ownerId, ...data.memberIds])];

    const validUsers = await prisma.user.count({
      where: { id: { in: memberIds }, isActive: true },
    });
    if (validUsers !== memberIds.length) {
      throw new HttpError(400, "Có thành viên không tồn tại hoặc đã bị khóa");
    }

    const project = await prisma.project.create({
      data: {
        code: await nextProjectCode(),
        name: data.name,
        description: data.description,
        status: data.status,
        startDate: data.startDate,
        endDate: data.endDate,
        ownerId,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      include: { owner: { select: userBrief } },
    });
    res.status(201).json(project);
  } catch (e) {
    next(e);
  }
});

// GET /api/projects/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = String(req.params.id);
    await assertProjectAccess(req.user!, id);

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: userBrief },
        members: { include: { user: { select: userBrief } } },
        _count: { select: { tasks: true } },
      },
    });
    res.json(project);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/projects/:id
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: statusEnum.optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

router.patch("/:id", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const project = await assertProjectAccess(req.user!, id);
    if (!canManageProject(req.user!, project)) {
      throw new HttpError(403, "Chỉ chủ dự án hoặc Admin được sửa dự án");
    }
    const updated = await prisma.project.update({
      where: { id },
      data: updateSchema.parse(req.body),
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

// POST /api/projects/:id/members  { "userId": "..." }
router.post("/:id/members", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const project = await assertProjectAccess(req.user!, id);
    if (!canManageProject(req.user!, project)) {
      throw new HttpError(403, "Chỉ chủ dự án hoặc Admin được thêm thành viên");
    }
    const { userId } = z.object({ userId: z.string() }).parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || !target.isActive) throw new HttpError(404, "Người dùng không hợp lệ");

    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId } },
      update: {},
      create: { projectId: id, userId },
    });
    res.status(201).json({ message: "Đã thêm thành viên" });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/projects/:id/members/:userId
router.delete("/:id/members/:userId", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const userId = String(req.params.userId);
    const project = await assertProjectAccess(req.user!, id);
    if (!canManageProject(req.user!, project)) {
      throw new HttpError(403, "Chỉ chủ dự án hoặc Admin được xóa thành viên");
    }
    if (userId === project.ownerId) {
      throw new HttpError(400, "Không thể xóa chủ dự án khỏi danh sách thành viên");
    }
    await prisma.projectMember.deleteMany({ where: { projectId: id, userId } });
    res.json({ message: "Đã xóa thành viên" });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/projects/:id  (Admin, và chỉ khi chưa có công việc)
router.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const count = await prisma.task.count({ where: { projectId: id } });
    if (count > 0) {
      throw new HttpError(
        400,
        "Dự án đã có công việc, không thể xóa. Hãy chuyển trạng thái sang COMPLETED hoặc ON_HOLD"
      );
    }
    await prisma.project.delete({ where: { id } });
    res.json({ message: "Đã xóa dự án" });
  } catch (e) {
    next(e);
  }
});

export default router;