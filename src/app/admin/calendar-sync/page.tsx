import { redirect } from "next/navigation";
import { CalendarSyncClient } from "@/components/admin/CalendarSyncClient";
import { requireAuth } from "@/lib/auth/protected-page";
import { ensureCalendarToken } from "@/lib/calendar-token";

export default async function CalendarSyncPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN" && session.user.role !== "SITTER") {
    redirect("/dashboard");
  }

  const token = await ensureCalendarToken(session.user.id);

  return (
    <CalendarSyncClient
      initialToken={token}
      configuredBaseUrl={process.env.NEXTAUTH_URL || ""}
    />
  );
}
