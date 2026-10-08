"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { APP_ROLES, type AppRole } from "@/lib/auth-constants";

export type SalarySlipEmployee = {
  id: string;
  name: string;
  department: string | null;
};

type SalarySlipPopupProps = {
  currentUserId: string;
  employees: SalarySlipEmployee[];
  role: AppRole;
  onClose: () => void;
};

type SalarySlip = {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByName: string | null;
  uploadedAt: string;
  url: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const CURRENT_YEAR = new Date().getFullYear();
const SALARY_SLIP_YEARS = Array.from(
  { length: CURRENT_YEAR - 1999 },
  (_, index) => CURRENT_YEAR - index,
);

export function SalarySlipPopup({ currentUserId, employees, role, onClose }: SalarySlipPopupProps) {
  const canManage = role === APP_ROLES.ADMIN || role === APP_ROLES.MANAGER;
  const currentEmployee = employees.find((employee) => employee.id === currentUserId) ?? null;
  const [selectedEmployee, setSelectedEmployee] = useState<SalarySlipEmployee | null>(canManage ? null : currentEmployee);

  if (!selectedEmployee) {
    return <EmployeePickerPopup employees={employees} onClose={onClose} onSelect={setSelectedEmployee} />;
  }

  return (
    <SalarySlipMonthsPopup
      employee={selectedEmployee}
      canManage={canManage}
      onBack={canManage ? () => setSelectedEmployee(null) : undefined}
      onClose={onClose}
    />
  );
}

function EmployeePickerPopup({
  employees,
  onClose,
  onSelect,
}: {
  employees: SalarySlipEmployee[];
  onClose: () => void;
  onSelect: (employee: SalarySlipEmployee) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return employees;
    }

    return employees.filter((employee) =>
      [employee.name, employee.department ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [employees, query]);

  return (
    <PopupFrame title="Salary Slip" eyebrow="Payroll" detail={`${employees.length} ${employees.length === 1 ? "employee" : "employees"}`} onClose={onClose}>
        <div className="border-b border-blue-100 bg-blue-50/60 px-5 py-3">
          <label className="relative block">
            <span className="sr-only">Search employees</span>
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-blue-500">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search employee"
              autoFocus
              className="h-10 w-full rounded-lg border border-blue-200 bg-white pl-10 pr-3 text-sm font-medium text-blue-950 outline-none placeholder:text-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {visibleEmployees.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {visibleEmployees.map((employee) => (
                <li key={employee.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(employee)}
                    className="group flex w-full min-w-0 items-center gap-3 rounded-lg border border-blue-100 bg-white px-3 py-3 text-left transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                      {getInitials(employee.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-blue-950">{employee.name}</span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-blue-500">
                        {employee.department?.trim() || "Department not set"}
                      </span>
                    </span>
                    <ArrowRightIcon />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No employees found" />
          )}
        </div>
    </PopupFrame>
  );
}

function SalarySlipMonthsPopup({ employee, canManage, onBack, onClose }: {
  employee: SalarySlipEmployee;
  canManage: boolean;
  onBack?: () => void;
  onClose: () => void;
}) {
  const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const salarySlipsByMonth = useMemo(() => {
    const groupedSlips = new Map<number, SalarySlip[]>();

    for (const salarySlip of salarySlips) {
      groupedSlips.set(salarySlip.month, [...(groupedSlips.get(salarySlip.month) ?? []), salarySlip]);
    }

    return groupedSlips;
  }, [salarySlips]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSalarySlips() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const params = new URLSearchParams({ employeeId: employee.id, year: String(selectedYear) });
        const response = await fetch(`/api/salary-slips?${params.toString()}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Salary slips could not be loaded.");
        }

        setSalarySlips(result.slips ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorMessage(error instanceof Error ? error.message : "Salary slips could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadSalarySlips();
    return () => controller.abort();
  }, [employee.id, refreshKey, selectedYear]);

  const openMonth = (month: number) => {
    const monthSalarySlips = salarySlipsByMonth.get(month) ?? [];

    if (canManage || monthSalarySlips.length > 0) {
      setSelectedMonth(month);
    }
  };

  return (
    <>
      <PopupFrame
        title={employee.name}
        eyebrow="Salary Slip"
        detail={employee.department?.trim() || "Department not set"}
        onBack={onBack}
        onClose={onClose}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-4 flex items-end justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3">
            <label className="block min-w-32">
              <span className="mb-1 block text-[10px] font-bold uppercase text-blue-600">Year</span>
              <select
                value={selectedYear}
                onChange={(event) => {
                  setSalarySlips([]);
                  setSelectedMonth(null);
                  setSelectedYear(Number(event.currentTarget.value));
                }}
                className="h-9 w-full rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {SALARY_SLIP_YEARS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
            <span className="pb-2 text-xs font-semibold text-blue-600">12 months</span>
          </div>
          {errorMessage ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-700">{errorMessage}</div> : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MONTHS.map((monthName, index) => {
              const month = index + 1;
              const monthSalarySlips = salarySlipsByMonth.get(month) ?? [];
              const fileCount = monthSalarySlips.length;
              return (
                <button
                  key={monthName}
                  type="button"
                  onClick={() => openMonth(month)}
                  disabled={isLoading || (!canManage && fileCount === 0)}
                  className="min-h-20 rounded-lg border border-blue-200 bg-white px-3 py-3 text-left transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-default disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <span className="block text-sm font-semibold">{monthName}</span>
                  <span className={`mt-2 inline-flex text-[10px] font-bold uppercase ${fileCount > 0 ? "text-emerald-700" : "text-slate-400"}`}>
                    {isLoading ? "Loading" : fileCount > 0 ? `${fileCount} ${fileCount === 1 ? "file" : "files"}` : "Not uploaded"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </PopupFrame>

      {selectedMonth ? (
        <SalarySlipFilesPopup
          employee={employee}
          month={selectedMonth}
          year={selectedYear}
          salarySlips={salarySlipsByMonth.get(selectedMonth) ?? []}
          canManage={canManage}
          onClose={() => setSelectedMonth(null)}
          onUploaded={() => {
            setSelectedMonth(null);
            setRefreshKey((current) => current + 1);
          }}
        />
      ) : null}
    </>
  );
}

function SalarySlipFilesPopup({ employee, month, year, salarySlips, canManage, onClose, onUploaded }: {
  employee: SalarySlipEmployee;
  month: number;
  year: number;
  salarySlips: SalarySlip[];
  canManage: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const uploadSalarySlip = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (files.length === 0) {
      setErrorMessage("Choose one or more PNG or PDF files.");
      return;
    }
    if (files.length > 10) {
      setErrorMessage("Upload up to 10 files at a time.");
      return;
    }
    if (files.some((file) => !["application/pdf", "image/png"].includes(file.type))) {
      setErrorMessage("Only PNG and PDF files are allowed.");
      return;
    }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setErrorMessage("Each salary-slip file must be 10 MB or smaller.");
      return;
    }

    setIsUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.set("employeeId", employee.id);
      formData.set("year", String(year));
      formData.set("month", String(month));
      files.forEach((file) => formData.append("files", file));
      const response = await fetch("/api/salary-slips", { method: "POST", body: formData });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Salary slip upload failed.");
      onUploaded();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Salary slip upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose} role="presentation">
      <section className="flex max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-blue-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.3)]" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="salary-slip-upload-title">
        <header className="flex items-start justify-between gap-4 border-b border-blue-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-blue-500">{MONTHS[month - 1]} {year}</p>
            <h2 id="salary-slip-upload-title" className="mt-1 truncate text-lg font-semibold text-blue-950">{employee.name}</h2>
            <p className="mt-1 text-xs font-semibold text-blue-600">{salarySlips.length} {salarySlips.length === 1 ? "file" : "files"}</p>
          </div>
          <CloseButton onClose={onClose} label="Close salary-slip files" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {salarySlips.length > 0 ? (
            <ul className="space-y-2">
              {salarySlips.map((salarySlip) => (
                <li key={salarySlip.id} className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                  <span className="inline-flex h-8 min-w-10 shrink-0 items-center justify-center rounded-md bg-white px-2 text-[10px] font-bold text-emerald-700">
                    {salarySlip.mimeType === "application/pdf" ? "PDF" : "PNG"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-emerald-950">{salarySlip.fileName}</span>
                    <span className="mt-0.5 block text-xs font-medium text-emerald-700">{formatFileSize(salarySlip.fileSize)}</span>
                  </span>
                  <a href={salarySlip.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100">View</a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No salary-slip files uploaded" />
          )}

          {canManage ? (
            <form onSubmit={uploadSalarySlip} className="mt-5 space-y-4 border-t border-blue-100 pt-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase text-blue-700">Add PNG or PDF files</span>
                <input
                  type="file"
                  multiple
                  accept=".png,.pdf,image/png,application/pdf"
                  onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
                  className="block w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                />
                <span className="mt-1.5 block text-xs font-medium text-blue-500">Up to 10 files, maximum 10 MB each</span>
              </label>
              {files.length > 0 ? <p className="text-xs font-semibold text-blue-700">{files.length} {files.length === 1 ? "file" : "files"} selected</p> : null}
              {errorMessage ? <p className="text-sm font-semibold text-red-600">{errorMessage}</p> : null}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="h-10 rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-800">Cancel</button>
                <button type="submit" disabled={isUploading || files.length === 0} className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isUploading ? "Uploading..." : "Upload Files"}
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 flex justify-end border-t border-blue-100 pt-4">
              <button type="button" onClick={onClose} className="h-10 rounded-lg border border-blue-200 px-4 text-sm font-semibold text-blue-800">Close</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PopupFrame({ title, eyebrow, detail, children, onBack, onClose }: {
  title: string;
  eyebrow: string;
  detail: string;
  children: ReactNode;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose} role="presentation">
      <section className="flex max-h-[min(42rem,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-blue-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="salary-slip-title">
        <header className="flex items-start justify-between gap-4 border-b border-blue-100 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {onBack ? (
              <button type="button" onClick={onBack} className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100" aria-label="Back to employees" title="Back">
                <BackIcon />
              </button>
            ) : null}
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase text-blue-500">{eyebrow}</p>
              <h2 id="salary-slip-title" className="mt-1 truncate text-xl font-semibold text-blue-950">{title}</h2>
              <p className="mt-1 text-xs font-semibold text-blue-600">{detail}</p>
            </div>
          </div>
          <CloseButton onClose={onClose} label="Close salary slip" />
        </header>
        {children}
      </section>
    </div>
  );
}

function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200" aria-label={label} title="Close">
      <CloseIcon />
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="px-4 py-12 text-center text-sm font-semibold text-blue-950">{message}</div>;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "E";
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-blue-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
