import { prisma } from "./prisma";

export async function createNotification(title: string, body?: string) {
  try {
    return await prisma.notification.create({
      data: { title, body },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}
