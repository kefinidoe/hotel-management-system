"use client";

import { useState } from "react";
import { Plus, X, Check, XCircle } from "lucide-react";

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  supplier: string | null;
  reference: string | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  requestedByName: string;
  createdAt: string;
};

const STATUS_BADGE: Record<Expense["status"], string> = {
  PENDING_APPROVAL: "badge bg-warning/10 text-warning",
  APPROVED: "badge bg-success/10 text-success",
  REJECTED: "badge bg-danger/10 text-danger",
};
const STATUS_LABEL: Record<Expense["status"], string> = {
  PENDING_APPROVAL: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export default function ExpensesClient({
  initialExpenses,
  approvedThisMonth,
  pendingCount,
  currentUserRole,
}: {
  initialExpenses: Expense[];
  approvedThisMonth: number;
  pendingCount: number;
  currentUserRole: string | null;
}) {
  const [expenses, setExpenses] = useState(initialExpenses);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canApprove = currentUserRole === "ADMIN" || currentUserRole === "MANAGER";

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Could not update this expense.");
      return;
    }
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1>Expenses</h1>
          <p className="text-text-secondary text-sm mt-1">
            Track hotel spending. Every expense needs approval before it counts as final.
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary shrink-0">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
        <div className="card">
          <p className="text-xs text-text-muted">Approved This Month</p>
          <p className="text-xl font-semibold mt-1">KSh {approvedThisMonth.toLocaleString()}</p>
        </div>
        <div className="card">
          <p className="text-xs text-text-muted">Pending Approval</p>
          <p className="text-xl font-semibold mt-1">{pendingCount}</p>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Requested By</th>
              {canApprove && <th className="px-4 py-3 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 font-medium">{e.category}</td>
                <td className="px-4 py-3 text-text-secondary">{e.description}</td>
                <td className="px-4 py-3">KSh {e.amount.toLocaleString()}</td>
                <td className="px-4 py-3 text-text-secondary">{e.paymentMethod}</td>
                <td className="px-4 py-3">
                  <span className={STATUS_BADGE[e.status]}>{STATUS_LABEL[e.status]}</span>
                </td>
                <td className="px-4 py-3 text-text-secondary">{e.requestedByName}</td>
                {canApprove && (
                  <td className="px-4 py-3">
                    {e.status === "PENDING_APPROVAL" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => review(e.id, "APPROVED")}
                          disabled={busyId === e.id}
                          className="text-success hover:opacity-80 disabled:opacity-40"
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => review(e.id, "REJECTED")}
                          disabled={busyId === e.id}
                          className="text-danger hover:opacity-80 disabled:opacity-40"
                          title="Reject"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={canApprove ? 8 : 7} className="px-4 py-8 text-center text-text-secondary">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddExpenseModal
          onClose={() => setAddOpen(false)}
          onSaved={(expense) => {
            setAddOpen(false);
            setExpenses((prev) => [expense, ...prev]);
          }}
        />
      )}
    </div>
  );
}

function AddExpenseModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (expense: Expense) => void;
}) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        description,
        amount: Number(amount),
        paymentMethod,
        supplier: supplier || undefined,
        reference: reference || undefined,
      }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save this expense.");
      return;
    }
    onSaved({
      id: data.id,
      category,
      description,
      amount: Number(amount),
      paymentMethod,
      supplier: supplier || null,
      reference: reference || null,
      status: "PENDING_APPROVAL",
      requestedByName: "You",
      createdAt: data.createdAt,
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>Add Expense</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {error && (
          <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary">Category</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              placeholder="e.g. Utilities, Repairs, Supplies"
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary">Amount (KSh)</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-control border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-control border border-border px-3 py-2 text-sm"
              >
                <option>Cash</option>
                <option>M-Pesa</option>
                <option>Card</option>
                <option>Bank Transfer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-text-secondary">Supplier (optional)</label>
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Reference (optional)</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. receipt number"
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving..." : "Submit for Approval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}