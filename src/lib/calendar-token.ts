import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

function generateCalendarToken() {
  return randomBytes(32).toString("base64url");
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function ensureCalendarToken(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarToken: true },
  });

  if (user?.calendarToken) {
    return user.calendarToken;
  }

  return rotateCalendarToken(userId);
}

export async function rotateCalendarToken(userId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { calendarToken: generateCalendarToken() },
        select: { calendarToken: true },
      });

      return user.calendarToken!;
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("Impossible de générer un token calendrier unique");
}
