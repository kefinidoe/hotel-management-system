import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.FINANCIAL_REPORTS);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  // Default: this calendar month.
  const now = new Date();
  const start = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endParam ? new Date(endParam) : now;
  // Make the end date inclusive of the whole day.
  const endInclusive = new Date(end);
  endInclusive.setHours(23, 59, 59, 999);

  const [folioItems, payments, expenses] = await Promise.all([
    prisma.folioItem.groupBy({
      by: ["type"],
      where: { createdAt: { gte: start, lte: endInclusive } },
      _sum: { total: true },
    }),
    prisma.payment.findMany({
      where: { createdAt: { gte: start, lte: endInclusive }, status: "COMPLETED" },
      include: { paymentMethod: true },
    }),
    prisma.expense.findMany({
      where: { createdAt: { gte: start, lte: endInclusive }, status: "APPROVED" },
    }),
  ]);

  const billed = folioItems.map((f) => ({
    type: f.type,
    total: Number(f._sum.total ?? 0),
  }));
  const billedTotal = billed.reduce((s, b) => s + b.total, 0);

  const collectedByMethod = new Map<string, number>();
  for (const p of payments) {
    const key = p.paymentMethod.name;
    collectedByMethod.set(key, (collectedByMethod.get(key) ?? 0) + Number(p.amount));
  }
  const collected = [...collectedByMethod.entries()].map(([method, total]) => ({ method, total }));
  const collectedTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

  const expensesByCategory = new Map<string, number>();
  for (const e of expenses) {
    expensesByCategory.set(e.category, (expensesByCategory.get(e.category) ?? 0) + Number(e.amount));
  }
  const expensesBreakdown = [...expensesByCategory.entries()].map(([category, total]) => ({ category, total }));
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return NextResponse.json({
    range: { start: start.toISOString(), end: endInclusive.toISOString() },
    billed,
    billedTotal,
    collected,
    collectedTotal,
    expensesBreakdown,
    expensesTotal,
    netCashFlow: collectedTotal - expensesTotal,
  });
}