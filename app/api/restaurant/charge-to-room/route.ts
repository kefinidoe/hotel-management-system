import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readCart, round2, cartTotal } from "@/lib/restaurant";
import { deductRecipeStock } from "@/lib/inventory";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const folioId: string | undefined = body.folioId;
  const tableNumber = typeof body.tableNumber === "string" ? body.tableNumber.trim() : "";
  const vatRate = Number(body.vatRate) || 0;
  const lines = readCart(body.items);

  if (!folioId) {
    return NextResponse.json({ error: "Choose the guest to charge the order to." }, { status: 400 });
  }
  if (lines.length === 0) {
    return NextResponse.json({ error: "Add at least one item to the order." }, { status: 400 });
  }

  const folio = await prisma.folio.findUnique({
    where: { id: folioId },
    include: { guest: true },
  });
  if (!folio) return NextResponse.json({ error: "Folio not found." }, { status: 404 });
  if (folio.isClosed) {
    return NextResponse.json(
      { error: "That folio is already closed — take payment for this order instead." },
      { status: 400 }
    );
  }

  const prefix = tableNumber ? `Restaurant (Table ${tableNumber})` : "Restaurant";
  const total = cartTotal(lines, vatRate);

  try {
    await prisma.$transaction(async (tx) => {
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

      await deductRecipeStock(tx, lines, `Charged to ${folio.guest.fullName}`, session.user.id);
    }, { timeout: 15000 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Could not complete the order." }, { status: 400 });
  }

  return NextResponse.json(
    { ok: true, guestName: folio.guest.fullName, total },
    { status: 201 }
  );
}