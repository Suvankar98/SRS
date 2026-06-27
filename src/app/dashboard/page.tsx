import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { assignServiceCall, logout } from "../actions";
import { BrandLogo } from "../brand-logo";
import { DashboardFilters } from "./dashboard-filters";
import { DocketDetailsModal } from "../docket-details-modal";
import { StatusUpdateModal } from "../status-update-modal";
import { getStatusLabel, getStatusPillClass } from "../status-utils";
import { RemarkPopup } from "../remark-popup";
import { EmployeeMediaUpload } from "./employee-media-upload";
import { CopyPhoneButton } from "./copy-phone-button";
import { DashboardRequestRow } from "./dashboard-request-row";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DashboardStatus = "Pending" | "Close" | "Cancel" | "Visit & Reschedule";

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const searchQuery = getSearchParamValue(resolvedSearchParams.q).trim();
  const selectedStatuses = getSelectedStatuses(resolvedSearchParams.status);

  const isEmployee = session.role === APP_ROLES.EMPLOYEE;
  const canEditDocket = session.role === APP_ROLES.ADMIN || session.role === APP_ROLES.MANAGER;
  const showSummaryCards = session.role === APP_ROLES.ADMIN || session.role === APP_ROLES.MANAGER;
  const canAssign = roleCanAssign(session.role);

  const visibleWhere = isEmployee ? { assignedToId: session.userId } : undefined;

  const [allRequests, employees, products, currentUser] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: visibleWhere,
      orderBy: { createdAt: "desc" },
    }),
    canAssign
      ? prisma.user.findMany({
          where: { role: APP_ROLES.EMPLOYEE },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);

  const filteredRequests = filterRequests(allRequests, searchQuery, selectedStatuses);
  const sortedFilteredRequests = sortByDocketSequenceAscending(filteredRequests);
  const requests = sortedFilteredRequests.slice(-10);
  const totalRequests = sortedFilteredRequests.length;
  const assignedRequests = sortedFilteredRequests.filter((request) => Boolean(request.assignedToId)).length;

  const unassignedRequests = totalRequests - assignedRequests;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8">
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-blue-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[95rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="rounded-md bg-[#003d73] px-2 py-1 shadow-sm">
            <BrandLogo width={96} className="h-8 w-auto" />
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-3 px-2 md:flex">
            <Image
              src={getEmployeeAvatarDataUri(currentUser?.name || "User")}
              alt={`${currentUser?.name || "User"} profile photo`}
              width={42}
              height={42}
              className="h-10 w-10 rounded-full border border-blue-200 object-cover"
            />
            <div className="min-w-0 text-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-blue-500">{session.role}</p>
              <p className="truncate text-base font-semibold text-blue-950">{currentUser?.name || "User"}</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
            >
              Dashboard
            </Link>
            {(session.role === APP_ROLES.ADMIN || canAssign) && (
              <Link
                href="/gallery"
                className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
              >
                Gallery
              </Link>
            )}
            {(session.role === APP_ROLES.ADMIN || canAssign) && (
              <Link
                href="/form"
                className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
              >
                New Call
              </Link>
            )}
            {session.role === APP_ROLES.ADMIN && (
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
              >
                Admin Panel
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                className="danger-btn inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium"
              >
                Logout
              </button>
            </form>
          </div>

          <details className="relative ml-auto md:hidden">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-800">
              <span className="sr-only">Open menu</span>
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-blue-200 bg-white p-3 shadow-xl">
              <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/80 p-2.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-blue-500">{session.role}</p>
                <p className="mt-1 text-sm font-semibold text-blue-950">{currentUser?.name || "User"}</p>
              </div>
              <div className="space-y-2">
                {!isEmployee && (
                  <Link
                    href="/dashboard"
                    className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                  >
                    Dashboard
                  </Link>
                )}
                {(session.role === APP_ROLES.ADMIN || canAssign) && (
                  <Link
                    href="/form"
                    className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                  >
                    New Call
                  </Link>
                )}
                {(session.role === APP_ROLES.ADMIN || canAssign) && (
                  <Link
                    href="/gallery"
                    className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                  >
                    Gallery
                  </Link>
                )}
                {session.role === APP_ROLES.ADMIN && (
                  <Link
                    href="/admin"
                    className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                  >
                    Admin Panel
                  </Link>
                )}
                <form action={logout}>
                  <button
                    type="submit"
                    className="danger-btn inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    Logout
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>
      </header>

      <section className="min-h-[calc(100vh-3rem)] pt-20">

        <div className="rounded-[2rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(29,78,216,0.12)] sm:p-6">
          <div>
              {!isEmployee ? (
                <header className="mb-3 grid gap-2 xl:mb-5 xl:gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <div className="rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 px-5 py-5">
                    <p className="text-xs uppercase tracking-[0.25em] text-blue-500">Overview</p>
                    <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="pr-2">
                        <h2 className="text-3xl font-semibold tracking-tight text-blue-950">Service Dashboard</h2>
                      </div>
                      <DashboardFilters
                        initialQuery={searchQuery}
                        initialStatuses={selectedStatuses}
                      />
                    </div>
                  </div>

                  {showSummaryCards && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                      <MetricCard title="Total Calls" value={totalRequests} subtitle="All visible complaints" />
                      <MetricCard title="Assigned" value={assignedRequests} subtitle="Allocated to employee" />
                      <MetricCard title="Unassigned" value={unassignedRequests} subtitle="Need allocation" />
                    </div>
                  )}
                </header>
              ) : null}

              {requests.length === 0 ? (
                <section className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 px-6 py-16 text-center text-blue-700">
                  <p className="text-lg font-semibold text-blue-900">No service requests available</p>
                  <p className="mt-2 text-sm">New calls will appear here once created.</p>
                </section>
              ) : (
                <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white">
                  <div className="space-y-3 p-3 md:hidden">
                    {requests.map((request) => (
                      <article
                        key={request.id}
                        className={`rounded-xl border p-3 text-sm text-blue-900 ${
                          !isEmployee && isClosedStatus(request.status)
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-blue-200 bg-blue-50/40"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs uppercase tracking-[0.12em] text-blue-600">
                              <DocketDetailsModal
                                request={request}
                                canEdit={canEditDocket}
                                products={products}
                              />
                            </div>
                            <p className="font-semibold text-blue-950">{request.name}</p>
                            <p className="text-xs font-normal text-blue-700">{request.company}</p>
                            <p className="text-[11px] text-blue-600">{getComplaintAgeLabel(request)}</p>
                          </div>
                          {!isEmployee && (
                            <div className="flex flex-col items-end">
                              <StatusPill
                                label={getStatusLabel(request.status)}
                                className={getStatusPillClass(request.status)}
                              />
                              {request.statusReason && (
                                <div className="mt-2">
                                  <RemarkPopup remark={request.statusReason} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                          <Detail label="Location" value={request.area} />
                          <Detail label="Product" value={request.product} />
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Call Type</p>
                            <p className="mt-0.5 break-words text-blue-900">{request.callType}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Billing</p>
                            <p className="mt-0.5 break-words text-blue-900">
                              {request.callType === "Service" && request.serviceBillingType ? (
                                <span className="font-bold text-blue-700">
                                  {formatServiceBillingType(request.serviceBillingType)}
                                  {request.serviceBillingType === "chargeable" && request.chargeableAmount !== null
                                    ? ` - ${formatINRCurrency(request.chargeableAmount)}`
                                    : ""}
                                </span>
                              ) : (
                                <span className="text-blue-600">Not applicable</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Phone</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-blue-900">
                              <span>{request.phoneNumber1}</span>
                              {isEmployee ? (
                                <span className="inline-flex items-center gap-2 sm:gap-3">
                                  <CopyPhoneButton value={request.phoneNumber1} />
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {request.phoneNumber2 && <Detail label="Alt Phone" value={request.phoneNumber2} />}
                          {isEmployee ? (
                            <div className="flex flex-col gap-2">
                              <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Status</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusUpdateModal request={request} />
                                <EmployeeMediaUpload requestId={request.id} />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {isEmployee ? null : null}

                        {canAssign ? (
                          isClosedStatus(request.status) ? (
                            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                              <p className="text-xs font-semibold text-emerald-900">
                                <span className="uppercase tracking-[0.08em] text-emerald-700">Closed By:</span>{" "}
                                {getClosedByName(request)}
                              </p>
                            </div>
                          ) : (
                            <form action={assignServiceCall} className="mt-3 space-y-2">
                              <input type="hidden" name="requestId" value={request.id} />
                              <label className="block text-xs font-medium text-blue-700">Allocate employee</label>
                              <select
                                name="assignedToId"
                                defaultValue={request.assignedToId ? String(request.assignedToId) : ""}
                                className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                              >
                                <option value="">Select employee</option>
                                {employees.map((employee) => (
                                  <option key={employee.id} value={employee.id}>
                                    {employee.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800"
                              >
                                Save
                              </button>
                            </form>
                          )
                        ) : null}
                      </article>
                    ))}
                  </div>

                  <div className="hidden md:block">
                    <table className="w-full table-auto divide-y divide-blue-100 text-left text-xs">
                      <thead className="bg-blue-50 text-blue-700">
                        <tr>
                          <Th>Docket</Th>
                          <Th>Days Old</Th>
                          <Th>Name</Th>
                          <Th>Location</Th>
                          <Th>Product</Th>
                          <Th>Call Type</Th>
                          <Th>Billing</Th>
                          <Th>Status</Th>
                          {isEmployee ? <Th>Media</Th> : null}
                          {canAssign ? <Th>Allocate</Th> : null}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100 bg-white">
                      {requests.map((request) => (
                        <DashboardRequestRow
                          key={request.id}
                          request={request}
                          products={products}
                          employees={employees}
                          canEditDocket={canEditDocket}
                          canAssign={canAssign}
                          isEmployee={isEmployee}
                        />
                      ))}
                    </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          </div>
      </section>
    </main>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
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

function StatusPill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">{label}</p>
      <p className="mt-0.5 break-words text-blue-900">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="break-words px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]">{children}</th>;
}

function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td className={`px-2.5 py-2.5 align-top whitespace-normal break-words text-xs ${strong ? "font-semibold text-blue-950" : ""}`}>
      {children}
    </td>
  );
}

function getComplaintAgeLabel(request: { createdAt: Date; status: string | null } & Record<string, unknown>) {
  const createdAt = request.createdAt;
  const closedAt = getClosedAt(request);
  const endDate = request.status === "Close" && closedAt ? closedAt : new Date();

  const endDay = getDayNumberInTimeZone(endDate, "Asia/Kolkata");
  const createdDay = getDayNumberInTimeZone(createdAt, "Asia/Kolkata");
  const days = Math.max(0, endDay - createdDay);

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
}

function getDayNumberInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return Math.floor(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
}

function isClosedStatus(status: string | null) {
  return (status || "Pending") === "Close";
}

function getClosedByName(request: Record<string, unknown>) {
  const value = request.closedByName;
  return typeof value === "string" && value.trim() !== "" ? value : "Unknown";
}

function getClosedAt(request: Record<string, unknown>) {
  const value = request.closedAt;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function formatServiceBillingType(value: string) {
  if (value === "amc") {
    return "AMC";
  }

  if (value === "warranty") {
    return "Warranty";
  }

  if (value === "chargeable") {
    return "Chargeable";
  }

  return value;
}

function formatINRCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getSelectedStatuses(value: string | string[] | undefined): DashboardStatus[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const allowedStatuses: DashboardStatus[] = ["Pending", "Close", "Cancel", "Visit & Reschedule"];

  return values.filter((status): status is DashboardStatus =>
    allowedStatuses.includes(status as DashboardStatus),
  );
}

function filterRequests<
  T extends {
    docketNumber: string;
    name: string;
    company: string;
    area: string;
    product: string;
    callType: string;
    phoneNumber1: string;
    phoneNumber2: string | null;
    complaintDetails: string | null;
    fullAddress: string;
    status: string | null;
    assignedToId: string | null;
  },
>(requests: T[], searchQuery: string, selectedStatuses: DashboardStatus[]) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return requests.filter((request) => {
    const requestStatus = (request.status || "Pending") as DashboardStatus;
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(requestStatus);
    const matchesSearch =
      normalizedQuery === "" ||
      [
        request.docketNumber,
        request.name,
        request.company,
        request.area,
        request.product,
        request.callType,
        request.phoneNumber1,
        request.phoneNumber2 || "",
        request.complaintDetails || "",
        request.fullAddress,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));

    return matchesStatus && matchesSearch;
  });
}

function getDocketSequence(docketNumber: string) {
  const match = /^srs-(\d+)$/i.exec(docketNumber.trim());
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function sortByDocketSequenceAscending<T extends { docketNumber: string }>(requests: T[]) {
  return [...requests].sort((a, b) => {
    const aSequence = getDocketSequence(a.docketNumber);
    const bSequence = getDocketSequence(b.docketNumber);

    if (aSequence !== bSequence) {
      return aSequence - bSequence;
    }

    return a.docketNumber.localeCompare(b.docketNumber, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function getEmployeeAvatarDataUri(name: string) {
  const trimmedName = name.trim() || "Employee";
  const initials = trimmedName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "E";

  const safeLabel = trimmedName.replace(/[<>&"']/g, "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0%' stop-color='#1d4ed8'/><stop offset='100%' stop-color='#0ea5e9'/></linearGradient></defs><rect width='96' height='96' rx='48' fill='url(#g)'/><text x='48' y='52' dominant-baseline='middle' text-anchor='middle' font-size='34' font-family='Arial, sans-serif' font-weight='700' fill='white'>${initials}</text><title>${safeLabel}</title></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}


