import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { REQUIRED_MENU_CATEGORIES } from "@/lib/menu-categories";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forbidden = requireRole(session, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  const body = await req.json();
  const requestedName =
    typeof body.name === "string" ? body.name.trim() : "";
  if (!requestedName) {
    return NextResponse.json(
      { error: "Category name is required." },
      { status: 400 }
    );
  }
  if (requestedName.length > 80) {
    return NextResponse.json(
      { error: "Category name is too long." },
      { status: 400 }
    );
  }

  const canonicalName =
    REQUIRED_MENU_CATEGORIES.find(
      (name) => name.toLowerCase() === requestedName.toLowerCase()
    ) ?? requestedName;

  // Menu category names are treated as case-insensitive even though the
  // underlying PostgreSQL text column is case-sensitive.
  const categories = await prisma.menuCategory.findMany({
    select: { id: true, name: true },
  });
  const duplicate = categories.find(
    (category) =>
      category.name.trim().toLowerCase() === canonicalName.toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json(
      { error: `A category named "${duplicate.name}" already exists.` },
      { status: 409 }
    );
  }

  const category = await prisma.menuCategory.create({
    data: { name: canonicalName },
  });
  return NextResponse.json(
    { id: category.id, name: category.name },
    { status: 201 }
  );
}
