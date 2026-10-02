import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { folioTotals } from "@/lib/billing";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.ACCOMMODATION_PAYMENTS);
  if (forbidden) return forbidden;

  const folio = await prisma.folio.findUnique({
    where: { id },
    include: {
      guest: true,
      items: { orderBy: { createdAt: "asc" } },
      payments: {
        where: { status: "COMPLETED" },
        include: { paymentMethod: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!folio) return NextResponse.json({ error: "Folio not found." }, { status: 404 });

  const totals = folioTotals(
    folio.items.map((item) => Number(item.total)),
    folio.payments.map((payment) => Number(payment.amount))
  );

  return NextResponse.json({
    id: folio.id,
    guestName: folio.guest.fullName,
    isClosed: folio.isClosed,
    items: folio.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
    payments: folio.payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      method: payment.paymentMethod.name,
      reference: payment.reference,
      createdAt: payment.createdAt.toISOString(),
    })),
    required: totals.required,
    total: totals.required,
    paid: totals.paid,
    balance: totals.balance,
  });
}
