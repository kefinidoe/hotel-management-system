"use client";

import { useState } from "react";
import { X } from "lucide-react";

// Change your own password. Requires the current one, so having a borrowed or
// stolen session isn't enough to take over the account.
export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("The two new passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setLoading(false);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not change your password.");
      return;
    }

    setDone(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2>Change Password</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm text-success bg-success/5 border border-success/20 rounded-control px-3 py-2">
              Your password has been changed. Use the new one next time you sign in.
            </p>
            <p className="text-xs text-text-secondary">
              Sessions already open elsewhere stay signed in until they expire. If you think
              someone else had your old password, ask an admin to deactivate and re-enable your
              account to force those sessions out.
            </p>
            <button onClick={onClose} className="btn-primary w-full">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && (
              <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-control px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label className="text-xs text-text-secondary">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-control border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="w-full rounded-control border border-border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-control border border-border px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading ? "Saving..." : "Change Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
