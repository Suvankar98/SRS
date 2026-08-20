import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import ReportFilters from "../report/report-filters";
import { DashboardMediaPopup } from "../dashboard/dashboard-media-popup";
import { ReportCallDetailsModal } from "../report/call-details-modal";
import { CallHistoryExportLinks } from "./export-links";
import { CallHistoryColumnToggle } from "./row-toggle";
import { normalizeStatus, getStatusPillClass, getStatusLabel } from "../status-utils";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { formatDocketNumber } from "@/lib/docket";
import { getDashboardMediaItemsByRequestIds } from "@/lib/gallery";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CanonicalStatus = "New Call" | "In Process" | "Completed" | "Cancel" | "Deleted";

const STATUS_ORDER: CanonicalStatus[] = ["New Call", "In Process", "Completed", "Cancel", "Deleted"];
const CALL_HISTORY_COLUMNS = [
  { id: "docket", label: "Docket" },
  { id: "customer", label: "Company" },
  { id: "area", label: "Area" },
  { id: "call-type", label: "Call Type" },
  { id: "amount", label: "Amount" },
  { id: "assigned-to", label: "Assigned To" },
  { id: "completed-by", label: "Completed By" },
  { id: "assigned-date", label: "Assigned Date" },
  { id: "status", label: "Status" },
  { id: "deleted-by", label: "Deleted By" },
  { id: "created", label: "Created" },
];

const CALL_HISTORY_REQUEST_SELECT = {
  id: true,
  docketNumber: true,
  name: true,
  company: true,
  contactPerson2: true,
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
  deletedAt: true,
  deletedByName: true,
  deletedByRole: true,
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
  assignments: {
    orderBy: { assignedAt: "asc" },
    select: {
      assignedAt: true,
      status: true,
      closedAt: true,
      statusSubmittedAt: true,
      employee: {
        select: {
          id: true,
          name: true,
        },
      },
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
} satisfies Prisma.ServiceRequestSelect;
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
  const fromDate = getSearchParamValue(resolvedSearchParams.from).trim();
  const toDate = getSearchParamValue(resolvedSearchParams.to).trim();
  const assignedFromDate = getSearchParamValue(resolvedSearchParams.assignedFrom).trim();
  const assignedToDate = getSearchParamValue(resolvedSearchParams.assignedTo).trim();

  const [employees, callTypeOptions] = await Promise.all([
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
  ]);

  const where: Prisma.ServiceRequestWhereInput = buildReportWhere({
    searchQuery,
    selectedStatus,
    selectedEmployee,
    selectedCallType,
    selectedServiceBillingType,
    fromDate,
    toDate,
    assignedFromDate,
    assignedToDate,
    employees,
  });

  const calls = await prisma.serviceRequest.findMany({
    where,
    select: CALL_HISTORY_REQUEST_SELECT,
    orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
  });
  const visibleCompanyNames = getUniqueCompanyNames(calls);
  const relatedCompanyCalls =
    visibleCompanyNames.length > 0
      ? await prisma.serviceRequest.findMany({
          where: {
            OR: visibleCompanyNames.map((company) => ({
              company: { equals: company, mode: "insensitive" },
            })),
          },
          select: CALL_HISTORY_REQUEST_SELECT,
          orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
        })
      : [];
  const mediaByRequestId = await getDashboardMediaItemsByRequestIds(calls.map((request) => request.id));
  const companyRequestsByKey = groupRequestsByCompany(relatedCompanyCalls);

  const activeFilters = getActiveFilterCount({
    searchQuery,
    selectedStatus,
    selectedEmployee,
    selectedCallType,
    selectedServiceBillingType,
    fromDate,
    toDate,
    assignedFromDate,
    assignedToDate,
  });
  const baseParams = new URLSearchParams();
  if (searchQuery !== "") baseParams.set("q", searchQuery);
  if (selectedStatus !== "") baseParams.set("status", selectedStatus);
  if (selectedEmployee !== "") baseParams.set("employeeId", selectedEmployee);
  if (selectedCallType !== "") baseParams.set("callType", selectedCallType);
  if (selectedServiceBillingType !== "") baseParams.set("serviceBillingType", selectedServiceBillingType);
  if (fromDate !== "") baseParams.set("from", fromDate);
  if (toDate !== "") baseParams.set("to", toDate);
  if (assignedFromDate !== "") baseParams.set("assignedFrom", assignedFromDate);
  if (assignedToDate !== "") baseParams.set("assignedTo", assignedToDate);
  const baseQuery = baseParams.toString();
  const firstServiceDate = getEarliestCreatedAt(calls);
  const reportFromDate = fromDate || (firstServiceDate ? getDateInputValue(firstServiceDate) : "");
  const reportToDate = toDate || getDateInputValue(new Date());
  const exportParams = new URLSearchParams(baseQuery);
  if (reportFromDate !== "") exportParams.set("from", reportFromDate);
  if (reportToDate !== "") exportParams.set("to", reportToDate);
  const exportQuery = exportParams.toString();
  const isChargeableServiceFilter = selectedCallType === "Service" && selectedServiceBillingType === "chargeable";
  const chargeableTotal = isChargeableServiceFilter
    ? calls.reduce((total, request) => total + (request.chargeableAmount ?? 0), 0)
    : 0;
  const serviceCountLabel = calls.length === 1 ? "1 service" : `${calls.length} services`;
  const reportRangeLabel = reportFromDate
    ? `From ${formatDateInputLabel(reportFromDate)} to ${formatDateInputLabel(reportToDate)}`
    : `Till ${formatDateInputLabel(reportToDate)}`;

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
            <CallHistoryExportLinks baseQuery={exportQuery} columns={CALL_HISTORY_COLUMNS} />
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
          fromDate={fromDate}
          toDate={toDate}
          assignedFromDate={assignedFromDate}
          assignedToDate={assignedToDate}
          employees={employees}
          callTypeOptions={callTypeOptions}
        />
      </section>

      {isChargeableServiceFilter ? (
        <section className="mb-5 rounded-[1.6rem] border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Chargeable Service Total</p>
              <p className="mt-1 text-sm text-emerald-800">{calls.length} chargeable service calls in current filter.</p>
            </div>
            <p className="text-2xl font-semibold text-emerald-950">{formatINR(chargeableTotal)}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.6rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
        <h2 className="text-lg font-semibold text-blue-950">Call History</h2>
        {calls.length === 0 ? (
          <p className="mt-3 text-sm text-blue-700">No call history found for selected filters.</p>
        ) : (
          <CallHistoryColumnToggle
            columns={CALL_HISTORY_COLUMNS}
            centerContent={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                  {serviceCountLabel}
                </span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                  {reportRangeLabel}
                </span>
              </div>
            }
          >
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full table-auto divide-y divide-blue-100 text-left text-xs">
                <thead className="bg-blue-50 text-blue-700">
                  <tr>
                    <th data-call-history-column="docket" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Docket</th>
                    <th data-call-history-column="customer" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Company</th>
                    <th data-call-history-column="area" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Area</th>
                    <th data-call-history-column="call-type" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Call Type</th>
                    <th data-call-history-column="amount" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Amount</th>
                    <th data-call-history-column="assigned-to" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Assigned To</th>
                    <th data-call-history-column="completed-by" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Completed By</th>
                    <th data-call-history-column="assigned-date" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Assigned Date</th>
                    <th data-call-history-column="status" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Status</th>
                    <th data-call-history-column="deleted-by" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Deleted By</th>
                    <th data-call-history-column="created" className="px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100 bg-white">
                  {calls.map((request) => {
                    const status = normalizeStatus(request.status);
                    const isDeleted = Boolean(request.deletedAt);
                    const isCompleted = !isDeleted && status === "Completed";
                    const assignedEmployeeChips = getCallHistoryEmployeeChips(request);
                    const completedEmployeeChips = getCallHistoryCompletedByChips(request);
                    const assignedAt = getCallHistoryAssignedAt(request);
                    const mediaItems = isCompleted ? mediaByRequestId.get(request.id) ?? [] : [];

                    return (
                      <tr key={request.id}>
                        <td data-call-history-column="docket" className="px-2.5 py-2.5">
                          <div className="flex items-center gap-1.5 font-semibold text-blue-900">
                            <span>{formatDocketNumber(request.docketNumber)}</span>
                            <CallHistoryPrintPdfLink requestId={request.id} docketNumber={formatDocketNumber(request.docketNumber)} />
                          </div>
                        </td>
                        <td data-call-history-column="customer" className="px-2.5 py-2.5 text-blue-900">
                          <div>
                            <ReportCallDetailsModal
                              request={{
                                ...request,
                                relatedRequests: companyRequestsByKey.get(getCompanyKey(request.company)) ?? [request],
                              }}
                              triggerContent={request.company}
                            />
                            <p className="text-[11px] text-blue-600">{request.name}</p>
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
                        <td data-call-history-column="assigned-to" className="px-2.5 py-2.5 text-blue-900">
                          {assignedEmployeeChips.length > 0 ? (
                            <EmployeeFilterChips chips={assignedEmployeeChips} baseQuery={baseQuery} />
                          ) : (
                            "Unassigned"
                          )}
                        </td>
                        <td data-call-history-column="completed-by" className="px-2.5 py-2.5 text-blue-900">
                          {completedEmployeeChips.length > 0 ? (
                            <EmployeeFilterChips chips={completedEmployeeChips} baseQuery={baseQuery} />
                          ) : (
                            <span className="text-blue-400">-</span>
                          )}
                        </td>
                        <td data-call-history-column="assigned-date" className="px-2.5 py-2.5 text-blue-900">
                          {assignedAt ? formatDateTime(assignedAt) : <span className="text-blue-400">-</span>}
                        </td>
                        <td data-call-history-column="status" className="px-2.5 py-2.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                isDeleted ? "bg-rose-100 text-rose-800 ring-rose-300" : getStatusPillClass(status)
                              }`}
                            >
                              {isDeleted ? "Deleted" : getStatusLabel(status)}
                            </span>
                            {mediaItems.length > 0 ? (
                              <DashboardMediaPopup docketNumber={formatDocketNumber(request.docketNumber)} mediaItems={mediaItems} variant="icon" />
                            ) : null}
                          </div>
                        </td>
                        <td data-call-history-column="deleted-by" className="px-2.5 py-2.5 text-blue-900">
                          {isDeleted ? (
                            <div>
                              <p className="font-semibold text-rose-700">{request.deletedByName || "Unknown"}</p>
                              {request.deletedAt ? <p className="text-[11px] text-rose-500">{formatDateTime(request.deletedAt)}</p> : null}
                            </div>
                          ) : (
                            <span className="text-blue-400">-</span>
                          )}
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

function CallHistoryPrintPdfLink({ requestId, docketNumber }: { requestId: string; docketNumber: string }) {
  return (
    <a
      href={`/api/service-request/${encodeURIComponent(requestId)}/pdf?disposition=inline`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:border-blue-400 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
      aria-label={`Open printable service report PDF for ${docketNumber}`}
      title="Open printable PDF"
    >
      <PrintIcon />
      <span className="sr-only">Print {docketNumber}</span>
    </a>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M5.5 7V3.8H14.5V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 14.2H4.2A1.7 1.7 0 0 1 2.5 12.5V9A2 2 0 0 1 4.5 7H15.5A2 2 0 0 1 17.5 9V12.5A1.7 1.7 0 0 1 15.8 14.2H14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.5 11.5H13.5V16.5H6.5V11.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.5 9.8H14.55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function getUniqueCompanyNames(requests: Array<{ company: string }>) {
  const seenCompanyKeys = new Set<string>();
  const companyNames: string[] = [];

  for (const request of requests) {
    const companyName = request.company.trim();
    const companyKey = getCompanyKey(companyName);

    if (!companyName || seenCompanyKeys.has(companyKey)) {
      continue;
    }

    seenCompanyKeys.add(companyKey);
    companyNames.push(companyName);
  }

  return companyNames;
}
function groupRequestsByCompany<T extends { company: string; createdAt: Date; assignedAt: Date | null }>(requests: T[]) {
  const groups = new Map<string, T[]>();

  for (const request of requests) {
    const companyKey = getCompanyKey(request.company);
    const existingGroup = groups.get(companyKey) ?? [];
    existingGroup.push(request);
    groups.set(companyKey, existingGroup);
  }

  for (const [companyKey, group] of groups.entries()) {
    groups.set(companyKey, [...group].sort((a, b) => getRequestSortTime(b) - getRequestSortTime(a)));
  }

  return groups;
}

function getCompanyKey(company: string) {
  return company.trim().replace(/\s+/g, " ").toLowerCase();
}

function getRequestSortTime(request: { createdAt: Date; assignedAt: Date | null }) {
  return (request.assignedAt ?? request.createdAt).getTime();
}
function buildReportWhere({
  searchQuery,
  selectedStatus,
  selectedEmployee,
  selectedCallType,
  selectedServiceBillingType,
  fromDate,
  toDate,
  assignedFromDate,
  assignedToDate,
  employees,
}: {
  searchQuery: string;
  selectedStatus: CanonicalStatus | "";
  selectedEmployee: string;
  selectedCallType: string;
  selectedServiceBillingType: string;
  fromDate: string;
  toDate: string;
  assignedFromDate: string;
  assignedToDate: string;
  employees: Array<{ id: string; name: string }>;
}): Prisma.ServiceRequestWhereInput {
  const andClauses: Prisma.ServiceRequestWhereInput[] = [];

  if (searchQuery !== "") {
    andClauses.push({
      OR: [
        { docketNumber: { contains: searchQuery, mode: "insensitive" } },
        { name: { contains: searchQuery, mode: "insensitive" } },
        { company: { contains: searchQuery, mode: "insensitive" } },
        { contactPerson2: { contains: searchQuery, mode: "insensitive" } },
        { phoneNumber1: { contains: searchQuery, mode: "insensitive" } },
        { phoneNumber2: { contains: searchQuery, mode: "insensitive" } },
        { fullAddress: { contains: searchQuery, mode: "insensitive" } },
        { area: { contains: searchQuery, mode: "insensitive" } },
        { product: { contains: searchQuery, mode: "insensitive" } },
        { callType: { contains: searchQuery, mode: "insensitive" } },
        { serviceBillingType: { contains: searchQuery, mode: "insensitive" } },
        { closedByName: { contains: searchQuery, mode: "insensitive" } },
        { deletedByName: { contains: searchQuery, mode: "insensitive" } },
        { assignments: { some: { employee: { name: { contains: searchQuery, mode: "insensitive" } } } } },
        { activities: { some: { employeeName: { contains: searchQuery, mode: "insensitive" } } } },
      ],
    });
  }

  if (selectedStatus !== "") {
    andClauses.push(getStatusWhereClause(selectedStatus));
  }

  if (selectedEmployee === "unassigned") {
    andClauses.push({
      assignedToId: null,
      assignments: { none: {} },
      closedByName: null,
    });
  } else if (selectedEmployee !== "") {
    const employee = employees.find((employeeOption) => employeeOption.id === selectedEmployee);
    if (!employee) {
      return { docketNumber: "__no_matching_employee__" };
    }

    andClauses.push({
      OR: [
        { assignedToId: selectedEmployee },
        { assignments: { some: { employeeId: selectedEmployee } } },
        { closedByName: { equals: employee.name, mode: "insensitive" } },
        { lastAttemptByName: { equals: employee.name, mode: "insensitive" } },
        { activities: { some: { employeeName: { equals: employee.name, mode: "insensitive" } } } },
      ],
    });
  }

  if (selectedCallType !== "") {
    andClauses.push({ callType: selectedCallType });
  }

  if (selectedServiceBillingType !== "") {
    andClauses.push({ serviceBillingType: selectedServiceBillingType });
  }

  const createdAtFilter = getDateRangeFilter(fromDate, toDate);
  if (createdAtFilter) {
    andClauses.push({ createdAt: createdAtFilter });
  }

  const assignedAtFilter = getDateRangeFilter(assignedFromDate, assignedToDate);
  if (assignedAtFilter) {
    andClauses.push({
      OR: [
        { assignedAt: assignedAtFilter },
        { assignments: { some: { assignedAt: assignedAtFilter } } },
      ],
    });
  }

  if (andClauses.length === 0) {
    return {};
  }

  return { AND: andClauses };
}

function getStatusWhereClause(status: CanonicalStatus): Prisma.ServiceRequestWhereInput {
  if (status === "Deleted") {
    return { deletedAt: { not: null } };
  }

  if (status === "New Call") {
    return {
      deletedAt: null,
      OR: [{ status: null }, { status: "New Call" }, { status: "Pending" }, { status: "New" }],
    };
  }

  if (status === "In Process") {
    return {
      deletedAt: null,
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
      deletedAt: null,
      OR: [{ status: "Completed" }, { status: "Close" }, { status: "Closed" }],
    };
  }

  return {
    deletedAt: null,
    OR: [{ status: "Cancel" }, { status: "Cancelled" }, { status: "Canceled" }],
  };
}

function getEarliestCreatedAt(requests: Array<{ createdAt: Date }>) {
  return requests.reduce<Date | null>((earliest, request) => {
    if (!earliest || request.createdAt.getTime() < earliest.getTime()) {
      return request.createdAt;
    }

    return earliest;
  }, null);
}

function getDateInputValue(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatDateInputLabel(value: string) {
  const parsed = parseDateInput(value, false);

  if (!parsed) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

function getDateRangeFilter(fromDate: string, toDate: string): Prisma.DateTimeFilter | undefined {
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

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30`);
  if (Number.isNaN(date.getTime())) {
    return null;
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
  fromDate,
  toDate,
  assignedFromDate,
  assignedToDate,
}: {
  searchQuery: string;
  selectedStatus: CanonicalStatus | "";
  selectedEmployee: string;
  selectedCallType: string;
  selectedServiceBillingType: string;
  fromDate: string;
  toDate: string;
  assignedFromDate: string;
  assignedToDate: string;
}) {
  return [
    searchQuery,
    selectedStatus,
    selectedEmployee,
    selectedCallType,
    selectedServiceBillingType,
    fromDate,
    toDate,
    assignedFromDate,
    assignedToDate,
  ].filter((value) => value !== "").length;
}

type CallHistoryAssignmentDisplay = {
  assignedAt: Date | null;
  status: string | null;
  closedAt: Date | null;
  statusSubmittedAt: Date | null;
  employee: { id: string; name: string } | null;
};

type CallHistoryRequestDisplay = {
  status: string | null;
  assignedAt: Date | null;
  closedByName: string | null;
  closedAt?: Date | null;
  assignedToId?: string | null;
  assignedTo: { name: string } | null;
  assignments?: CallHistoryAssignmentDisplay[];
};

type EmployeeFilterChip = {
  id: string | null;
  name: string;
};

function EmployeeFilterChips({ chips, baseQuery }: { chips: EmployeeFilterChip[]; baseQuery: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) =>
        chip.id ? (
          <a
            key={`${chip.id}:${chip.name}`}
            href={getEmployeeFilterHref(chip.id, baseQuery)}
            className="inline-flex max-w-36 items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
            title={`Filter by ${chip.name}`}
          >
            <span className="truncate">{chip.name}</span>
          </a>
        ) : (
          <span
            key={`name:${chip.name}`}
            className="inline-flex max-w-36 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
          >
            <span className="truncate">{chip.name}</span>
          </span>
        ),
      )}
    </div>
  );
}

function getCallHistoryEmployeeChips(request: CallHistoryRequestDisplay) {
  const assignments = request.assignments ?? [];
  const chips = assignments
    .map((assignment) => getEmployeeChip(assignment.employee?.name, assignment.employee?.id ?? null))
    .filter((chip): chip is EmployeeFilterChip => Boolean(chip));

  if (chips.length === 0) {
    const fallbackChip = getEmployeeChip(request.assignedTo?.name, request.assignedToId ?? null);
    if (fallbackChip) {
      chips.push(fallbackChip);
    }
  }

  return getUniqueEmployeeChips(chips);
}

function getCallHistoryCompletedByChips(request: CallHistoryRequestDisplay) {
  const isCompleted = normalizeStatus(request.status) === "Completed" || Boolean(request.closedAt);

  if (!isCompleted) {
    return [];
  }

  const assignments = request.assignments ?? [];
  const completedAssignments = assignments.filter((assignment) => {
    return normalizeStatus(assignment.status) === "Completed" || Boolean(assignment.closedAt || assignment.statusSubmittedAt);
  });
  const preferredAssignments = completedAssignments.length > 0 ? completedAssignments : assignments;
  const chips = preferredAssignments
    .map((assignment) => getEmployeeChip(assignment.employee?.name, assignment.employee?.id ?? null))
    .filter((chip): chip is EmployeeFilterChip => Boolean(chip));

  if (chips.length === 0) {
    const fallbackChip = getEmployeeChip(request.closedByName, null);
    if (fallbackChip) {
      chips.push(fallbackChip);
    }
  }

  return getUniqueEmployeeChips(chips);
}

function getCallHistoryAssignedAt(request: CallHistoryRequestDisplay) {
  const assignmentDates = (request.assignments ?? [])
    .map((assignment) => assignment.assignedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime());

  return assignmentDates[0] ?? request.assignedAt;
}

function getEmployeeChip(name: string | null | undefined, id: string | null): EmployeeFilterChip | null {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return null;
  }

  return {
    id,
    name: trimmedName,
  };
}

function getUniqueEmployeeChips(chips: EmployeeFilterChip[]) {
  const seen = new Set<string>();
  const uniqueChips: EmployeeFilterChip[] = [];

  for (const chip of chips) {
    const key = chip.id || chip.name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueChips.push(chip);
  }

  return uniqueChips;
}

function getEmployeeFilterHref(employeeId: string, baseQuery: string) {
  const params = new URLSearchParams(baseQuery);
  params.set("employeeId", employeeId);
  return `/call-history?${params.toString()}`;
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
