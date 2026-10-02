"use client";

import { useState } from "react";
import { KeyRound, Plus, Trash2, X } from "lucide-react";

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
  const [passwordTarget, setPasswordTarget] = useState<StaffRow | null>(null);
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

  async function deleteStaff(member: StaffRow) {
    if (
      !confirm(
        `Delete ${member.name}'s account?\n\nIf they've never created a reservation, taken a payment, or logged any ` +
          `stock, housekeeping or maintenance work, the account is removed for good. If they have any history, the ` +
          `account is deactivated instead (they can no longer sign in) so their past records still make sense.`
      )
    ) {
      return;
    }

    setBusyId(member.id);
    const res = await fetch(`/api/staff/${member.id}`, { method: "DELETE" });
    setBusyId(null);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.error ?? "Could not delete this account.");
      return;
    }

    if (data.mode === "deleted") {
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    } else {
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, isActive: false } : s)));
      alert(
        `${member.name} has work on record (payments, reservations or similar), so the account was deactivated ` +
          `rather than deleted. They can no longer sign in, and their past records stay intact.`
      );
    }
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
              {isAdmin && <th className="px-4 py-3 font-medium text-right">Actions</th>}
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
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                        <button
                          onClick={() => setPasswordTarget(s)}
                          disabled={busyId === s.id}
                          title={`Set a new password for ${s.name}`}
                          className="inline-flex items-center gap-1 text-text-secondary text-xs font-medium hover:text-primary-600 hover:underline disabled:opacity-40"
                        >
                          <KeyRound size={14} />
                          Set Password
                        </button>
                        {!isSelf && (
                          <button
                            onClick={() => deleteStaff(s)}
                            disabled={busyId === s.id}
                            title={`Delete ${s.name}'s account`}
                            className="inline-flex items-center gap-1 text-danger text-xs font-medium hover:underline disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
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

      {passwordTarget && (
        <SetPasswordModal
          member={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onDone={() => {
            const member = passwordTarget;
            setPasswordTarget(null);
            if (member) {
              alert(
                `A new password is set for ${member.name}. Tell them in person or by phone — ` +
                  `it can't be read back from the system later.`
              );
            }
          }}
        />
      )}
    </div>
  );
}

// Admin sets a new password for someone else -- the "receptionist forgot their
// password" path. No current password needed; the admin is already authenticated
// and this route is ADMIN-only.
function SetPasswordModal({
  member,
  onClose,
  onDone,
}: {
  member: StaffRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function generate() {
    // Same shape as the CLI generator: unambiguous characters only, so it can be
    // read out over the phone without "is that a one or an ell?".
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^*_=+";
    let out = "";
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 16; i++) out += alphabet[bytes[i] % alphabet.length];
    setNewPassword(out);
    setConfirmPassword(out);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    setLoading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not set the password.");
      return;
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-1">
          <h2>Set Password</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          for <span className="font-medium text-text-primary">{member.name}</span> ({member.email})
        </p>

        <form onSubmit={submit} className="space-y-3">
          {error && (
            <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-text-secondary">New Password</label>
              <button
                type="button"
                onClick={generate}
                className="text-xs text-primary-600 hover:underline"
              >
                Generate one
              </button>
            </div>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full rounded-control border border-border px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary">Confirm Password</label>
            <input
              type="text"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-control border border-border px-3 py-2 text-sm font-mono"
            />
          </div>

          <p className="text-xs text-text-secondary">
            Write it down or tell them now — it can&apos;t be read back later. They can change it
            themselves afterwards using the key icon in the top bar.
          </p>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? "Saving..." : "Set Password"}
            </button>
          </div>
        </form>
      </div>
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