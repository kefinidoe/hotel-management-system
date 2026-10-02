import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { passwordProblem } from "@/lib/password";

// Edit a staff member's role, department, or active status. ADMIN only,
// with two safety guards a real hotel system needs:
//  1. You can't lock yourself out (deactivate or demote your own account).
//  2. You can't leave the hotel with zero ADMIN accounts (demoting or
//     deactivating the last remaining ADMIN is blocked).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.STAFF_ADMIN);
  if (forbidden) return forbidden;

  const body = await req.json();
  const target = await prisma.user.findUnique({ where: { id } });
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

  // Resetting someone else's password doesn't need their current one -- that's
  // the point of an admin reset (forgotten password, rotating off a shared
  // account). Use POST /api/profile/password for your own.
  let passwordHash: string | undefined;
  if (body.newPassword !== undefined) {
    const problem = passwordProblem(body.newPassword);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    passwordHash = await bcrypt.hash(body.newPassword, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      role: body.role ?? undefined,
      department: body.department ?? undefined,
      isActive: body.isActive ?? undefined,
      passwordHash,
    },
  });

  return NextResponse.json({
    id: updated.id,
    role: updated.role,
    isActive: updated.isActive,
    passwordReset: passwordHash !== undefined,
  });
}

// Delete a staff account. ADMIN only.
//
// Two guards first, same spirit as PATCH above:
//  1. You can't delete your own account -- that is how a hotel locks itself out.
//  2. You can't delete the last active ADMIN.
//
// Then one decision. A staff member who has never *done* anything -- no
// reservations, payments, stock movements, housekeeping or maintenance work,
// purchases, wastage, expenses or audit entries -- is deleted for good; nothing
// in the database points at them.
//
// Anyone with history is DEACTIVATED instead. Their account can no longer sign
// in, so from the admin's point of view the account is gone, but the payments
// they took and the records they touched keep a valid author. A true delete here
// would either fail on a foreign key or -- worse, if those relations were ever
// loosened -- leave financial records pointing at nobody. This mirrors how
// inventory items (delete if unused, deactivate if used) and guests (archive,
// never delete) are already handled elsewhere in this codebase.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.STAFF_ADMIN);
  if (forbidden) return forbidden;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

  if (target.id === auth.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  // Only guard the last admin if this one can currently sign in -- deleting an
  // already-deactivated admin can't reduce the number of usable admin accounts.
  if (target.role === "ADMIN" && target.isActive) {
    const otherActiveAdmins = await prisma.user.count({
      where: { role: "ADMIN", isActive: true, id: { not: target.id } },
    });
    if (otherActiveAdmins === 0) {
      return NextResponse.json(
        { error: "This is the last active admin account -- promote someone else to admin first." },
        { status: 400 }
      );
    }
  }

  const [
    reservations,
    payments,
    housekeepingTasks,
    maintenanceTickets,
    purchases,
    wastages,
    expenses,
    stockMovements,
    auditLogs,
  ] = await Promise.all([
    prisma.reservation.count({ where: { createdById: target.id } }),
    prisma.payment.count({ where: { cashierId: target.id } }),
    prisma.housekeepingTask.count({ where: { assigneeId: target.id } }),
    prisma.maintenanceTicket.count({ where: { assigneeId: target.id } }),
    prisma.purchase.count({ where: { createdById: target.id } }),
    prisma.wastage.count({ where: { recordedById: target.id } }),
    prisma.expense.count({ where: { requestedById: target.id } }),
    prisma.stockMovement.count({ where: { userId: target.id } }),
    prisma.auditLog.count({ where: { userId: target.id } }),
  ]);

  const hasHistory =
    reservations +
      payments +
      housekeepingTasks +
      maintenanceTickets +
      purchases +
      wastages +
      expenses +
      stockMovements +
      auditLogs >
    0;

  if (!hasHistory) {
    await prisma.user.delete({ where: { id: target.id } });
    return NextResponse.json({ ok: true, mode: "deleted", name: target.name });
  }

  await prisma.user.update({ where: { id: target.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true, mode: "deactivated", name: target.name });
}