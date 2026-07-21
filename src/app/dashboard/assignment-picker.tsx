"use client";

import React from "react";
import { useRouter } from "next/navigation";

export type AssignmentPickerAssignment = {
  id?: string;
  employeeId: string;
  assignedAt?: Date | string | null;
  status?: string | null;
  statusReason?: string | null;
  statusSubmittedAt?: Date | string | null;
  closedAt?: Date | string | null;
  employee?: { name: string } | null;
};

type AssignmentPickerProps = {
  requestId: string;
  employees: Array<{ id: string; name: string }>;
  assignments?: AssignmentPickerAssignment[];
  defaultEmployeeId?: string | null;
  compact?: boolean;
  disabled?: boolean;
  disabledMessage?: string;
};

function getInitialRows(assignments: AssignmentPickerAssignment[] | undefined, defaultEmployeeId?: string | null) {
  const selected = assignments?.map((assignment) => assignment.employeeId).filter(Boolean) ?? [];

  if (selected.length > 0) {
    return selected;
  }

  if (defaultEmployeeId) {
    return [defaultEmployeeId];
  }

  return [""];
}

function getUniqueSelected(rows: string[]) {
  return Array.from(new Set(rows.map((row) => row.trim()).filter(Boolean)));
}

export function AssignmentPicker({
  requestId,
  employees,
  assignments,
  defaultEmployeeId,
  compact = false,
  disabled = false,
  disabledMessage,
}: AssignmentPickerProps) {
  const router = useRouter();
  const [rows, setRows] = React.useState(() => getInitialRows(assignments, defaultEmployeeId));
  const [isSaving, setIsSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const saveAssignments = async (nextRows: string[]) => {
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId,
          assignedToIds: getUniqueSelected(nextRows),
        }),
      });
      const json = await response.json();

      if (!json.success) {
        setMessage(json.message || "Allocation failed");
        return;
      }

      setMessage("Allocation saved");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Allocation failed");
    } finally {
      setIsSaving(false);
    }
  };

  const updateRow = (index: number, employeeId: string) => {
    const nextRows = [...rows];
    nextRows[index] = employeeId;

    const compactRows = nextRows.filter((row) => row !== "");
    const rowsToShow = compactRows.length > 0 ? compactRows : [""];

    setRows(rowsToShow);
    void saveAssignments(rowsToShow);
  };

  const addRow = () => {
    setRows((currentRows) => [...currentRows, ""]);
  };

  const removeRow = (index: number) => {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    const rowsToShow = nextRows.length > 0 ? nextRows : [""];

    setRows(rowsToShow);
    void saveAssignments(rowsToShow);
  };

  return (
    <div className="space-y-1.5">
      {disabled && disabledMessage ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-600">
          {disabledMessage}
        </p>
      ) : null}
      {rows.map((employeeId, index) => {
        const selectedInOtherRows = new Set(rows.filter((_, rowIndex) => rowIndex !== index));
        const isLastRow = index === rows.length - 1;

        return (
          <div key={`${index}-${employeeId || "empty"}`} className="flex items-center gap-1.5">
            <select
              value={employeeId}
              onChange={(event) => updateRow(index, event.currentTarget.value)}
              disabled={disabled || isSaving}
              className={`min-w-0 flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400 ${
                compact ? "" : "sm:min-w-[9.5rem]"
              } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500`}
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id} disabled={selectedInOtherRows.has(employee.id)}>
                  {employee.name}
                </option>
              ))}
            </select>

            {isLastRow ? (
              <button
                type="button"
                onClick={addRow}
                disabled={disabled || isSaving}
                aria-label="Add employee allocation"
                title="Add employee"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlusIcon />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={disabled || isSaving}
                aria-label="Remove employee allocation"
                title="Remove employee"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MinusIcon />
              </button>
            )}
          </div>
        );
      })}

      {message ? <p className="text-[11px] font-medium text-blue-700">{message}</p> : null}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M6 12H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
