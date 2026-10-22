import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { HttpError } from "./httpError";

// Thư mục uploads nằm trong backend/ (chạy server từ thư mục backend)
export const uploadDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    // Đặt tên ngẫu nhiên để không trùng và không đoán được đường dẫn
    filename: (_req, file, cb) =>
      cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10MB/file, tối đa 5 file
  fileFilter: (_req, file, cb) => {
    if (allowedTypes.has(file.mimetype)) return cb(null, true);
    cb(new HttpError(400, "Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc PDF"));
  },
});

// multer đọc tên file tiếng Việt bị lỗi mã hóa, cần đổi lại
export function fixFileName(name: string) {
  return Buffer.from(name, "latin1").toString("utf8");
}

export async function removeFiles(files: Express.Multer.File[]) {
  await Promise.all(
    files.map((f) => fs.promises.unlink(f.path).catch(() => undefined))
  );
}