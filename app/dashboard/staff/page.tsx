import { prisma } from "@/lib/prisma";
import StaffClient from "@/components/staff/StaffClient";
import { requirePageRole } from "@/lib/page-auth";
import { ROLE_GROUPS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await requirePageRole(ROLE_GROUPS.STAFF_VIEW);

  const staff = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  const initialStaff = staff.map((s) => ({
    ...s,
    lastLoginAt: s.lastLoginAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <StaffClient
      initialStaff={initialStaff}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
    />
  );
}