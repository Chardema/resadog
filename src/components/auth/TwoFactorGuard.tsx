"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const ALLOWED_PENDING_PATHS = ["/auth/two-factor", "/auth/signin", "/auth/error"];

export function TwoFactorGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (
      status === "authenticated" &&
      session.user.twoFactorVerified === false &&
      !ALLOWED_PENDING_PATHS.some((path) => pathname.startsWith(path))
    ) {
      const next = pathname.startsWith("/") ? pathname : "/dashboard";
      router.replace(`/auth/two-factor?next=${encodeURIComponent(next)}`);
    }
  }, [pathname, router, session, status]);

  return null;
}
