import { NextResponse } from "next/server";
import { getServerSession, Session } from "next-auth";
import { RoleName } from "@prisma/client";
import { authOptions } from "@/lib/auth";

// Keep permission groups in one place so API routes and pages use the same
// hotel access policy. These arrays describe capabilities, not navigation.
export const ROLE_GROUPS = {
  MANAGEMENT: [RoleName.ADMIN, RoleName.MANAGER],
  GUEST_STAYS: [RoleName.ADMIN, RoleName.MANAGER, RoleName.RECEPTIONIST],
  ACCOMMODATION_PAYMENTS: [
    RoleName.ADMIN,
    RoleName.MANAGER,
    RoleName.RECEPTIONIST,
    RoleName.CASHIER,
  ],
  RESTAURANT_POS: [RoleName.ADMIN, RoleName.MANAGER, RoleName.WAITER, RoleName.CASHIER],
  HOUSEKEEPING: [RoleName.ADMIN, RoleName.MANAGER, RoleName.HOUSEKEEPER],
  MAINTENANCE: [RoleName.ADMIN, RoleName.MANAGER, RoleName.TECHNICIAN],
  FINANCIAL_REPORTS: [RoleName.ADMIN, RoleName.MANAGER, RoleName.ACCOUNTANT],
  STAFF_ADMIN: [RoleName.ADMIN],
} satisfies Record<string, RoleName[]>;

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export function requireRole(session: Session, allowed: readonly RoleName[]) {
  const role = session.user.role;
  if (!allowed.includes(role)) {
    return NextResponse.json(
      { error: "You don't have permission to do that." },
      { status: 403 }
    );
  }
  return null;
}
