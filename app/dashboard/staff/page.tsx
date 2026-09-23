import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StaffClient from "@/components/staff/StaffClient";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const session = await getServerSession(authOptions);

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
      currentUserId={(session?.user as any)?.id ?? null}
      currentUserRole={(session?.user as any)?.role ?? null}
    />
  );
}