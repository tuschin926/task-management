import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/users.routes";
import projectRoutes from "./modules/projects/projects.routes";
import taskRoutes from "./modules/tasks/tasks.routes";
import notificationRoutes from "./modules/notifications/notifications.routes";
import catalogRoutes from "./modules/catalog/catalog.routes";
import { errorHandler, notFound } from "./middlewares/error";
import path from "path";
import attachmentRoutes from "./modules/attachments/attachments.routes";
import reportRoutes from "./modules/reports/reports.routes";
import { uploadDir } from "./utils/upload";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", catalogRoutes);

app.use("/uploads", express.static(uploadDir));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", attachmentRoutes);
app.use("/api", catalogRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;