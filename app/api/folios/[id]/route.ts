import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const folio = await prisma.folio.findUnique({
    where: { id: params.id },
    include: {
      guest: true,
      items: { orderBy: { createdAt: "asc" } },
      payments: { include: { paymentMethod: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!folio) return NextResponse.json({ error: "Folio not found." }, { status: 404 });

  const itemsTotal = folio.items.reduce((s, i) => s + Number(i.total), 0);
  const paidTotal = folio.payments.reduce((s, p) => s + Number(p.amount), 0);

  return NextResponse.json({
    id: folio.id,
    guestName: folio.guest.fullName,
    isClosed: folio.isClosed,
    items: folio.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
    })),
    payments: folio.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.paymentMethod.name,
      reference: p.reference,
    })),
    total: itemsTotal,
    paid: paidTotal,
    balance: itemsTotal - paidTotal,
  });
}