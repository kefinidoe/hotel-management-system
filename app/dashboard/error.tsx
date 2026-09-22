"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isConnectionIssue = /reach database server|P1017|P1001|ETIMEDOUT|ECONNRESET/i.test(
    error.message
  );

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mb-4">
        <span className="text-danger text-xl font-semibold">!</span>
      </div>
      <h2 className="text-lg font-semibold">
        {isConnectionIssue ? "Connection hiccup" : "Something went wrong"}
      </h2>
      <p className="text-sm text-text-secondary mt-1 max-w-sm">
        {isConnectionIssue
          ? "Couldn't reach the database for a moment — this usually clears up on its own if the connection is unstable."
          : "This page ran into an unexpected error."}
      </p>
      <button onClick={() => reset()} className="btn-primary mt-5">
        Try again
      </button>
    </div>
  );
}