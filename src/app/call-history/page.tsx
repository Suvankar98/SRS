import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import ReportFilters from "../report/report-filters";
import { ReportCallDetailsModal } from "../report/call-details-modal";
import { CallHistoryColumnToggle } from "./row-toggle";
import { normalizeStatus, getStatusPillClass, getStatusLabel } from "../status-utils";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CanonicalStatus = "New Call" | "In Process" | "Completed" | "Cancel";

const STATUS_ORDER: CanonicalStatus[] = ["New Call", "In Process", "Completed", "Cancel"];
const CALL_HISTORY_COLUMNS = [
  { id: "docket", label: "Docket" },
  { id: "customer", label: "Customer" },
  { id: "area", label: "Area" },
  { id: "call-type", label: "Call Type" },
  { id: "amount", label: "Amount" },
  { id: "assigned-to", label: "Assigned To" },
  { id: "status", label: "Status" },
  { id: "created", label: "Created" },
];

type CallHistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CallHistoryPage({ searchParams }: CallHistoryPageProps) {
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
  const selectedServiceBillingType = getServiceBillingType(
    getSearchParamValue(resolvedSearchParams.serviceBillingType),
  );
  const selectedArea = getSearchParamValue(resolvedSearchParams.area).trim();
  const fromDate = getSearchParamValue(resolvedSearchParams.from).trim();
  const toDate = getSearchParamValue(resolvedSearchParams.to).trim();

  const [employees, callTypeOptions, areaOptions] = await Promise.all([
    prisma.user.findMany({
      where: { role: APP_ROLES.EMPLOYEE },
      select: { id: true, name: true },
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
    selectedServiceBillingType,
    selectedArea,
    fromDate,
    toDate,
    employees,
  });

  const calls = await prisma.serviceRequest.findMany({
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
      activities: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          title: true,
          details: true,
          status: true,
          statusReason: true,
          actorName: true,
          actorRole: true,
          employeeName: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const activeFilters = getActiveFilterCount({
    searchQuery,
    selectedStatus,
    selectedEmployee,
    selectedCallType,
    selectedServiceBillingType,
    selectedArea,
    fromDate,
    toDate,
  });
  const exportParams = new URLSearchParams();
  if (searchQuery !== "") exportParams.set("q", searchQuery);
  if (selectedStatus !== "") exportParams.set("status", selectedStatus);
  if (selectedEmployee !== "") exportParams.set("employeeId", selectedEmployee);
  if (selectedCallType !== "") exportParams.set("callType", selectedCallType);
  if (selectedServiceBillingType !== "") exportParams.set("serviceBillingType", selectedServiceBillingType);
  if (selectedArea !== "") exportParams.set("area", selectedArea);
  if (fromDate !== "") exportParams.set("from", fromDate);
  if (toDate !== "") exportParams.set("to", toDate);
  const exportQuery = exportParams.toString();
  const csvExportHref = `/api/report/export?format=csv${exportQuery ? `&${exportQuery}` : ""}`;
  const pdfExportHref = `/api/report/export?format=pdf${exportQuery ? `&${exportQuery}` : ""}`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 rounded-[2rem] border border-blue-200 bg-white p-5 shadow-[0_20px_80px_rgba(29,78,216,0.12)]">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-500">Service history</p>
        <h1 className="mt-1 text-3xl font-semibold text-blue-950">Call History</h1>
        <p className="mt-2 text-sm text-blue-700">Filter, inspect, and export service calls.</p>
      </header>

      <section className="mb-5 rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-blue-950">Filters</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">
              {activeFilters} active
            </span>
            <a href={csvExportHref} className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50">Download CSV</a>
            <a href={pdfExportHref} className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50">Download PDF</a>
            <a href="/call-history" className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50">Reset</a>
          </div>
        </div>

        <ReportFilters
          key={`${selectedCallType}:${selectedServiceBillingType}`}
          searchQuery={searchQuery}
          selectedStatus={selectedStatus}
          selectedEmployee={selectedEmployee}
          selectedCallType={selectedCallType}
          selectedServiceBillingType={selectedServiceBillingType}
          selectedArea={selectedArea}
          fromDate={fromDate}
          toDate={toDate}
          employees={employees}
          callTypeOptions={callTypeOptions}
          areaOptions={areaOptions}
        />
      </section>

      <section className="rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-blue-950">Call History</h2>
        {calls.length === 0 ? (
          <p className="mt-3 text-sm text-blue-700">No call history found for selected filters.</p>
        ) : (
          <CallHistoryColumnToggle columns={CALL_HISTORY_COLUMNS}>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full table-auto divide-y divide-blue-100 text-left text-xs">
                <thead className="bg-blue-50 text-blue-700">
                  <tr>
                    <th data-call-history-column="docket" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Docket</th>
                    <th data-call-history-column="customer" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Customer</th>
                    <th data-call-history-column="area" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Area</th>
                    <th data-call-history-column="call-type" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Call Type</th>
                    <th data-call-history-column="amount" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Amount</th>
                    <th data-call-history-column="assigned-to" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Assigned To</th>
                    <th data-call-history-column="status" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Status</th>
                    <th data-call-history-column="created" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {calls.map((request) => {
                    const status = normalizeStatus(request.status);

                    return (
                      <tr key={request.id}>
                        <td data-call-history-column="docket" className="px-2.5 py-2.5 font-semibold text-blue-900">{request.docketNumber}</td>
                        <td data-call-history-column="customer" className="px-2.5 py-2.5 text-blue-900">
                          <div>
                            <ReportCallDetailsModal request={request} />
                            <p className="text-[11px] text-blue-600">{request.company}</p>
                          </div>
                        </td>
                        <td data-call-history-column="area" className="px-2.5 py-2.5 text-blue-900">{request.area}</td>
                        <td data-call-history-column="call-type" className="px-2.5 py-2.5 text-blue-900">
                          <div>
                            <p className="font-medium">{request.callType}</p>
                            {request.serviceBillingType ? (
                              <p className="text-[11px] font-semibold text-blue-600">{request.serviceBillingType.toUpperCase()}</p>
                            ) : null}
                          </div>
                        </td>
                        <td data-call-history-column="amount" className="px-2.5 py-2.5 font-medium text-blue-900">
                          {request.serviceBillingType === "chargeable" ? formatINR(request.chargeableAmount || 0) : formatINR(0)}
                        </td>
                        <td data-call-history-column="assigned-to" className="px-2.5 py-2.5 text-blue-900">{request.assignedTo?.name ?? "Unassigned"}</td>
                        <td data-call-history-column="status" className="px-2.5 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusPillClass(
                              status,
                            )}`}
                          >
                            {getStatusLabel(status)}
                          </span>
                        </td>
                        <td data-call-history-column="created" className="px-2.5 py-2.5 text-blue-900">{formatDateTime(request.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CallHistoryColumnToggle>
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
  selectedServiceBillingType,
  selectedArea,
  fromDate,
  toDate,
  employees,
}: {
  searchQuery: string;
  selectedStatus: CanonicalStatus | "";
  selectedEmployee: string;
  selectedCallType: string;
  selectedServiceBillingType: string;
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

  if (selectedServiceBillingType !== "") {
    andClauses.push({ serviceBillingType: selectedServiceBillingType });
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

function getServiceBillingType(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "warranty" || normalized === "amc" || normalized === "chargeable") {
    return normalized;
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
  selectedServiceBillingType,
  selectedArea,
  fromDate,
  toDate,
}: {
  searchQuery: string;
  selectedStatus: CanonicalStatus | "";
  selectedEmployee: string;
  selectedCallType: string;
  selectedServiceBillingType: string;
  selectedArea: string;
  fromDate: string;
  toDate: string;
}) {
  return [
    searchQuery,
    selectedStatus,
    selectedEmployee,
    selectedCallType,
    selectedServiceBillingType,
    selectedArea,
    fromDate,
    toDate,
  ].filter((value) => value !== "").length;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}
