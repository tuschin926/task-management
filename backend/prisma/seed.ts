import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  // --- Người dùng ---
  const admin = await prisma.user.upsert({
    where: { email: "admin@trilucvt.local" },
    update: {},
    create: {
      email: "admin@trilucvt.local",
      passwordHash,
      fullName: "Quản trị hệ thống",
      role: Role.ADMIN,
      department: "Công nghệ thông tin",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@trilucvt.local" },
    update: {},
    create: {
      email: "manager@trilucvt.local",
      passwordHash,
      fullName: "Nguyễn Văn Quản Lý",
      role: Role.MANAGER,
      department: "Kỹ thuật",
    },
  });

  const emp1 = await prisma.user.upsert({
    where: { email: "nv1@trilucvt.local" },
    update: {},
    create: {
      email: "nv1@trilucvt.local",
      passwordHash,
      fullName: "Trần Văn Kỹ Thuật",
      phone: "0900000001",
      role: Role.EMPLOYEE,
      department: "Kỹ thuật",
    },
  });

  const emp2 = await prisma.user.upsert({
    where: { email: "nv2@trilucvt.local" },
    update: {},
    create: {
      email: "nv2@trilucvt.local",
      passwordHash,
      fullName: "Lê Thị Hỗ Trợ",
      phone: "0900000002",
      role: Role.EMPLOYEE,
      department: "Kỹ thuật",
    },
  });

  // --- Loại công việc ---
  const types = [
    { code: "INSTALL", name: "Lắp đặt mới", slaHours: 72, color: "#2563eb" },
    { code: "WARRANTY", name: "Bảo hành", slaHours: 48, color: "#16a34a" },
    { code: "INCIDENT", name: "Xử lý sự cố", slaHours: 8, color: "#dc2626" },
    { code: "SURVEY", name: "Khảo sát hiện trường", slaHours: 48, color: "#9333ea" },
    { code: "MAINTENANCE", name: "Bảo trì định kỳ", slaHours: 120, color: "#ea580c" },
  ];
  for (const t of types) {
    await prisma.taskType.upsert({
      where: { code: t.code },
      update: {},
      create: t,
    });
  }

  // --- Khách hàng + địa điểm mẫu (dữ liệu giả) ---
  const customer = await prisma.customer.upsert({
    where: { code: "KH-001" },
    update: {},
    create: {
      code: "KH-001",
      name: "Công ty ABC (mẫu)",
      type: "ENTERPRISE",
      contact: "Anh Minh",
      phone: "0911111111",
      address: "Đà Nẵng",
    },
  });

  const site = await prisma.site.create({
    data: {
      name: "Văn phòng ABC - Hải Châu",
      address: "123 Đường Mẫu, Hải Châu, Đà Nẵng",
      latitude: 16.0544,
      longitude: 108.2022,
      customerId: customer.id,
    },
  });

  // --- Dự án mẫu ---
  const project = await prisma.project.upsert({
    where: { code: "DA-2026-001" },
    update: {},
    create: {
      code: "DA-2026-001",
      name: "Triển khai mạng cho Công ty ABC",
      description: "Dự án mẫu để test hệ thống",
      status: "ACTIVE",
      ownerId: manager.id,
      members: {
        create: [
          { userId: manager.id },
          { userId: emp1.id },
          { userId: emp2.id },
        ],
      },
    },
  });

  // --- Công việc mẫu ---
  const install = await prisma.taskType.findUnique({ where: { code: "INSTALL" } });
  const incident = await prisma.taskType.findUnique({ where: { code: "INCIDENT" } });

  await prisma.task.upsert({
    where: { code: "CV-000001" },
    update: {},
    create: {
      code: "CV-000001",
      title: "Lắp đặt đường truyền cáp quang",
      description: "Kéo cáp, đấu nối, đo kiểm tín hiệu",
      priority: "HIGH",
      dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      projectId: project.id,
      creatorId: manager.id,
      assigneeId: emp1.id,
      typeId: install?.id,
      customerId: customer.id,
      siteId: site.id,
    },
  });

  await prisma.task.upsert({
    where: { code: "CV-000002" },
    update: {},
    create: {
      code: "CV-000002",
      title: "Xử lý mất kết nối tại văn phòng",
      priority: "URGENT",
      status: "IN_PROGRESS",
      dueDate: new Date(Date.now() + 8 * 3600 * 1000),
      projectId: project.id,
      creatorId: manager.id,
      assigneeId: emp2.id,
      typeId: incident?.id,
      customerId: customer.id,
      siteId: site.id,
    },
  });

  console.log("Seed xong!");
  console.log("Tài khoản test (mật khẩu: 123456):");
  console.log(" - admin@trilucvt.local");
  console.log(" - manager@trilucvt.local");
  console.log(" - nv1@trilucvt.local");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());