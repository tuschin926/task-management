import { Prisma, Project } from "@prisma/client";
import prisma from "../prisma";
import { AuthUser } from "../middlewares/auth";
import { HttpError } from "./httpError";

// Kiểm tra user có thuộc dự án không (Admin luôn được)
export async function assertProjectAccess(
  user: AuthUser,
  projectId: string
): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpError(404, "Không tìm thấy dự án");
  if (user.role === "ADMIN") return project;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (project.ownerId !== user.id && !member) {
    throw new HttpError(403, "Bạn không thuộc dự án này");
  }
  return project;
}

export function canManageProject(user: AuthUser, project: Project) {
  return user.role === "ADMIN" || project.ownerId === user.id;
}

// Điều kiện lọc: user được xem những công việc nào
export function taskVisibleWhere(user: AuthUser): Prisma.TaskWhereInput {
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