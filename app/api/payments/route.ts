import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.ACCOMMODATION_PAYMENTS);
  if (forbidden) return forbidden;

  const body = await req.json();
  const { folioId, paymentMethodId, amount, reference } = body;

  if (!folioId || !paymentMethodId || !amount) {
    return NextResponse.json({ error: "Missing required payment fields." }, { status: 400 });
  }

  const payment = await prisma.payment.create({
    data: {
      folioId,
      paymentMethodId,
      amount,
      reference: reference || null,
      status: "COMPLETED",
      cashierId: session.user.id,
    },
  });

  return NextResponse.json({ id: payment.id }, { status: 201 });
}
