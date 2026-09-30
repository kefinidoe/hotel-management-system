import type { RoleName } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";

// Authorization helper for server-rendered dashboard pages. API guards alone
// are not enough because these pages query Prisma directly before rendering.
export async function requirePageRole(allowed: readonly RoleName[]) {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");
  if (!hasRole(session.user.role, allowed)) redirect("/dashboard");

  return session;
}
