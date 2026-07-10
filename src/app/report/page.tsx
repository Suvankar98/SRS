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
  type EmployeeReportRow,
} from "@/lib/employee-report";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
  const fromDate = getDateInputValue(getSearchParamValue(resolvedSearchParams.from));
  const toDate = getDateInputValue(getSearchParamValue(resolvedSearchParams.to));
  const dateRange = getDateRange(fromDate, toDate);
  const hasDateRange = Boolean(dateRange.startAt || dateRange.endAt);
  const last7DaysRange = getRollingDateRange(7);
  const last30DaysRange = getRollingDateRange(30);
  const last90DaysRange = getRollingDateRange(90);

  const employees = await prisma.user.findMany({
    where: { role: APP_ROLES.EMPLOYEE },
    select: {
      id: true,
      name: true,
      performancePoints: true,
      monthlyPerformancePoints: true,
      pointAdjustments: {
        orderBy: { createdAt: "desc" },
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

      const report = buildEmployeeReportRows({
        activeRequests: employeeReportInputsByEmployeeId.get(employee.id)?.activeRequests ?? [],
        reportRequests: employeeReportInputsByEmployeeId.get(employee.id)?.reportRequests ?? [],
        pointAdjustments: employee.pointAdjustments,
        limit: null,
      });
      const periodPoints = hasDateRange ? calculateReportPointsForDateRange(report.rows, dateRange) : employee.monthlyPerformancePoints;
      const popupRows = hasDateRange ? filterReportRowsForDateRange(report.rows, dateRange) : report.rows;
      const popupTotalPoints = calculateReportPoints(popupRows);

      return {
        id: employee.id,
        name: employee.name,
        totalPoints: employee.performancePoints,
        monthlyPoints: employee.monthlyPerformancePoints,
        last7DaysPoints: calculateReportPointsForDateRange(report.rows, last7DaysRange),
        last30DaysPoints: calculateReportPointsForDateRange(report.rows, last30DaysRange),
        last90DaysPoints: calculateReportPointsForDateRange(report.rows, last90DaysRange),
        periodPoints,
        completedByEmployee,
        report,
        popupRows,
        popupTotalPoints,
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
  const sortedEmployeeRows = [...employeeRows].sort((a, b) => {
    return (
      b.periodPoints - a.periodPoints ||
      b.completedByEmployee - a.completedByEmployee ||
      a.name.localeCompare(b.name)
    );
  });
  const leaderboardTopThree = sortedEmployeeRows.slice(0, 3);
  const leaderboardOtherEmployees = sortedEmployeeRows.slice(3);
  const activeFilterCount = [fromDate, toDate].filter((value) => value !== "").length;
  const leaderboardSubtitle = hasDateRange ? "Selected date range" : "Current monthly points";

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

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)] lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-blue-950">Employee Performance</h2>
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

          <form className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">From Date</span>
              <input
                type="date"
                name="from"
                defaultValue={fromDate}
                className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.1em] text-blue-700">To Date</span>
              <input
                type="date"
                name="to"
                defaultValue={toDate}
                className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
              >
                Apply Filters
              </button>
            </div>
          </form>

          {sortedEmployeeRows.length === 0 ? (
            <p className="mt-3 text-sm text-blue-700">No employees found.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full table-auto divide-y divide-blue-100 text-left text-xs">
                <thead className="bg-blue-50 text-blue-700">
                  <tr>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Employee</th>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Tag</th>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Last 7 Days</th>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Last 30 Days</th>
                    <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Last 90 Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {sortedEmployeeRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-2.5 py-2.5 font-semibold text-blue-950">{row.name}</td>
                      <td className="px-2.5 py-2.5 text-blue-900">
                        <EmployeePointsPopup
                          employeeId={row.id}
                          employeeName={row.name}
                          currentPoints={row.monthlyPoints}
                          pointAdjustments={row.pointAdjustments}
                        />
                      </td>
                      <td className="px-2.5 py-2.5 font-semibold text-blue-900">{row.last7DaysPoints}</td>
                      <td className="px-2.5 py-2.5 font-semibold text-blue-900">{row.last30DaysPoints}</td>
                      <td className="px-2.5 py-2.5 font-semibold text-blue-900">{row.last90DaysPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-blue-950">Leaderboard</h2>
              <p className="mt-1 text-xs text-blue-600">{leaderboardSubtitle}</p>
            </div>
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
                    {employee ? (
                      <EmployeeReportPopup
                        buttonContent={employee.name}
                        title={`${employee.name} report`}
                        buttonClassName="block max-w-full truncate rounded-md text-left text-sm font-medium text-blue-950 underline-offset-4 transition hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200"
                      >
                        <EmployeeReportTable
                          employeeName={employee.name}
                          rows={employee.popupRows}
                          totalPoints={employee.popupTotalPoints}
                        />
                      </EmployeeReportPopup>
                    ) : (
                      <p className="truncate text-sm font-medium text-blue-950">-</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-blue-900">{employee ? `${employee.periodPoints} pts` : "-"}</p>
                    <p className="text-xs text-blue-600">{employee ? `${employee.totalPoints} all-time` : ""}</p>
                  </div>
                </div>
              );
            })}
            {leaderboardOtherEmployees.length > 0 ? (
              <>
                <div className="py-1">
                  <div className="border-t border-blue-200" />
                </div>
                {leaderboardOtherEmployees.map((employee, index) => {
                  const rank = index + 4;

                  return (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between rounded-xl border border-blue-100 bg-white px-3 py-2 transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-500">Rank {rank}</p>
                        <EmployeeReportPopup
                          buttonContent={employee.name}
                          title={`${employee.name} report`}
                          buttonClassName="block max-w-full truncate rounded-md text-left text-sm font-medium text-blue-950 underline-offset-4 transition hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-200"
                        >
                          <EmployeeReportTable
                            employeeName={employee.name}
                            rows={employee.popupRows}
                            totalPoints={employee.popupTotalPoints}
                          />
                        </EmployeeReportPopup>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-blue-900">{employee.periodPoints} pts</p>
                        <p className="text-xs text-blue-600">{employee.totalPoints} all-time</p>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : null}
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

function getDateInputValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function getDateRange(fromDate: string, toDate: string) {
  return {
    startAt: fromDate ? new Date(`${fromDate}T00:00:00.000+05:30`) : null,
    endAt: toDate ? new Date(`${toDate}T23:59:59.999+05:30`) : null,
  };
}

function getRollingDateRange(days: number) {
  const todayInput = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todayStart = new Date(`${todayInput}T00:00:00.000+05:30`);
  const endAt = new Date(`${todayInput}T23:59:59.999+05:30`);
  const startAt = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  return { startAt, endAt };
}

function filterReportRowsForDateRange(rows: EmployeeReportRow[], dateRange: { startAt: Date | null; endAt: Date | null }) {
  return rows.filter((row) => {
    const rowTime = row.date.getTime();

    if (dateRange.startAt && rowTime < dateRange.startAt.getTime()) {
      return false;
    }

    if (dateRange.endAt && rowTime > dateRange.endAt.getTime()) {
      return false;
    }

    return true;
  });
}

function calculateReportPointsForDateRange(
  rows: EmployeeReportRow[],
  dateRange: { startAt: Date | null; endAt: Date | null },
) {
  return calculateReportPoints(filterReportRowsForDateRange(rows, dateRange));
}

function calculateReportPoints(rows: EmployeeReportRow[]) {
  return rows.reduce((total, row) => {
    return total + getReportRowPoints(row);
  }, 0);
}

function getReportRowPoints(row: EmployeeReportRow) {
  return (
    (row.workSubmission.points ?? 0) +
    (row.attendanceIn.points ?? 0) +
    (row.attendanceOut.points ?? 0) +
    (row.review.points ?? 0) +
    (row.documentSubmission.points ?? 0) +
    (row.materialHandover.points ?? 0)
  );
}

function equalsIgnoreCase(a: string | null, b: string) {
  if (!a) {
    return false;
  }

  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
