import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../../prisma";
import { authenticate } from "../../middlewares/auth";
import { HttpError } from "../../utils/httpError";
import { login } from "./auth.service";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});

// POST /api/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    res.json(await login(email, password));
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        department: true,
        avatarUrl: true,
      },
    });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/change-password
const changePwSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
});

router.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = changePwSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(404, "Không tìm thấy người dùng");

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new HttpError(400, "Mật khẩu cũ không đúng");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    res.json({ message: "Đổi mật khẩu thành công" });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/push-token  (Mobile gửi token thông báo đẩy)
router.post("/push-token", authenticate, async (req, res, next) => {
  try {
    const { pushToken } = z.object({ pushToken: z.string().min(1) }).parse(req.body);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { pushToken },
    });
    res.json({ message: "Đã lưu token" });
  } catch (e) {
    next(e);
  }
});

export default router;