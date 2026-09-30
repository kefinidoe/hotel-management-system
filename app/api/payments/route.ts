import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { folioTotals, parseMoney, roundMoney } from "@/lib/billing";

class PaymentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.ACCOMMODATION_PAYMENTS);
  if (forbidden) return forbidden;

  const body = await req.json();
  const folioId = typeof body.folioId === "string" ? body.folioId.trim() : "";
  const paymentMethodId =
    typeof body.paymentMethodId === "string" ? body.paymentMethodId.trim() : "";
  const reference = typeof body.reference === "string" ? body.reference.trim() : "";

  if (!folioId || !paymentMethodId) {
    return NextResponse.json(
      { error: "Folio and payment method are required." },
      { status: 400 }
    );
  }

  let amount: number;
  try {
    amount = parseMoney(body.amount, "Payment amount");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment amount is invalid." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const folio = await tx.folio.findUnique({
          where: { id: folioId },
          include: {
            items: { select: { total: true } },
            payments: {
              where: { status: "COMPLETED" },
              select: { amount: true },
            },
          },
        });
        if (!folio) throw new PaymentError("Folio not found.", 404);
        if (folio.isClosed) throw new PaymentError("Payments cannot be added to a closed folio.");

        const method = await tx.paymentMethod.findFirst({
          where: { id: paymentMethodId, isActive: true },
        });
        if (!method) throw new PaymentError("That payment method is unavailable.");

        const totals = folioTotals(
          folio.items.map((item) => Number(item.total)),
          folio.payments.map((payment) => Number(payment.amount))
        );
        if (totals.balance <= 0) {
          throw new PaymentError("This folio has no outstanding balance.");
        }
        if (amount > totals.balance) {
          throw new PaymentError(
            `Payment cannot exceed the outstanding balance of KSh ${totals.balance.toLocaleString()}.`
          );
        }

        const payment = await tx.payment.create({
          data: {
            folioId,
            paymentMethodId: method.id,
            amount,
            reference: reference || null,
            status: "COMPLETED",
            cashierId: session.user.id,
          },
        });

        return {
          id: payment.id,
          required: totals.required,
          paid: roundMoney(totals.paid + amount),
          balance: roundMoney(totals.balance - amount),
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
      }
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "The folio changed while recording payment. Refresh and try again." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not record the payment." }, { status: 500 });
  }
}
