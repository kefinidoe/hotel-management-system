import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

// Approve or reject a pending expense. Only ADMIN/MANAGER can do this --
// the person who submitted an expense can't also be the one who approves it.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const status = body.status as "APPROVED" | "REJECTED";
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: "status must be APPROVED or REJECTED." }, { status: 400 });
  }

  const expense = await prisma.expense.findUnique({ where: { id: params.id } });
  if (!expense) return NextResponse.json({ error: "Expense not found." }, { status: 404 });
  if (expense.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "This expense has already been reviewed." }, { status: 400 });
  }

  const updated = await prisma.expense.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json(updated);
}