import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExpensesClient from "@/components/expenses/ExpensesClient";

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const session = await getServerSession(authOptions);

  const expenses = await prisma.expense.findMany({
    include: { requestedBy: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const initialExpenses = expenses.map((e) => ({
    id: e.id,
    category: e.category,
    description: e.description,
    amount: Number(e.amount),
    paymentMethod: e.paymentMethod,
    supplier: e.supplier,
    reference: e.reference,
    status: e.status,
    requestedByName: e.requestedBy.name,
    createdAt: e.createdAt.toISOString(),
  }));

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const approvedThisMonth = initialExpenses
    .filter((e) => e.status === "APPROVED" && new Date(e.createdAt) >= startOfMonth)
    .reduce((s, e) => s + e.amount, 0);
  const pendingCount = initialExpenses.filter((e) => e.status === "PENDING_APPROVAL").length;

  return (
    <ExpensesClient
      initialExpenses={initialExpenses}
      approvedThisMonth={approvedThisMonth}
      pendingCount={pendingCount}
      currentUserRole={(session?.user as any)?.role ?? null}
    />
  );
}