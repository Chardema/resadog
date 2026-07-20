import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAuth } from "@/lib/auth/protected-page";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN" && session.user.role !== "SITTER") {
    redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
