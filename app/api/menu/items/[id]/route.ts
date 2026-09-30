import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const name =
    body.name === undefined
      ? undefined
      : typeof body.name === "string"
      ? body.name.trim()
      : "";
  const price = body.price === undefined ? undefined : Number(body.price);

  if (body.name !== undefined && !name) {
    return NextResponse.json({ error: "Item name is required." }, { status: 400 });
  }
  if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
    return NextResponse.json({ error: "Enter a valid non-negative price." }, { status: 400 });
  }

  const item = await prisma.menuItem.update({
    where: { id },
    data: { name, price },
  });
  return NextResponse.json({ id: item.id });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const forbidden = requireRole(session, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

   

  await prisma.menuItem.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}