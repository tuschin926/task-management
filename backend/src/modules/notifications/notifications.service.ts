import { NotificationType } from "@prisma/client";
import prisma from "../../prisma";

interface NotifyData {
  type: NotificationType;
  title: string;
  body: string;
  taskId?: string;
}

// Tạo thông báo cho nhiều người, bỏ trùng và bỏ người thực hiện hành động
export async function notify(
  userIds: (string | null | undefined)[],
  data: NotifyData,
  excludeUserId?: string
) {
  const ids = [
    ...new Set(userIds.filter((x): x is string => !!x && x !== excludeUserId)),
  ];
  if (ids.length === 0) return;

  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, ...data })),
  });
  // TODO (bước Mobile): gửi push qua Firebase Cloud Messaging bằng User.pushToken
}