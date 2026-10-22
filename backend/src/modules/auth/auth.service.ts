import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../../config";
import prisma from "../../prisma";
import { HttpError } from "../../utils/httpError";

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user) throw new HttpError(401, "Email hoặc mật khẩu không đúng");
  if (!user.isActive) throw new HttpError(403, "Tài khoản đã bị khóa");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new HttpError(401, "Email hoặc mật khẩu không đúng");

  return {
    token: signToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      department: user.department,
    },
  };
}