import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { cartTotal, readCartRequest, resolveCartLines, round2 } from "@/lib/restaurant";
import { deductRecipeStock } from "@/lib/inventory";

const WALK_IN_GUEST = "Walk-in Guest";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.RESTAURANT_POS);
  if (forbidden) return forbidden;

  const body = await req.json();
  const paymentMethodId: string | undefined = body.paymentMethodId;
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";
  const tableNumber = typeof body.tableNumber === "string" ? body.tableNumber.trim() : "";

  if (!paymentMethodId) {
    return NextResponse.json({ error: "Choose how the guest is paying." }, { status: 400 });
  }

  let requestedItems: ReturnType<typeof readCartRequest>;
  try {
    requestedItems = readCartRequest(body.items);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The order is invalid." },
      { status: 400 }
    );
  }
  if (requestedItems.length === 0) {
    return NextResponse.json({ error: "Add at least one item to the order." }, { status: 400 });
  }

  const prefix = tableNumber ? `Restaurant (Table ${tableNumber})` : "Restaurant";

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const lines = await resolveCartLines(tx, requestedItems);
        const total = cartTotal(lines);

        const method = await tx.paymentMethod.findFirst({
          where: { id: paymentMethodId, isActive: true },
        });
        if (!method) throw new Error("That payment method is unavailable.");

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
              taxRate: 0,
              total: round2(line.quantity * line.unitPrice),
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

        return {
          guestName: guest.fullName,
          folioId: folio.id,
          total,
          method: method.name,
        };
      },
      { timeout: 15000 }
    );

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not complete the order." },
      { status: 400 }
    );
  }
}
