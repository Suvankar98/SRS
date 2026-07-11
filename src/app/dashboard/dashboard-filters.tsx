"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

type DashboardStatus = "New Call" | "In Process" | "Completed" | "Cancel";

const STATUS_OPTIONS: Array<{ label: string; value: DashboardStatus }> = [
  { label: "New Call", value: "New Call" },
  { label: "Process", value: "In Process" },
  { label: "Completed", value: "Completed" },
  { label: "Cancel", value: "Cancel" },
];

export function DashboardFilters({
  initialQuery,
  initialStatuses,
}: {
  initialQuery: string;
  initialStatuses: DashboardStatus[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);
  const [selectedStatuses, setSelectedStatuses] = React.useState<DashboardStatus[]>(initialStatuses);
  const deferredQuery = React.useDeferredValue(query);

  React.useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const normalizedQuery = deferredQuery.trim();

    if (normalizedQuery) {
      nextParams.set("q", normalizedQuery);
    } else {
      nextParams.delete("q");
    }

    nextParams.delete("status");
    for (const status of selectedStatuses) {
      nextParams.append("status", status);
    }

    const nextQueryString = nextParams.toString();
    const currentQueryString = searchParams.toString();

    if (nextQueryString === currentQueryString) {
      return;
    }

    router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname, { scroll: false });
  }, [deferredQuery, pathname, router, searchParams, selectedStatuses]);

  function toggleStatus(status: DashboardStatus) {
    setSelectedStatuses((currentStatuses) =>
      currentStatuses.includes(status)
        ? currentStatuses.filter((currentStatus) => currentStatus !== status)
        : [...currentStatuses, status],
    );
  }

  function clearFilters() {
    setQuery("");
    setSelectedStatuses([]);
    router.replace(pathname, { scroll: false });
  }

  const hasActiveFilters = query.trim() !== "" || selectedStatuses.length > 0;

  return (
    <div className="w-full min-w-0 rounded-[1.5rem] bg-white/70 p-1">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docket, customer, phone, location"
            className="w-full rounded-full border border-blue-200/90 bg-white px-4 py-2.5 text-sm text-blue-950 shadow-sm outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 sm:self-stretch"
          >
            Clear
          </button>
        )}
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-4 gap-2 text-[11px] font-medium text-blue-800 sm:text-xs">
        {STATUS_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-1.5 py-1.5 transition sm:gap-2 sm:px-2 ${
              selectedStatuses.includes(option.value)
                ? "border-blue-300 bg-blue-100 text-blue-900 shadow-sm"
                : "border-blue-200 bg-white/90 text-blue-700 hover:bg-blue-50"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedStatuses.includes(option.value)}
              onChange={() => toggleStatus(option.value)}
              className="h-3.5 w-3.5 rounded border-blue-300 text-blue-700 focus:ring-blue-400"
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
