import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { config } from "../config";
import prisma from "../prisma";
import { HttpError } from "../utils/httpError";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Bắt buộc đăng nhập
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, "Chưa đăng nhập");
    }
    const token = header.slice(7);

    let payload: { sub: string };
    try {
      payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    } catch {
      throw new HttpError(401, "Token không hợp lệ hoặc đã hết hạn");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new HttpError(401, "Tài khoản không tồn tại hoặc đã bị khóa");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };
    next();
  } catch (e) {
    next(e);
  }
}

// Giới hạn theo vai trò: requireRole("ADMIN", "MANAGER")
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Chưa đăng nhập"));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, "Bạn không có quyền thực hiện thao tác này"));
    }
    next();
  };
}