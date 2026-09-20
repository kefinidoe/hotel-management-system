import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readCart, round2, cartTotal } from "@/lib/restaurant";
import { deductRecipeStock } from "@/lib/inventory";

const WALK_IN_GUEST = "Walk-in Guest";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const paymentMethodId: string | undefined = body.paymentMethodId;
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const tableNumber = typeof body.tableNumber === "string" ? body.tableNumber.trim() : "";
  const vatRate = Number(body.vatRate) || 0;
  const lines = readCart(body.items);

  if (lines.length === 0) {
    return NextResponse.json({ error: "Add at least one item to the order." }, { status: 400 });
  }
  if (!paymentMethodId) {
    return NextResponse.json({ error: "Choose how the guest is paying." }, { status: 400 });
  }

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) return NextResponse.json({ error: "Payment method not found." }, { status: 404 });

  const prefix = tableNumber ? `Restaurant (Table ${tableNumber})` : "Restaurant";
  const total = cartTotal(lines, vatRate);

  try {
    const result = await prisma.$transaction(async (tx) => {
      let guest = customerPhone
        ? await tx.guest.findFirst({ where: { phone: customerPhone } })
        : null;

      if (!guest && customerName) {
        guest = await tx.guest.create({
          data: { fullName: customerName, phone: customerPhone || null },
        });
      }
      if (!guest) {
        guest =
          (await tx.guest.findFirst({ where: { fullName: WALK_IN_GUEST } })) ??
          (await tx.guest.create({ data: { fullName: WALK_IN_GUEST } }));
      }

      const folio = await tx.folio.create({ data: { guestId: guest.id, isClosed: true } });

      for (const line of lines) {
        await tx.folioItem.create({
          data: {
            folioId: folio.id,
            type: "RESTAURANT",
            description: `${prefix} — ${line.name}`,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: vatRate,
            total: round2(line.quantity * line.unitPrice * (1 + vatRate / 100)),
          },
        });
      }

      await tx.payment.create({
        data: {
          folioId: folio.id,
          paymentMethodId,
          amount: total,
          reference: reference || null,
          status: "COMPLETED",
          cashierId: session.user.id,
        },
      });

      await deductRecipeStock(tx, lines, `Sold to ${guest.fullName}`, session.user.id);

      return { guestName: guest.fullName, folioId: folio.id };
    });

    return NextResponse.json({ ok: true, ...result, total, method: method.name }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not complete the order." }, { status: 400 });
  }
}