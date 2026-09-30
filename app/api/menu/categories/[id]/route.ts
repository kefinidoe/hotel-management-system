import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, ROLE_GROUPS } from "@/lib/authz";
import { isRequiredMenuCategory } from "@/lib/menu-categories";

class CategoryDeleteError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forbidden = requireRole(session, ROLE_GROUPS.MANAGEMENT);
  if (forbidden) return forbidden;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      const category = await tx.menuCategory.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!category) {
        throw new CategoryDeleteError("Menu category not found.", 404);
      }
      if (isRequiredMenuCategory(category.name)) {
        throw new CategoryDeleteError(
          `${category.name} is a required Restaurant POS category and cannot be deleted.`
        );
      }

      const activeItemCount = await tx.menuItem.count({
        where: { categoryId: category.id, isActive: true },
      });
      if (activeItemCount > 0) {
        throw new CategoryDeleteError(
          `Move or remove the ${activeItemCount} active menu item${
            activeItemCount === 1 ? "" : "s"
          } in "${category.name}" before deleting it.`,
          409
        );
      }

      // Preserve archived menu-item and recipe history by moving inactive
      // records to Ala carte before removing an otherwise empty category.
      const alaCarte = await tx.menuCategory.findFirst({
        where: { name: { equals: "Ala carte", mode: "insensitive" } },
        select: { id: true },
      });
      if (!alaCarte) {
        throw new CategoryDeleteError(
          "The required Ala carte category is missing. Refresh after applying all database migrations.",
          409
        );
      }
      await tx.menuItem.updateMany({
        where: { categoryId: category.id, isActive: false },
        data: { categoryId: alaCarte.id },
      });
      await tx.menuCategory.delete({ where: { id: category.id } });
      return category;
    });

    return NextResponse.json({ id: deleted.id, name: deleted.name });
  } catch (error) {
    if (error instanceof CategoryDeleteError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "This category is still in use and cannot be deleted." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not delete the menu category." },
      { status: 500 }
    );
  }
}
