"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CALL_HISTORY_VISIBLE_COLUMNS_EVENT,
  CALL_HISTORY_VISIBLE_COLUMNS_STORAGE_KEY,
} from "./row-toggle";

type ExportLinksProps = {
  baseQuery: string;
  columns: Array<{ id: string; label: string }>;
};

export function CallHistoryExportLinks({ baseQuery, columns }: ExportLinksProps) {
  const columnIds = useMemo(() => columns.map((column) => column.id), [columns]);
  const [visibleColumnIds, setVisibleColumnIds] = useState(columnIds);

  useEffect(() => {
    const readVisibleColumns = () => {
      const stored = window.localStorage.getItem(CALL_HISTORY_VISIBLE_COLUMNS_STORAGE_KEY);
      if (!stored) {
        setVisibleColumnIds(columnIds);
        return;
      }

      const nextVisible = stored
        .split(",")
        .map((id) => id.trim())
        .filter((id) => columnIds.includes(id));
      setVisibleColumnIds(nextVisible.length > 0 ? nextVisible : columnIds);
    };

    readVisibleColumns();

    const handleVisibleColumnsChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ visibleIds?: string[] }>;
      const nextVisible = (customEvent.detail?.visibleIds ?? []).filter((id) => columnIds.includes(id));
      setVisibleColumnIds(nextVisible.length > 0 ? nextVisible : columnIds);
    };

    window.addEventListener(CALL_HISTORY_VISIBLE_COLUMNS_EVENT, handleVisibleColumnsChange);
    return () => window.removeEventListener(CALL_HISTORY_VISIBLE_COLUMNS_EVENT, handleVisibleColumnsChange);
  }, [columnIds]);

  const csvExportHref = buildExportHref("csv", baseQuery, visibleColumnIds);
  const pdfExportHref = buildExportHref("pdf", baseQuery, visibleColumnIds);

  return (
    <>
      <a href={csvExportHref} className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50">Download CSV</a>
      <a href={pdfExportHref} className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50">Download PDF</a>
    </>
  );
}

function buildExportHref(format: "csv" | "pdf", baseQuery: string, visibleColumnIds: string[]) {
  const params = new URLSearchParams(baseQuery);
  params.set("format", format);
  params.set("columns", visibleColumnIds.join(","));
  return `/api/report/export?${params.toString()}`;
}
