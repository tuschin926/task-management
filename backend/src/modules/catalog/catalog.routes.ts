import { Router } from "express";
import { z } from "zod";
import prisma from "../../prisma";
import { authenticate, requireRole } from "../../middlewares/auth";
import { HttpError } from "../../utils/httpError";

const router = Router();
router.use(authenticate);

// ================= LOẠI CÔNG VIỆC =================
router.get("/task-types", async (_req, res, next) => {
  try {
    res.json(await prisma.taskType.findMany({ orderBy: { name: "asc" } }));
  } catch (e) {
    next(e);
  }
});

const typeSchema = z.object({
  code: z.string().min(1).transform((s) => s.toUpperCase()),
  name: z.string().min(1),
  description: z.string().optional(),
  slaHours: z.number().int().positive().optional(),
  color: z.string().optional(),
});

router.post("/task-types", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = typeSchema.parse(req.body);
    const exists = await prisma.taskType.findUnique({ where: { code: data.code } });
    if (exists) throw new HttpError(409, "Mã loại công việc đã tồn tại");
    res.status(201).json(await prisma.taskType.create({ data }));
  } catch (e) {
    next(e);
  }
});

router.patch("/task-types/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = typeSchema.partial().omit({ code: true }).parse(req.body);
    res.json(
      await prisma.taskType.update({ where: { id: String(req.params.id) }, data })
    );
  } catch (e) {
    next(e);
  }
});

// ================= KHÁCH HÀNG =================
router.get("/customers", async (req, res, next) => {
  try {
    const q = z
      .object({
        search: z.string().optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);

    const where = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" as const } },
            { code: { contains: q.search, mode: "insensitive" as const } },
            { phone: { contains: q.search } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.customer.count({ where }),
    ]);
    res.json({ items, total, page: q.page, limit: q.limit });
  } catch (e) {
    next(e);
  }
});

const customerSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["ENTERPRISE", "INDIVIDUAL", "GOVERNMENT"]).default("ENTERPRISE"),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
});

router.post("/customers", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const data = customerSchema.parse(req.body);
    const exists = await prisma.customer.findUnique({ where: { code: data.code } });
    if (exists) throw new HttpError(409, "Mã khách hàng đã tồn tại");
    res.status(201).json(await prisma.customer.create({ data }));
  } catch (e) {
    next(e);
  }
});

router.patch("/customers/:id", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    const data = customerSchema.partial().omit({ code: true }).parse(req.body);
    res.json(
      await prisma.customer.update({ where: { id: String(req.params.id) }, data })
    );
  } catch (e) {
    next(e);
  }
});

// ================= ĐỊA ĐIỂM =================
router.get("/sites", async (req, res, next) => {
  try {
    const q = z
      .object({
        customerId: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(req.query);

    res.json(
      await prisma.site.findMany({
        where: {
          ...(q.customerId && { customerId: q.customerId }),
          ...(q.search && {
            name: { contains: q.search, mode: "insensitive" as const },
          }),
        },
        orderBy: { name: "asc" },
        take: 100,
      })
    );
  } catch (e) {
    next(e);
  }
});

const siteSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  customerId: z.string().optional(),
});

router.post("/sites", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    res.status(201).json(
      await prisma.site.create({ data: siteSchema.parse(req.body) })
    );
  } catch (e) {
    next(e);
  }
});

router.patch("/sites/:id", requireRole("ADMIN", "MANAGER"), async (req, res, next) => {
  try {
    res.json(
      await prisma.site.update({
        where: { id: String(req.params.id) },
        data: siteSchema.partial().parse(req.body),
      })
    );
  } catch (e) {
    next(e);
  }
});

export default router;