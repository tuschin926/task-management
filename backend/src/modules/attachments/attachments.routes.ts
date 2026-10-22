import { Router } from "express";
import fs from "fs";
import path from "path";
import prisma from "../../prisma";
import { authenticate } from "../../middlewares/auth";
import { HttpError } from "../../utils/httpError";
import { taskVisibleWhere } from "../../utils/access";
import { fixFileName, removeFiles, upload, uploadDir } from "../../utils/upload";
import { notify } from "../notifications/notifications.service";

const router = Router();

const userBrief = { id: true, fullName: true };

// POST /api/tasks/:id/attachments   (form-data, field tên "files")
router.post(
  "/tasks/:id/attachments",
  authenticate,
  upload.array("files", 5),
  async (req, res, next) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      const user = req.user!;
      const id = String(req.params.id);
      if (files.length === 0) throw new HttpError(400, "Chưa chọn file");

      const task = await prisma.task.findFirst({
        where: { AND: [{ id }, taskVisibleWhere(user)] },
        select: { id: true, code: true, title: true, assigneeId: true, creatorId: true },
      });
      if (!task) throw new HttpError(404, "Không tìm thấy công việc");
      if (user.role === "EMPLOYEE" && task.assigneeId !== user.id) {
        throw new HttpError(403, "Chỉ người thực hiện mới được đính kèm file");
      }

      const created = await prisma.$transaction(
        files.map((f) =>
          prisma.attachment.create({
            data: {
              fileName: fixFileName(f.originalname),
              fileUrl: `/uploads/${f.filename}`,
              mimeType: f.mimetype,
              sizeBytes: f.size,
              taskId: id,
              uploadedBy: user.id,
            },
            include: { user: { select: userBrief } },
          })
        )
      );

      await notify(
        [task.creatorId, task.assigneeId],
        {
          type: "TASK_UPDATED",
          title: `File mới - ${task.code}`,
          body: `${user.fullName} đính kèm ${files.length} file vào "${task.title}"`,
          taskId: id,
        },
        user.id
      );

      res.status(201).json(created);
    } catch (e) {
      await removeFiles(files); // lỗi thì xóa file đã lưu, tránh rác
      next(e);
    }
  }
);

// GET /api/tasks/:id/attachments
router.get("/tasks/:id/attachments", authenticate, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const task = await prisma.task.findFirst({
      where: { AND: [{ id }, taskVisibleWhere(req.user!)] },
      select: { id: true },
    });
    if (!task) throw new HttpError(404, "Không tìm thấy công việc");

    res.json(
      await prisma.attachment.findMany({
        where: { taskId: id },
        include: { user: { select: userBrief } },
        orderBy: { createdAt: "desc" },
      })
    );
  } catch (e) {
    next(e);
  }
});

// DELETE /api/attachments/:id
router.delete("/attachments/:id", authenticate, async (req, res, next) => {
  try {
    const user = req.user!;
    const att = await prisma.attachment.findFirst({
      where: {
        id: String(req.params.id),
        task: taskVisibleWhere(user),
      },
    });
    if (!att) throw new HttpError(404, "Không tìm thấy file");

    const canDelete = user.role !== "EMPLOYEE" || att.uploadedBy === user.id;
    if (!canDelete) throw new HttpError(403, "Bạn không có quyền xóa file này");

    await prisma.attachment.delete({ where: { id: att.id } });
    await fs.promises
      .unlink(path.join(uploadDir, path.basename(att.fileUrl)))
      .catch(() => undefined);

    res.json({ message: "Đã xóa file" });
  } catch (e) {
    next(e);
  }
});

export default router;