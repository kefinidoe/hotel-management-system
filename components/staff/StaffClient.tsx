"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLES = ["ADMIN", "MANAGER", "RECEPTIONIST", "HOUSEKEEPER", "WAITER", "CASHIER", "ACCOUNTANT", "TECHNICIAN"];

export default function StaffClient({
  initialStaff,
  currentUserId,
  currentUserRole,
}: {
  initialStaff: StaffRow[];
  currentUserId: string | null;
  currentUserRole: string | null;
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = currentUserRole === "ADMIN";

  async function updateRole(id: string, role: string) {
    setBusyId(id);
    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    setBusyId(null);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not update role.");
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, role } : s)));
  }

  async function toggleActive(id: string, isActive: boolean) {
    setBusyId(id);
    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setBusyId(null);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Could not update status.");
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, isActive } : s)));
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1>Staff</h1>
          <p className="text-text-secondary text-sm mt-1">
            Everyone with access to this system, and what they’re allowed to do.
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)} className="btn-primary shrink-0">
            <Plus size={16} /> Add Staff
          </button>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-secondary border-b border-border">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const isSelf = s.id === currentUserId;
              return (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {s.name}
                    {isSelf && <span className="ml-2 text-xs text-text-muted">(you)</span>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{s.email}</td>
                  <td className="px-4 py-3">
                    {isAdmin && !isSelf ? (
                      <select
                        value={s.role}
                        onChange={(e) => updateRole(s.id, e.target.value)}
                        disabled={busyId === s.id}
                        className="rounded-control border border-border px-2 py-1 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="badge bg-primary-50 text-primary-700">{s.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{s.department || "—"}</td>
                  <td className="px-4 py-3">
                    {isAdmin && !isSelf ? (
                      <button
                        onClick={() => toggleActive(s.id, !s.isActive)}
                        disabled={busyId === s.id}
                        className={`badge ${
                          s.isActive ? "bg-success/10 text-success" : "bg-text-primary/10 text-text-secondary"
                        } cursor-pointer disabled:opacity-40`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </button>
                    ) : (
                      <span className={`badge ${s.isActive ? "bg-success/10 text-success" : "bg-text-primary/10 text-text-secondary"}`}>
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : "Never"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <AddStaffModal
          onClose={() => setAddOpen(false)}
          onCreated={(newStaff) => {
            setAddOpen(false);
            setStaff((prev) => [...prev, newStaff].sort((a, b) => a.name.localeCompare(b.name)));
          }}
        />
      )}
    </div>
  );
}

function AddStaffModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (staff: StaffRow) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("RECEPTIONIST");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, department: department || undefined }),
    });
    setLoading(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not create the account.");
      return;
    }
    onCreated({
      id: data.id,
      name,
      email,
      role,
      department: department || null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2>Add Staff</h2>
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
            <label className="text-xs text-text-secondary">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-control border border-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-control border border-border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Temporary Password</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full rounded-control border border-border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-secondary">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-control border border-border px-3 py-2 text-sm">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-secondary">Department (optional)</label>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-control border border-border px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}