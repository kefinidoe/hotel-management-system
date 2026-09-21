"use client";

import { useEffect, useState } from "react";
import { formatQty } from "@/lib/inventory";

type Movement = {
  id: string;
  itemName: string;
  unit: string;
  type: string;
  quantity: number;
  beforeQty: number;
  afterQty: number;
  reference: string | null;
  userName: string;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  PURCHASE: "Purchase",
  MEAL_SALE: "Meal Sale",
  WASTAGE: "Wastage",
  ADJUSTMENT: "Stock Adjustment",
  OPENING_BALANCE: "Opening Balance",
};

export default function MovementsTab() {
  const [movements, setMovements] = useState<Movement[] | null>(null);

  useEffect(() => {
    fetch("/api/stock-movements")
      .then((r) => r.json())
      .then(setMovements);
  }, []);

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-secondary border-b border-border">
            <th className="px-4 py-3 font-medium">Date &amp; Time</th>
            <th className="px-4 py-3 font-medium">Item</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Quantity</th>
            <th className="px-4 py-3 font-medium">Before → After</th>
            <th className="px-4 py-3 font-medium">Reference</th>
            <th className="px-4 py-3 font-medium">User</th>
          </tr>
        </thead>
        <tbody>
          {movements?.map((m) => (
            <tr key={m.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                {new Date(m.createdAt).toLocaleString()}
              </td>
              <td className="px-4 py-3 font-medium">{m.itemName}</td>
              <td className="px-4 py-3">{TYPE_LABEL[m.type] ?? m.type}</td>
              <td className={`px-4 py-3 ${m.quantity < 0 ? "text-danger" : "text-success"}`}>
                {m.quantity > 0 ? "+" : ""}
                {formatQty(m.quantity, m.unit)}
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {formatQty(m.beforeQty, m.unit)} → {formatQty(m.afterQty, m.unit)}
              </td>
              <td className="px-4 py-3 text-text-secondary">{m.reference || "—"}</td>
              <td className="px-4 py-3 text-text-secondary">{m.userName}</td>
            </tr>
          ))}
          {movements?.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                No stock movements yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}