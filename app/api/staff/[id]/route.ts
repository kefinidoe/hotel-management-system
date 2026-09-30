import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

// Edit a staff member's role, department, or active status. ADMIN only,
// with two safety guards a real hotel system needs:
//  1. You can't lock yourself out (deactivate or demote your own account).
//  2. You can't leave the hotel with zero ADMIN accounts (demoting or
//     deactivating the last remaining ADMIN is blocked).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.STAFF_ADMIN);
  if (forbidden) return forbidden;

  const body = await req.json();
  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  const isSelf = target.id === auth.user.id;
  const demotingFromAdmin = body.role !== undefined && body.role !== "ADMIN" && target.role === "ADMIN";
  const deactivating = body.isActive === false;

  if (isSelf && (demotingFromAdmin || deactivating)) {
    return NextResponse.json(
      { error: "You can't remove your own admin access or deactivate your own account." },
      { status: 400 }
    );
  }

  if ((demotingFromAdmin || (deactivating && target.role === "ADMIN")) && target.role === "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: target.id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "This is the last active admin account -- promote someone else to admin first." },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      role: body.role ?? undefined,
      department: body.department ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  });

  return NextResponse.json({ id: updated.id, role: updated.role, isActive: updated.isActive });
}