import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../../prisma";
import { authenticate, requireRole } from "../../middlewares/auth";
import { HttpError } from "../../utils/httpError";

const router = Router();
router.use(authenticate);

const publicSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  department: true,
  isActive: true,
  createdAt: true,
};

// GET /api/users?search=&role=&page=1&limit=20
// Admin + Manager xem được (Manager cần để giao việc)
router.get("/", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const q = z
      .object({
        search: z.string().optional(),
        role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const where = {
      ...(q.role && { role: q.role }),
      ...(q.search && {
        OR: [
          { fullName: { contains: q.search, mode: "insensitive" as const } },
          { email: { contains: q.search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: publicSelect,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ items, total, page: q.page, limit: q.limit });
  } catch (e) {
    next(e);
  }
});

// POST /api/users  (chỉ Admin)
const createSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  fullName: z.string().min(1, "Vui lòng nhập họ tên"),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
  department: z.string().optional(),
});

router.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new HttpError(409, "Email đã được sử dụng");

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(data.password, 10),
        fullName: data.fullName,
        phone: data.phone,
        role: data.role,
        department: data.department,
      },
      select: publicSelect,
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/users/:id  (chỉ Admin)
const updateSchema = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
  department: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(), // Admin đặt lại mật khẩu
});

router.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const { password, ...rest } = updateSchema.parse(req.body);

    if (id === req.user!.id && (rest.isActive === false || rest.role)) {
      throw new HttpError(400, "Không thể tự khóa hoặc đổi vai trò của chính mình");
    }

    const found = await prisma.user.findUnique({ where: { id } });
    if (!found) throw new HttpError(404, "Không tìm thấy người dùng");

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(password && { passwordHash: await bcrypt.hash(password, 10) }),
      },
      select: publicSelect,
    });
    res.json(user);
  } catch (e) {
    next(e);
  }
});

// GET /api/users/:id
router.get("/:id", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: publicSelect,
    });
    if (!user) throw new HttpError(404, "Không tìm thấy người dùng");
    res.json(user);
  } catch (e) {
    next(e);
  }
});

export default router;