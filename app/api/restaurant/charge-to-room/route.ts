import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { cartTotal, readCartRequest, resolveCartLines, round2 } from "@/lib/restaurant";
import { deductRecipeStock } from "@/lib/inventory";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.RESTAURANT_POS);
  if (forbidden) return forbidden;

  const body = await req.json();
  const folioId: string | undefined = body.folioId;
  const tableNumber = typeof body.tableNumber === "string" ? body.tableNumber.trim() : "";

  if (!folioId) {
    return NextResponse.json({ error: "Choose the guest to charge the order to." }, { status: 400 });
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
        const folio = await tx.folio.findUnique({
          where: { id: folioId },
          include: { guest: true },
        });
        if (!folio) throw new Error("Folio not found.");
        if (folio.isClosed) {
          throw new Error("That folio is already closed — take payment for this order instead.");
        }

        const lines = await resolveCartLines(tx, requestedItems);
        const total = cartTotal(lines);

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

        await deductRecipeStock(
          tx,
          lines,
          `Charged to ${folio.guest.fullName}`,
          session.user.id
        );

        return { guestName: folio.guest.fullName, total };
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
