import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const item = await prisma.inventoryItem.update({
    where: { id: params.id },
    data: {
      name: body.name ?? undefined,
      category: body.category ?? undefined,
      unit: body.unit ?? undefined,
      reorderLevel: body.reorderLevel !== undefined ? body.reorderLevel : undefined,
      unitCost: body.unitCost !== undefined ? body.unitCost : undefined,
    },
  });
  return NextResponse.json(item);
}
