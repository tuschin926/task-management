import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError";



export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: "Không tìm thấy đường dẫn" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
    if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File quá lớn (tối đa 10MB mỗi file)"
        : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE"
        ? 'Tối đa 5 file mỗi lần, tên trường phải là "files"'
        : err.message;
    return res.status(400).json({ message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Dữ liệu không hợp lệ",
      errors: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }
  console.error(err);
  res.status(500).json({ message: "Lỗi hệ thống" });
}