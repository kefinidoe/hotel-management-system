"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, UserRound, CalendarRange, BedDouble } from "lucide-react";

type SearchResults = {
  guests: { id: string; fullName: string; phone: string | null; email: string | null }[];
  reservations: {
    id: string;
    code: string;
    status: string;
    checkInDate: string;
    guest: { fullName: string };
  }[];
  rooms: { id: string; number: string; status: string }[];
};

const EMPTY_RESULTS: SearchResults = { guests: [], reservations: [], rooms: [] };

export default function SearchBar() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Close the dropdown on outside click, so it doesn't stay open while
  // the receptionist works elsewhere on the page.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced fetch. An AbortController cancels the previous in-flight
  // request when a new keystroke arrives — without it, a slow earlier
  // response could arrive after a later one and overwrite fresher
  // results with stale ones.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Search request failed");
        const data: SearchResults = await res.json();
        setResults(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults(EMPTY_RESULTS);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const hasResults =
    results.guests.length > 0 || results.reservations.length > 0 || results.rooms.length > 0;

  function goTo(path: string) {
    setOpen(false);
    setQuery("");
    router.push(path);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search guests, reservations, rooms..."
          className="w-full rounded-control border border-border bg-bg pl-9 pr-9 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {loading && (
          <Loader2
            size={15}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted animate-spin"
          />
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-card border border-border bg-surface shadow-popover max-h-96 overflow-y-auto">
          {!loading && !hasResults && (
            <p className="px-4 py-3 text-sm text-text-secondary">
              No results for “{query}”
            </p>
          )}

          {results.guests.length > 0 && (
            <div className="py-1">
              <p className="px-4 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                Guests
              </p>
              {results.guests.map((g) => (
                <button
                  key={g.id}
                  onClick={() => goTo(`/dashboard/guests?highlight=${g.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm hover:bg-primary-50/60"
                >
                  <UserRound size={15} className="text-text-muted shrink-0" />
                  <span className="flex-1 truncate">{g.fullName}</span>
                  <span className="text-xs text-text-muted shrink-0">
                    {g.phone ?? g.email ?? ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.reservations.length > 0 && (
            <div className="py-1 border-t border-border">
              <p className="px-4 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                Reservations
              </p>
              {results.reservations.map((r) => (
                <button
                  key={r.id}
                  onClick={() => goTo(`/dashboard/reservations?highlight=${r.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm hover:bg-primary-50/60"
                >
                  <CalendarRange size={15} className="text-text-muted shrink-0" />
                  <span className="flex-1 truncate">
                    {r.code} — {r.guest.fullName}
                  </span>
                  <span className="text-xs text-text-muted capitalize shrink-0">
                    {r.status.toLowerCase().replace("_", " ")}
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.rooms.length > 0 && (
            <div className="py-1 border-t border-border">
              <p className="px-4 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-text-muted">
                Rooms
              </p>
              {results.rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => goTo(`/dashboard/rooms?highlight=${r.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm hover:bg-primary-50/60"
                >
                  <BedDouble size={15} className="text-text-muted shrink-0" />
                  <span className="flex-1 truncate">Room {r.number}</span>
                  <span className="text-xs text-text-muted capitalize shrink-0">
                    {r.status.toLowerCase().replace("_", " ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}