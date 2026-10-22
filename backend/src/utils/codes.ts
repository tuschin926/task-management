import prisma from "../prisma";

// CV-000001, CV-000002, ...
export async function nextTaskCode() {
  const last = await prisma.task.findFirst({
    where: { code: { startsWith: "CV-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const n = last ? parseInt(last.code.slice(3), 10) + 1 : 1;
  return "CV-" + String(n).padStart(6, "0");
}

// DA-2026-001, DA-2026-002, ...
export async function nextProjectCode() {
  const prefix = `DA-${new Date().getFullYear()}-`;
  const last = await prisma.project.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const n = last ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, "0");
}