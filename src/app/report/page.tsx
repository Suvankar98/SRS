import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { logout } from "../actions";
import ReportFilters from "./report-filters";
import { normalizeStatus, getStatusPillClass, getStatusLabel } from "../status-utils";
import { EmployeePointsPopup } from "./employee-points-popup";
import { ReportCallDetailsModal } from "./call-details-modal";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CanonicalStatus = "New Call" | "In Process" | "Completed" | "Cancel";

const STATUS_ORDER: CanonicalStatus[] = ["New Call", "In Process", "Completed", "Cancel"];

type ReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
  const selectedStatus = getCanonicalStatus(getSearchParamValue(resolvedSearchParams.status));
  const selectedEmployee = getSearchParamValue(resolvedSearchParams.employeeId).trim();
  const selectedCallType = getSearchParamValue(resolvedSearchParams.callType).trim();
  const selectedArea = getSearchParamValue(resolvedSearchParams.area).trim();
  const fromDate = getSearchParamValue(resolvedSearchParams.from).trim();
  const toDate = getSearchParamValue(resolvedSearchParams.to).trim();

  const [employees, callTypeOptions, areaOptions] = await Promise.all([
    prisma.user.findMany({
      where: { role: APP_ROLES.EMPLOYEE },
      select: { id: true, name: true, performancePoints: true, monthlyPerformancePoints: true },
      orderBy: { name: "asc" },
    }),
    prisma.serviceRequest.findMany({
      distinct: ["callType"],
      select: { callType: true },
      orderBy: { callType: "asc" },
    }),
    prisma.serviceRequest.findMany({
      distinct: ["area"],
      select: { area: true },
      orderBy: { area: "asc" },
    }),
  ]);

  const where: Prisma.ServiceRequestWhereInput = buildReportWhere({
    searchQuery,
    selectedStatus,
    selectedEmployee,
    selectedCallType,
    selectedArea,
    fromDate,
    toDate,
    employees,
  });

  const requests = await prisma.serviceRequest.findMany({
    where,
    select: {
      id: true,
      docketNumber: true,
      name: true,
      company: true,
      phoneNumber1: true,
      phoneNumber2: true,
      fullAddress: true,
      complaintDetails: true,
      product: true,
      status: true,
      statusReason: true,
      statusPointsDelta: true,
      assignedToId: true,
      createdAt: true,
      assignedAt: true,
      statusSubmittedAt: true,
      closedAt: true,
      closedByName: true,
      callType: true,
      area: true,
      serviceBillingType: true,
      chargeableAmount: true,
      customerReview: true,
      assignedTo: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusCounts: Record<CanonicalStatus, number> = {
    "New Call": 0,
    "In Process": 0,
    Completed: 0,
    Cancel: 0,
  };

  for (const request of requests) {
    const status = normalizeStatus(request.status);
    statusCounts[status] += 1;
  }

  const totalCalls = requests.length;
  const completedCalls = statusCounts.Completed;
  const cancelCalls = statusCounts.Cancel;
  const activeCalls = statusCounts["New Call"] + statusCounts["In Process"];
  const unassignedCalls = requests.filter((request) => request.assignedToId === null).length;
  const todayCalls = requests.filter((request) => isTodayInIndia(request.createdAt)).length;
  const activeFilters = getActiveFilterCount({
    searchQuery,
    selectedStatus,
    selectedEmployee,
    selectedCallType,
    selectedArea,
    fromDate,
    toDate,
  });
  const exportParams = new URLSearchParams();
  if (searchQuery !== "") exportParams.set("q", searchQuery);
  if (selectedStatus !== "") exportParams.set("status", selectedStatus);
  if (selectedEmployee !== "") exportParams.set("employeeId", selectedEmployee);
  if (selectedCallType !== "") exportParams.set("callType", selectedCallType);
  if (selectedArea !== "") exportParams.set("area", selectedArea);
  if (fromDate !== "") exportParams.set("from", fromDate);
  if (toDate !== "") exportParams.set("to", toDate);
  const exportQuery = exportParams.toString();
  const csvExportHref = `/api/report/export?format=csv${exportQuery ? `&${exportQuery}` : ""}`;
  const pdfExportHref = `/api/report/export?format=pdf${exportQuery ? `&${exportQuery}` : ""}`;

  const employeeRows = employees
    .map((employee) => {
      const completedRequests = requests.filter(
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
      };
    })
    .sort(
      (a, b) =>
        b.monthlyPoints - a.monthlyPoints ||
        b.completedByEmployee - a.completedByEmployee ||
        a.name.localeCompare(b.name),
    );
  const leaderboardTopThree = employeeRows.slice(0, 3);

  const recentCalls = requests;

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
          <div>
            <h2 className="text-lg font-semibold text-blue-950">Employee Performance</h2>
            <p className="mt-1 text-xs text-blue-600">Monthly & All-Time Points</p>
          </div>
          {employeeRows.length === 0 ? (
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
                  {employeeRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-2.5 py-2.5 text-blue-950">{row.name}</td>
                      <td className="px-2.5 py-2.5 text-blue-900">
                        <EmployeePointsPopup
                          employeeId={row.id}
                          employeeName={row.name}
                          currentPoints={row.monthlyPoints}
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

      <section className="mt-5 mb-5 rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-blue-950">Filters</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
              {activeFilters} active
            </span>
            <a
              href={csvExportHref}
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Download CSV
            </a>
            <a
              href={pdfExportHref}
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Download PDF
            </a>
            <a
              href="/report"
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Reset
            </a>
          </div>
        </div>

        {/* client-side filter component so we can show billing options when Call Type=Service */}
        <ReportFilters
          searchQuery={searchQuery}
          selectedStatus={selectedStatus}
          selectedEmployee={selectedEmployee}
          selectedCallType={selectedCallType}
          selectedArea={selectedArea}
          fromDate={fromDate}
          toDate={toDate}
          employees={employees}
          callTypeOptions={callTypeOptions}
          areaOptions={areaOptions}
        />
      </section>

      <section className="mt-5 rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-blue-950">Call History</h2>
        {recentCalls.length === 0 ? (
          <p className="mt-3 text-sm text-blue-700">No call history found for selected filters.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full table-auto divide-y divide-blue-100 text-left text-xs">
              <thead className="bg-blue-50 text-blue-700">
                <tr>
                  <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Docket</th>
                  <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Customer</th>
                  <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Area</th>
                  <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Call Type</th>
                  <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Amount</th>
                  <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Assigned To</th>
                  <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Status</th>
                  <th className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 bg-white">
                {recentCalls.map((request) => {
                  const status = normalizeStatus(request.status);
                  
                  const getBillingLabel = () => {
                    if (!request.serviceBillingType) return "₹0";
                    const billingMap: Record<string, string> = {
                      warranty: "WARRANTY",
                      amc: "AMC",
                      chargeable: "CHARGEABLE",
                    };
                    const label = billingMap[request.serviceBillingType] || request.serviceBillingType;
                    if (request.serviceBillingType === "chargeable" && request.chargeableAmount) {
                      return `₹${request.chargeableAmount}`;
                    }
                    return "₹0";
                  };

                  const getCallTypeDisplay = () => {
                    if (!request.serviceBillingType) return request.callType;
                    const billingMap: Record<string, string> = {
                      warranty: "WARRANTY",
                      amc: "AMC",
                      chargeable: "CHARGEABLE",
                    };
                    const billingLabel = billingMap[request.serviceBillingType] || request.serviceBillingType;
                    return `${request.callType} ${billingLabel}`;
                  };

                  return (
                    <tr key={request.id}>
                      <td className="px-2.5 py-2.5 font-semibold text-blue-900">{request.docketNumber}</td>
                      <td className="px-2.5 py-2.5 text-blue-900">
                        <div>
                          <ReportCallDetailsModal request={request} />
                          <p className="text-[11px] text-blue-600">{request.company}</p>
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 text-blue-900">{request.area}</td>
                      <td className="px-2.5 py-2.5 text-blue-900">
                        <div>
                          <p className="font-medium">{request.callType}</p>
                          {request.serviceBillingType && (
                            <p className="text-[11px] text-blue-600 font-semibold">
                              {request.serviceBillingType.toUpperCase()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-2.5 py-2.5 text-blue-900 font-medium">
                        {request.serviceBillingType === "chargeable" ? `₹${request.chargeableAmount || 0}` : "₹0"}
                      </td>
                      <td className="px-2.5 py-2.5 text-blue-900">{request.assignedTo?.name ?? "Unassigned"}</td>
                      <td className="px-2.5 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusPillClass(
                            status,
                          )}`}
                        >
                          {getStatusLabel(status)}
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5 text-blue-900">{formatDateTime(request.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function buildReportWhere({
  searchQuery,
  selectedStatus,
  selectedEmployee,
  selectedCallType,
  selectedArea,
  fromDate,
  toDate,
  employees,
}: {
  searchQuery: string;
  selectedStatus: CanonicalStatus | "";
  selectedEmployee: string;
  selectedCallType: string;
  selectedArea: string;
  fromDate: string;
  toDate: string;
  employees: Array<{ id: string; name: string }>;
}): Prisma.ServiceRequestWhereInput {
  const andClauses: Prisma.ServiceRequestWhereInput[] = [];

  if (searchQuery !== "") {
    andClauses.push({
      OR: [
        { docketNumber: { contains: searchQuery, mode: "insensitive" } },
        { name: { contains: searchQuery, mode: "insensitive" } },
        { company: { contains: searchQuery, mode: "insensitive" } },
        { area: { contains: searchQuery, mode: "insensitive" } },
        { callType: { contains: searchQuery, mode: "insensitive" } },
      ],
    });
  }

  if (selectedStatus !== "") {
    andClauses.push(getStatusWhereClause(selectedStatus));
  }

  if (selectedEmployee === "unassigned") {
    andClauses.push({ assignedToId: null });
  } else if (selectedEmployee !== "" && employees.some((employee) => employee.id === selectedEmployee)) {
    andClauses.push({ assignedToId: selectedEmployee });
  }

  if (selectedCallType !== "") {
    andClauses.push({ callType: selectedCallType });
  }

  if (selectedArea !== "") {
    andClauses.push({ area: selectedArea });
  }

  const createdAtFilter = getCreatedAtFilter(fromDate, toDate);
  if (createdAtFilter) {
    andClauses.push({ createdAt: createdAtFilter });
  }

  if (andClauses.length === 0) {
    return {};
  }

  return { AND: andClauses };
}

function getStatusWhereClause(status: CanonicalStatus): Prisma.ServiceRequestWhereInput {
  if (status === "New Call") {
    return {
      OR: [{ status: null }, { status: "New Call" }, { status: "Pending" }, { status: "New" }],
    };
  }

  if (status === "In Process") {
    return {
      OR: [
        { status: "In Process" },
        { status: "in process" },
        { status: "Visit & Reschedule" },
        { status: "Visit and Reschedule" },
        { status: "Reschedule" },
      ],
    };
  }

  if (status === "Completed") {
    return {
      OR: [{ status: "Completed" }, { status: "Close" }, { status: "Closed" }],
    };
  }

  return {
    OR: [{ status: "Cancel" }, { status: "Cancelled" }, { status: "Canceled" }],
  };
}

function getCreatedAtFilter(fromDate: string, toDate: string): Prisma.DateTimeFilter | undefined {
  const from = parseDateInput(fromDate, false);
  const to = parseDateInput(toDate, true);

  if (!from && !to) {
    return undefined;
  }

  return {
    gte: from || undefined,
    lte: to || undefined,
  };
}

function parseDateInput(value: string, endOfDay: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

function getCanonicalStatus(value: string): CanonicalStatus | "" {
  if (STATUS_ORDER.includes(value as CanonicalStatus)) {
    return value as CanonicalStatus;
  }

  return "";
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getActiveFilterCount({
  searchQuery,
  selectedStatus,
  selectedEmployee,
  selectedCallType,
  selectedArea,
  fromDate,
  toDate,
}: {
  searchQuery: string;
  selectedStatus: CanonicalStatus | "";
  selectedEmployee: string;
  selectedCallType: string;
  selectedArea: string;
  fromDate: string;
  toDate: string;
}) {
  return [searchQuery, selectedStatus, selectedEmployee, selectedCallType, selectedArea, fromDate, toDate].filter(
    (value) => value !== "",
  ).length;
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <article className="rounded-xl border border-blue-200 bg-white px-3 py-2.5 sm:p-4">
      <div className="flex items-end justify-between sm:block">
        <p className="text-[10px] uppercase tracking-[0.12em] text-blue-500 sm:text-xs sm:tracking-[0.2em]">{title}</p>
        <p className="text-2xl leading-none font-semibold text-blue-950 sm:mt-1 sm:text-2xl">{value}</p>
      </div>
      <p className="mt-1 hidden text-xs text-blue-600 sm:block">{subtitle}</p>
    </article>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function isTodayInIndia(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const today = formatter.format(new Date());
  const target = formatter.format(value);
  return today === target;
}

function equalsIgnoreCase(a: string | null, b: string) {
  if (!a) {
    return false;
  }

  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
