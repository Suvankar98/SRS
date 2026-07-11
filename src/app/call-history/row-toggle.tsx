"use client";

import { useState, type ReactNode } from "react";

type CallHistoryColumnToggleItem = {
  id: string;
  label: string;
};

type CallHistoryColumnToggleProps = {
  children: ReactNode;
  columns: CallHistoryColumnToggleItem[];
};

export function CallHistoryColumnToggle({ children, columns = [] }: CallHistoryColumnToggleProps) {
  const [hiddenColumnIds, setHiddenColumnIds] = useState<string[]>([]);
  const visibleCount = columns.length - hiddenColumnIds.length;

  function toggleColumn(columnId: string) {
    setHiddenColumnIds((current) =>
      current.includes(columnId)
        ? current.filter((id) => id !== columnId)
        : [...current, columnId],
    );
  }

  return (
    <>
      {hiddenColumnIds.length > 0 ? (
        <style>
          {hiddenColumnIds
            .map((id) => `[data-call-history-column="${escapeAttributeValue(id)}"]{display:none;}`)
            .join("\n")}
        </style>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-blue-700">
          {visibleCount} of {columns.length} columns visible
        </p>
        <details className="relative">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700 outline-none transition hover:bg-blue-100 focus:ring-2 focus:ring-blue-200">
            Heads
            <span aria-hidden="true" className="text-sm leading-none">&gt;</span>
          </summary>
          <div className="absolute right-0 z-20 mt-2 max-h-80 w-56 overflow-y-auto rounded-2xl border border-blue-200 bg-white p-2 shadow-xl">
            {columns.map((column) => {
              const checked = !hiddenColumnIds.includes(column.id);

              return (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-blue-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleColumn(column.id)}
                    className="h-4 w-4 rounded border-blue-300 text-blue-700 focus:ring-blue-300"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-blue-950">{column.label}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </details>
      </div>

      {visibleCount > 0 ? (
        children
      ) : (
        <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 px-4 py-8 text-center text-sm font-medium text-blue-700">
          All call history columns are hidden. Select a heading from the dropdown to show the table again.
        </div>
      )}
    </>
  );
}

function escapeAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
