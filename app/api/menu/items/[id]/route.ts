import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });



  const body = await req.json();
  const item = await prisma.menuItem.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      price: body.price !== undefined ? Number(body.price) : undefined,
    },
  });
  return NextResponse.json({ id: item.id });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

   

  await prisma.menuItem.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}