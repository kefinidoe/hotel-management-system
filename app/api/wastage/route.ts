import { NextResponse } from "next/server";
import type { WastageReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

const WASTAGE_REASONS = new Set<WastageReason>([
  "SPOILAGE",
  "EXPIRED",
  "BURNT",
  "DAMAGED",
  "PREP_WASTE",
  "OTHER",
]);

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const wastages = await prisma.wastage.findMany({
    include: { inventoryItem: true, recordedBy: true, accountableUser: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(
    wastages.map((wastage) => ({
      id: wastage.id,
      itemName: wastage.inventoryItem.name,
      unit: wastage.inventoryItem.unit,
      quantity: Number(wastage.quantity),
      reason: wastage.reason,
      department: wastage.department,
      accountableName:
        wastage.accountableName ??
        wastage.accountableUser?.name ??
        "Not recorded (legacy entry)",
      recordedByName: wastage.recordedBy.name,
      createdAt: wastage.createdAt,
      value: Math.round(
        Number(wastage.quantity) * Number(wastage.inventoryItem.costPerUnit)
      ),
    }))
  );
}

// Recording wastage decreases stock and logs a StockMovement, atomically.
// The accountable person is separate from the manager who enters the record:
// for example, a manager can record an egg broken by a chef without making
// the manager appear responsible for the loss.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const inventoryItemId =
    typeof body.inventoryItemId === "string" ? body.inventoryItemId.trim() : "";
  const quantity = Number(body.quantity);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const department =
    typeof body.department === "string" ? body.department.trim() : "";
  const requestedAccountableUserId =
    typeof body.accountableUserId === "string"
      ? body.accountableUserId.trim()
      : "";
  const manualAccountableName =
    typeof body.accountableName === "string" ? body.accountableName.trim() : "";

  if (
    !inventoryItemId ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    !WASTAGE_REASONS.has(reason as WastageReason)
  ) {
    return NextResponse.json(
      { error: "Item, a positive quantity, and a valid reason are required." },
      { status: 400 }
    );
  }

  let accountableUserId: string | null = null;
  let accountableName = manualAccountableName;
  let accountableDepartment: string | null = null;

  if (requestedAccountableUserId) {
    const accountableUser = await prisma.user.findUnique({
      where: { id: requestedAccountableUserId },
      select: { id: true, name: true, department: true, isActive: true },
    });
    if (!accountableUser || !accountableUser.isActive) {
      return NextResponse.json(
        { error: "Choose an active staff member who is accountable for the wastage." },
        { status: 400 }
      );
    }
    accountableUserId = accountableUser.id;
    accountableName = accountableUser.name;
    accountableDepartment = accountableUser.department;
  }

  if (!accountableName) {
    return NextResponse.json(
      { error: "Choose or enter the person accountable for this wastage." },
      { status: 400 }
    );
  }
  if (accountableName.length > 120) {
    return NextResponse.json(
      { error: "The accountable person's name is too long." },
      { status: 400 }
    );
  }
  if (department.length > 100) {
    return NextResponse.json(
      { error: "The department name is too long." },
      { status: 400 }
    );
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: inventoryItemId },
  });
  if (!item) {
    return NextResponse.json(
      { error: "Inventory item not found." },
      { status: 404 }
    );
  }

  const before = Number(item.currentStock);
  if (quantity > before) {
    return NextResponse.json(
      {
        error: `Only ${before} ${item.unit} of "${item.name}" in stock — can't log wastage of ${quantity}. If the physical count is actually lower, use Adjust Stock instead.`,
      },
      { status: 400 }
    );
  }
  const after = before - quantity;
  const savedDepartment = department || accountableDepartment || null;

  const [wastage] = await prisma.$transaction([
    prisma.wastage.create({
      data: {
        inventoryItemId,
        quantity,
        reason: reason as WastageReason,
        department: savedDepartment,
        recordedById: auth.user.id,
        accountableUserId,
        accountableName,
      },
    }),
    prisma.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { currentStock: after },
    }),
    prisma.stockMovement.create({
      data: {
        inventoryItemId,
        type: "WASTAGE",
        quantity: -quantity,
        beforeQty: before,
        afterQty: after,
        reference: `Wastage: ${reason} — Accountable: ${accountableName}`,
        userId: auth.user.id,
      },
    }),
  ]);

  return NextResponse.json(
    { ...wastage, accountableName },
    { status: 201 }
  );
}
