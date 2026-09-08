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
  statusPointsDelta?: number | null;
  statusPointsApproval?: string | null;
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

function getAssignedEmployeeIds(assignments: AssignmentPickerAssignment[] | undefined, defaultEmployeeId?: string | null) {
  const selected = assignments?.map((assignment) => assignment.employeeId).filter(Boolean) ?? [];

  if (defaultEmployeeId) {
    selected.push(defaultEmployeeId);
  }

  return selected.filter((employeeId, index, array) => employeeId && array.indexOf(employeeId) === index);
}

function getAssignedEmployeeRows(
  assignments: AssignmentPickerAssignment[] | undefined,
  employees: Array<{ id: string; name: string }>,
  defaultEmployeeId?: string | null,
) {
  const byEmployeeId = new Map<string, { employeeId: string; name: string; isSubmitted: boolean }>();

  for (const assignment of assignments ?? []) {
    if (!assignment.employeeId) {
      continue;
    }

    byEmployeeId.set(assignment.employeeId, {
      employeeId: assignment.employeeId,
      name: assignment.employee?.name ?? employees.find((employee) => employee.id === assignment.employeeId)?.name ?? "Employee",
      isSubmitted: Boolean(assignment.statusSubmittedAt || assignment.closedAt),
    });
  }

  if (defaultEmployeeId && !byEmployeeId.has(defaultEmployeeId)) {
    byEmployeeId.set(defaultEmployeeId, {
      employeeId: defaultEmployeeId,
      name: employees.find((employee) => employee.id === defaultEmployeeId)?.name ?? "Employee",
      isSubmitted: false,
    });
  }

  return Array.from(byEmployeeId.values());
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
  const assignedEmployeeIds = React.useMemo(
    () => getAssignedEmployeeIds(assignments, defaultEmployeeId),
    [assignments, defaultEmployeeId],
  );
  const assignedEmployeeRows = React.useMemo(
    () => getAssignedEmployeeRows(assignments, employees, defaultEmployeeId),
    [assignments, employees, defaultEmployeeId],
  );
  const [rows, setRows] = React.useState([""]);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState("");

  React.useEffect(() => {
    setRows([""]);
  }, [requestId, assignedEmployeeIds.join(",")]);

  const saveAssignments = async (selectedEmployeeIds: string[]) => {
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/assign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId,
          assignedToIds: selectedEmployeeIds,
        }),
      });
      const json = await response.json();

      if (!json.success) {
        setErrorMessage(json.message || "Allocation failed");
        return false;
      }

      setSuccessMessage(selectedEmployeeIds.length > 0 ? "Assigned successfully." : "Allocation removed successfully.");
      setRows([""]);
      router.refresh();
      return true;
    } catch (error) {
      console.error(error);
      setErrorMessage("Allocation failed");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const updateRow = (index: number, employeeId: string) => {
    const nextRows = [...rows];
    nextRows[index] = employeeId;

    const compactRows = nextRows.filter((row) => row !== "");
    const rowsToShow = compactRows.length > 0 ? compactRows : [""];
    const selectedEmployeeIds = getUniqueSelected([...assignedEmployeeIds, ...rowsToShow]);

    setRows(rowsToShow);
    void saveAssignments(selectedEmployeeIds);
  };

  const addRow = () => {
    setRows((currentRows) => [...currentRows, ""]);
  };

  const removeRow = (index: number) => {
    const nextRows = rows.filter((_, rowIndex) => rowIndex !== index);
    setRows(nextRows.length > 0 ? nextRows : [""]);
  };

  const removeAssignedEmployee = (employeeId: string) => {
    void saveAssignments(assignedEmployeeIds.filter((assignedEmployeeId) => assignedEmployeeId !== employeeId));
  };

  return (
    <>
      <div className="space-y-1.5">
        {disabled && disabledMessage ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium text-slate-600">
            {disabledMessage}
          </p>
        ) : null}
        {assignedEmployeeRows.length > 0 ? (
          <div className="space-y-1">
            {assignedEmployeeRows.map((assignedEmployee) => (
              <div
                key={assignedEmployee.employeeId}
                className="flex items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-2 py-1.5 text-xs font-semibold text-blue-900"
              >
                <span className="min-w-0 flex-1 truncate">{assignedEmployee.name}</span>
                <button
                  type="button"
                  onClick={() => removeAssignedEmployee(assignedEmployee.employeeId)}
                  disabled={disabled || isSaving || assignedEmployee.isSubmitted}
                  aria-label={`Remove ${assignedEmployee.name} allocation`}
                  title={assignedEmployee.isSubmitted ? "Submitted allocation is kept for history" : "Remove employee"}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MinusIcon />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {rows.map((employeeId, index) => {
          const selectedInOtherRows = new Set([...assignedEmployeeIds, ...rows.filter((_, rowIndex) => rowIndex !== index)]);
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
                  aria-label="Remove employee selection"
                  title="Remove selection"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MinusIcon />
                </button>
              )}
            </div>
          );
        })}

        {errorMessage ? <p className="text-[11px] font-medium text-red-600">{errorMessage}</p> : null}
      </div>

      {successMessage ? <AssignmentSuccessPopup message={successMessage} onClose={() => setSuccessMessage("")} /> : null}
    </>
  );
}

function AssignmentSuccessPopup({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-success-title"
      >
        <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckIcon />
        </div>
        <p id="assignment-success-title" className="mt-3 text-base font-semibold text-blue-950">
          {message}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-10 min-w-24 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
        >
          OK
        </button>
      </div>
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

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
