import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { logout } from "../actions";
import { normalizeStatus } from "../status-utils";
import { EmployeePointsPopup } from "./employee-points-popup";
import { EmployeeReportPopup } from "./employee-report-popup";
import { EmployeeReportTable } from "./employee-report-table";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import {
  buildEmployeeReportRows,
  type EmployeeReportRequest,
} from "@/lib/employee-report";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ReportPointFilter =
  | ""
  | "monthly-positive"
  | "monthly-zero"
  | "monthly-negative"
  | "all-time-positive"
  | "all-time-zero"
  | "all-time-negative";

type ReportSort =
  | "monthly-desc"
  | "monthly-asc"
  | "all-time-desc"
  | "all-time-asc"
  | "name-asc"
  | "name-desc";

const REPORT_POINT_FILTERS: Array<{ value: ReportPointFilter; label: string }> = [
  { value: "", label: "All points" },
  { value: "monthly-positive", label: "Monthly positive" },
  { value: "monthly-zero", label: "Monthly zero" },
  { value: "monthly-negative", label: "Monthly negative" },
  { value: "all-time-positive", label: "All-time positive" },
  { value: "all-time-zero", label: "All-time zero" },
  { value: "all-time-negative", label: "All-time negative" },
];

const REPORT_SORT_OPTIONS: Array<{ value: ReportSort; label: string }> = [
  { value: "monthly-desc", label: "Monthly high to low" },
  { value: "monthly-asc", label: "Monthly low to high" },
  { value: "all-time-desc", label: "All-time high to low" },
  { value: "all-time-asc", label: "All-time low to high" },
  { value: "name-asc", label: "Name A to Z" },
  { value: "name-desc", label: "Name Z to A" },
];

const employeeReportRequestSelect = {
  id: true,
  docketNumber: true,
  name: true,
  company: true,
  area: true,
  status: true,
  statusReason: true,
  statusPointsDelta: true,
  assignedToId: true,
  createdAt: true,
  assignedAt: true,
  statusSubmittedAt: true,
  lastAttemptAt: true,
  lastAttemptByName: true,
  closedAt: true,
  closedByName: true,
} satisfies Prisma.ServiceRequestSelect;

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (!roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const searchQuery = getSearchParamValue(resolvedSearchParams.q).trim();
  const selectedPointFilter = getReportPointFilter(getSearchParamValue(resolvedSearchParams.points));
  const selectedSort = getReportSort(getSearchParamValue(resolvedSearchParams.sort));

  const employees = await prisma.user.findMany({
    where: { role: APP_ROLES.EMPLOYEE },
    select: {
      id: true,
      name: true,
      performancePoints: true,
      monthlyPerformancePoints: true,
      pointAdjustments: {
        orderBy: { createdAt: "desc" },
        take: 120,
        select: {
          id: true,
          attendanceOption: true,
          attendancePoints: true,
          reviewOption: true,
          reviewPoints: true,
          documentSubmissionOption: true,
          documentSubmissionPoints: true,
          materialHandoverOption: true,
          materialHandoverPoints: true,
          totalDelta: true,
          createdAt: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const employeeIds = employees.map((employee) => employee.id);
  const employeeNames = employees.map((employee) => employee.name).filter((name) => name.trim() !== "");
  const employeeNameFilters = employeeNames.flatMap((name) => [
    { lastAttemptByName: { equals: name, mode: "insensitive" as const } },
    { closedByName: { equals: name, mode: "insensitive" as const } },
  ]);

  const [employeeReportAssignments, employeeReportRequests] = await Promise.all([
    employeeIds.length > 0
      ? prisma.serviceAssignment.findMany({
          where: { employeeId: { in: employeeIds } },
          orderBy: { assignedAt: "desc" },
          select: {
            employeeId: true,
            assignedAt: true,
            status: true,
            statusReason: true,
            statusSubmittedAt: true,
            statusPointsDelta: true,
            closedAt: true,
            request: {
              select: employeeReportRequestSelect,
            },
          },
        })
      : Promise.resolve([]),
    employeeIds.length > 0
      ? prisma.serviceRequest.findMany({
          where: {
            OR: [
              { assignedToId: { in: employeeIds } },
              ...employeeNameFilters,
            ],
          },
          select: employeeReportRequestSelect,
          orderBy: [{ lastAttemptAt: "desc" }, { statusSubmittedAt: "desc" }, { createdAt: "desc" }],
          take: 500,
        })
      : Promise.resolve([]),
  ]);
  const employeeReportInputsByEmployeeId = buildEmployeeReportInputsByEmployeeId({
    employees,
    assignments: employeeReportAssignments,
    linkedRequests: employeeReportRequests,
  });

  const employeeRows = employees
    .map((employee) => {
      const completedRequests = employeeReportRequests.filter(
        (request) =>
          normalizeStatus(request.status) === "Completed" &&
          equalsIgnoreCase(request.closedByName, employee.name),
      );

      const completedByEmployee = completedRequests.length;

      return {
        id: employee.id,
        name: employee.name,
        totalPoints: employee.performancePoints,
        monthlyPoints: employee.monthlyPerformancePoints,
        completedByEmployee,
        report: buildEmployeeReportRows({
          activeRequests: employeeReportInputsByEmployeeId.get(employee.id)?.activeRequests ?? [],
          reportRequests: employeeReportInputsByEmployeeId.get(employee.id)?.reportRequests ?? [],
          pointAdjustments: employee.pointAdjustments,
        }),
        pointAdjustments: employee.pointAdjustments.map((adjustment) => ({
          ...adjustment,
          createdAt: adjustment.createdAt.toISOString(),
        })),
      };
    })
    .sort(
      (a, b) =>
        b.monthlyPoints - a.monthlyPoints ||
        b.completedByEmployee - a.completedByEmployee ||
        a.name.localeCompare(b.name),
    );
  const filteredEmployeeRows = employeeRows.filter((row) => {
    const matchesSearch = searchQuery === "" || row.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) {
      return false;
    }

    if (selectedPointFilter === "monthly-positive") return row.monthlyPoints > 0;
    if (selectedPointFilter === "monthly-zero") return row.monthlyPoints === 0;
    if (selectedPointFilter === "monthly-negative") return row.monthlyPoints < 0;
    if (selectedPointFilter === "all-time-positive") return row.totalPoints > 0;
    if (selectedPointFilter === "all-time-zero") return row.totalPoints === 0;
    if (selectedPointFilter === "all-time-negative") return row.totalPoints < 0;

    return true;
  });
  const sortedEmployeeRows = [...filteredEmployeeRows].sort((a, b) => {
    if (selectedSort === "monthly-asc") {
      return a.monthlyPoints - b.monthlyPoints || a.name.localeCompare(b.name);
    }

    if (selectedSort === "all-time-desc") {
      return b.totalPoints - a.totalPoints || a.name.localeCompare(b.name);
    }

    if (selectedSort === "all-time-asc") {
      return a.totalPoints - b.totalPoints || a.name.localeCompare(b.name);
    }

    if (selectedSort === "name-asc") {
      return a.name.localeCompare(b.name);
    }

    if (selectedSort === "name-desc") {
      return b.name.localeCompare(a.name);
    }

    return (
      b.monthlyPoints - a.monthlyPoints ||
      b.completedByEmployee - a.completedByEmployee ||
      a.name.localeCompare(b.name)
    );
  });
  const leaderboardTopThree = sortedEmployeeRows.slice(0, 3);
  const activeFilterCount = [searchQuery, selectedPointFilter, selectedSort === "monthly-desc" ? "" : selectedSort].filter(
    (value) => value !== "",
  ).length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 rounded-[2rem] border border-blue-200 bg-white p-5 shadow-[0_20px_80px_rgba(29,78,216,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-blue-500">Service analytics</p>
            <h1 className="mt-1 text-3xl font-semibold text-blue-950">Report Dashboard</h1>
            <p className="mt-2 text-sm text-blue-700">Accessible only to Admin and Manager roles.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Dashboard
            </a>
            <a
              href="/form"
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
            >
              New Call
            </a>
            <a
              href="/gallery"
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Gallery
            </a>
            <a
              href="/call-history"
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Call History
            </a>
            <form action={logout}>
              <button
                type="submit"
                className="danger-btn inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-blue-950">Report Filters</h2>
            <p className="mt-1 text-xs text-blue-600">
              Showing {sortedEmployeeRows.length} of {employeeRows.length} employees
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
              {activeFilterCount} active
            </span>
            <a
              href="/report"
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Reset
            </a>
          </div>
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Search Employee</span>
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Employee name..."
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Points</span>
            <select
              name="points"
              defaultValue={selectedPointFilter}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
            >
              {REPORT_POINT_FILTERS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">Sort</span>
            <select
              name="sort"
              defaultValue={selectedSort}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
            >
              {REPORT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 md:w-auto"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)] lg:col-span-2">
          <div>
            <h2 className="text-lg font-semibold text-blue-950">Employee Performance</h2>
            <p className="mt-1 text-xs text-blue-600">Monthly & All-Time Points</p>
          </div>
          {sortedEmployeeRows.length === 0 ? (
            <p className="mt-3 text-sm text-blue-700">No employees found.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full table-auto divide-y divide-blue-100 text-left text-xs">
                <thead className="bg-blue-50 text-blue-700">
                  <tr>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Employee</th>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Tag</th>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Monthly Points</th>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">All-Time Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {sortedEmployeeRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-2.5 py-2.5 text-blue-950">
                        <EmployeeReportPopup
                          buttonContent={row.name}
                          title={`${row.name} report`}
                        >
                          <EmployeeReportTable
                            employeeName={row.name}
                            rows={row.report.rows}
                            totalPoints={row.report.totalPoints}
                          />
                        </EmployeeReportPopup>
                      </td>
                      <td className="px-2.5 py-2.5 text-blue-900">
                        <EmployeePointsPopup
                          employeeId={row.id}
                          employeeName={row.name}
                          currentPoints={row.monthlyPoints}
                          pointAdjustments={row.pointAdjustments}
                        />
                      </td>
                      <td className="px-2.5 py-2.5 text-blue-900 font-semibold">{row.monthlyPoints}</td>
                      <td className="px-2.5 py-2.5 text-blue-600">{row.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-blue-950">Leaderboard</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-blue-700">
              Top 3
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((index) => {
              const employee = leaderboardTopThree[index];
              const rank = index + 1;

              return (
                <div
                  key={rank}
                  className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Rank {rank}</p>
                    <p className="truncate text-sm font-medium text-blue-950">{employee?.name ?? "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-blue-900">{employee ? `${employee.monthlyPoints} pts` : "-"}</p>
                    <p className="text-xs text-blue-600">{employee ? `${employee.totalPoints} all-time` : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

    </main>
  );
}

type EmployeeReportLinkedRequest = EmployeeReportRequest & {
  assignedToId: string | null;
  lastAttemptByName: string | null;
  closedByName: string | null;
};

type EmployeeReportAssignmentInput = {
  employeeId: string;
  assignedAt: Date;
  status: string | null;
  statusReason: string | null;
  statusSubmittedAt: Date | null;
  statusPointsDelta: number | null;
  closedAt: Date | null;
  request: EmployeeReportLinkedRequest;
};

type EmployeeReportInputs = {
  activeRequests: EmployeeReportRequest[];
  reportRequests: EmployeeReportRequest[];
};

function buildEmployeeReportInputsByEmployeeId({
  employees,
  assignments,
  linkedRequests,
}: {
  employees: Array<{ id: string; name: string }>;
  assignments: EmployeeReportAssignmentInput[];
  linkedRequests: EmployeeReportLinkedRequest[];
}) {
  const inputsByEmployeeId = new Map<string, EmployeeReportInputs>();
  const employeeIdsByName = new Map<string, string[]>();

  for (const employee of employees) {
    inputsByEmployeeId.set(employee.id, { activeRequests: [], reportRequests: [] });

    const nameKey = getEmployeeNameKey(employee.name);
    if (!nameKey) {
      continue;
    }

    const ids = employeeIdsByName.get(nameKey) ?? [];
    ids.push(employee.id);
    employeeIdsByName.set(nameKey, ids);
  }

  for (const assignment of assignments) {
    const input = inputsByEmployeeId.get(assignment.employeeId);

    if (!input) {
      continue;
    }

    input.activeRequests.push({
      ...assignment.request,
      assignedAt: assignment.assignedAt,
      status: assignment.status ?? assignment.request.status,
      statusReason: assignment.statusReason ?? assignment.request.statusReason,
      statusSubmittedAt: assignment.statusSubmittedAt,
      statusPointsDelta: assignment.statusPointsDelta,
      closedAt: assignment.closedAt ?? assignment.request.closedAt,
    });
  }

  for (const request of linkedRequests) {
    const matchingEmployeeIds = new Set<string>();

    if (request.assignedToId) {
      matchingEmployeeIds.add(request.assignedToId);
    }

    for (const name of [request.lastAttemptByName, request.closedByName]) {
      const nameKey = getEmployeeNameKey(name);
      const employeeIds = nameKey ? employeeIdsByName.get(nameKey) : null;

      for (const employeeId of employeeIds ?? []) {
        matchingEmployeeIds.add(employeeId);
      }
    }

    for (const employeeId of matchingEmployeeIds) {
      const input = inputsByEmployeeId.get(employeeId);

      if (input) {
        input.reportRequests.push(request);
      }
    }
  }

  return inputsByEmployeeId;
}

function getEmployeeNameKey(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getReportPointFilter(value: string): ReportPointFilter {
  return REPORT_POINT_FILTERS.some((option) => option.value === value) ? (value as ReportPointFilter) : "";
}

function getReportSort(value: string): ReportSort {
  return REPORT_SORT_OPTIONS.some((option) => option.value === value) ? (value as ReportSort) : "monthly-desc";
}

function equalsIgnoreCase(a: string | null, b: string) {
  if (!a) {
    return false;
  }

  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
