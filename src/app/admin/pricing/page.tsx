import { redirect } from "next/navigation";
import { PricingSimulator } from "@/components/admin/PricingSimulator";
import { requireAuth } from "@/lib/auth/protected-page";

export default async function AdminPricingPage() {
  const session = await requireAuth();

  if (session.user.role !== "ADMIN") {
    redirect("/admin/dashboard");
  }

  return <PricingSimulator />;
}
