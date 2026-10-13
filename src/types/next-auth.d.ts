import { DefaultSession } from "next-auth";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      twoFactorVerified: boolean;
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    twoFactorVerified?: boolean;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    twoFactorVerified: boolean;
    sessionVersion: number;
  }
}
