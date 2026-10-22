import { Router } from "express";
import { z } from "zod";
import prisma from "../../prisma";
import { authenticate } from "../../middlewares/auth";
import { HttpError } from "../../utils/httpError";

const router = Router();
router.use(authenticate);

// GET /api/notifications?unreadOnly=true&page=1&limit=20
router.get("/", async (req, res, next) => {
  try {
    const q = z
      .object({
        unreadOnly: z.enum(["true", "false"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const where = {
      userId: req.user!.id,
      ...(q.unreadOnly === "true" && { isRead: false }),
    };
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.notification.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit });
  } catch (e) {
    next(e);
  }
});

// GET /api/notifications/unread-count  (hiện số đỏ trên chuông)
router.get("/unread-count", async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, isRead: false },
    });
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

// POST /api/notifications/read-all
router.post("/read-all", async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: "Đã đánh dấu tất cả là đã đọc" });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: String(req.params.id), userId: req.user!.id },
      data: { isRead: true },
    });
    if (result.count === 0) throw new HttpError(404, "Không tìm thấy thông báo");
    res.json({ message: "OK" });
  } catch (e) {
    next(e);
  }
});

export default router;