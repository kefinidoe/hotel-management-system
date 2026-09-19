"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Task = {
  id: string;
  status: string;
  priority: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  assigneeId: string | null;
  assigneeName: string | null;
};
type Staff = { id: string; name: string; role: string };

const COLUMNS: { key: string; label: string }[] = [
  { key: "NEEDS_CLEANING", label: "Needs Cleaning" },
  { key: "IN_PROGRESS", label: "Cleaning in Progress" },
  { key: "READY_FOR_INSPECTION", label: "Ready for Inspection" },
  { key: "READY", label: "Ready Rooms" },
];

export default function HousekeepingClient({
  initialTasks,
  staff,
}: {
  initialTasks: Task[];
  staff: Staff[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function updateTask(id: string, data: Record<string, string>) {
    setSavingId(id);
    setError(null);
    const res = await fetch(`/api/housekeeping/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSavingId(null);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Could not update task.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <h1>Housekeeping</h1>
      <p className="text-text-secondary text-sm mt-1 mb-6">
        Rooms move here automatically after checkout. Update status as cleaning progresses.
      </p>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = initialTasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key}>
              <h2 className="mb-3 text-sm">{col.label} ({items.length})</h2>
              <div className="space-y-3">
                {items.map((task) => (
                  <div key={task.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{task.roomNumber}</p>
                        <p className="text-xs text-text-secondary">{task.roomTypeName}</p>
                      </div>
                      <span className="badge bg-warning/10 text-warning capitalize">{task.priority}</span>
                    </div>

                    <select
                      value={task.assigneeId ?? ""}
                      disabled={savingId === task.id}
                      onChange={(e) => updateTask(task.id, { assigneeId: e.target.value })}
                      className="w-full mt-3 rounded-control border border-border px-2 py-1.5 text-xs"
                    >
                      <option value="">Unassigned</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={task.status}
                      disabled={savingId === task.id}
                      onChange={(e) => updateTask(task.id, { status: e.target.value })}
                      className="w-full mt-2 rounded-control border border-border px-2 py-1.5 text-xs"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.key} value={c.key}>
                          Move to: {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-text-muted">Nothing here.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
