import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "../actions";
import CreatedToast from "./created-toast";
import { DashboardFilters } from "./dashboard-filters";
import { DashboardRequestList } from "./dashboard-request-list";
import { EmployeeReportPopup } from "./employee-report-popup";
import { normalizeStatus } from "../status-utils";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProductOptions } from "@/lib/product-options";
import { ATTENDANCE_IN_POINTS, ATTENDANCE_OUT_POINTS } from "@/lib/employee-performance-rules";
import {
  getDashboardMediaItemsByRequestIds,
  type DashboardRequestMediaItem,
} from "@/lib/gallery";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DashboardStatus = "New Call" | "In Process" | "Completed" | "Cancel";

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const searchQuery = getSearchParamValue(resolvedSearchParams.q).trim();
  const selectedStatuses = getSelectedStatuses(resolvedSearchParams.status);
  const createdDocket = typeof resolvedSearchParams.created === 'string' ? resolvedSearchParams.created : null;

  const isEmployee = session.role === APP_ROLES.EMPLOYEE;
  const canEditDocket = session.role === APP_ROLES.ADMIN || session.role === APP_ROLES.MANAGER;
  const showSummaryCards = session.role === APP_ROLES.ADMIN || session.role === APP_ROLES.MANAGER;
  const canAssign = roleCanAssign(session.role);

  const [employees, databaseProducts, currentUser, employeePointAdjustments] = await Promise.all([
    canAssign
      ? prisma.user.findMany({
          where: { role: APP_ROLES.EMPLOYEE },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, performancePoints: true } }),
    isEmployee
      ? prisma.employeePointAdjustment.findMany({
          where: { employeeId: session.userId },
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
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);
  const products = getProductOptions(databaseProducts);

  const allRequests = isEmployee
    ? [
        ...(await prisma.serviceAssignment.findMany({
          where: { employeeId: session.userId },
          orderBy: { assignedAt: "desc" },
          include: {
            employee: { select: { name: true } },
            request: {
              include: {
                assignedTo: {
                  select: { name: true },
                },
                createdBy: {
                  select: { name: true },
                },
                assignments: {
                  orderBy: { assignedAt: "asc" },
                  include: { employee: { select: { name: true } } },
                },
              },
            },
          },
        })).map((assignment) => ({
          ...assignment.request,
          assignedToId: assignment.employeeId,
          assignedTo: assignment.employee,
          assignedAt: assignment.assignedAt,
          status: assignment.status ?? "New Call",
          statusReason: assignment.statusReason,
          statusSubmittedAt: assignment.statusSubmittedAt,
          statusPointsDelta: assignment.statusPointsDelta,
          mediaUploadedAt: assignment.mediaUploadedAt,
          closedByName: assignment.closedByName,
          closedAt: assignment.closedAt,
        })),
        ...(await prisma.serviceRequest.findMany({
          where: {
            assignedToId: session.userId,
            assignments: {
              none: { employeeId: session.userId },
            },
          },
          orderBy: { assignedAt: "desc" },
          include: {
            assignedTo: {
              select: { name: true },
            },
            createdBy: {
              select: { name: true },
            },
            assignments: {
              orderBy: { assignedAt: "asc" },
              include: { employee: { select: { name: true } } },
            },
          },
        })),
      ]
    : await prisma.serviceRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          assignedTo: {
            select: { name: true },
          },
          createdBy: {
            select: { name: true },
          },
          assignments: {
            orderBy: { assignedAt: "asc" },
            include: { employee: { select: { name: true } } },
          },
        },
      });

  const employeeReportRequests =
    isEmployee && currentUser?.name
      ? await prisma.serviceRequest.findMany({
          where: {
            OR: [
              { lastAttemptByName: { equals: currentUser.name, mode: "insensitive" } },
              { closedByName: { equals: currentUser.name, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            docketNumber: true,
            name: true,
            company: true,
            area: true,
            status: true,
            statusReason: true,
            statusPointsDelta: true,
            createdAt: true,
            assignedAt: true,
            statusSubmittedAt: true,
            lastAttemptAt: true,
            closedAt: true,
          },
          orderBy: [{ lastAttemptAt: "desc" }, { statusSubmittedAt: "desc" }, { createdAt: "desc" }],
          take: 20,
        })
      : [];

  const mediaByRequestId: Map<string, DashboardRequestMediaItem[]> = canAssign
    ? await getDashboardMediaItemsByRequestIds(allRequests.map((request) => request.id))
    : new Map();
  const dashboardRequests = allRequests.map((request) => ({
    ...request,
    mediaItems: mediaByRequestId.get(request.id) ?? [],
  }));

  const filteredRequests = filterRequests(dashboardRequests, searchQuery, selectedStatuses);
  const visibleRequests = isEmployee
    ? filteredRequests.filter(
        (request) => !request.statusSubmittedAt && normalizeStatus(request.status) !== "Completed",
      )
    : filteredRequests;
  const sortedFilteredRequests = isEmployee
    ? sortByEmployeeQueueOrder(visibleRequests)
    : sortByDashboardOrder(visibleRequests);
  const requests = isEmployee ? sortedFilteredRequests : sortedFilteredRequests.slice(-10);
  const totalRequests = sortedFilteredRequests.length;
  const assignedRequests = sortedFilteredRequests.filter(
    (request) => Boolean(request.assignedToId) || (request.assignments?.length ?? 0) > 0,
  ).length;
  const employeeReport = isEmployee
    ? buildEmployeeReportRows({
        activeRequests: allRequests,
        reportRequests: employeeReportRequests,
        pointAdjustments: employeePointAdjustments,
      })
    : { rows: [], totalPoints: 0 };

  const unassignedRequests = totalRequests - assignedRequests;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[95rem] px-2 py-4 sm:px-6 sm:py-6 lg:px-8"> 
      {/* show created toast client-side when a new service is created */}
      <CreatedToast docket={createdDocket} />
      <header className="fixed left-0 right-0 top-0 z-40 border-b border-blue-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[95rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex h-12 w-36 items-center rounded-lg border border-blue-100 bg-white px-2 shadow-sm">
            <Image
              src="/dashboard-srtec-logo.svg"
              alt="SRTEC Automation"
              width={144}
              height={65}
              className="h-10 w-full object-contain"
              priority
              unoptimized
            />
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
            {!isEmployee && (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
              >
                Dashboard
              </Link>
            )}
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
                href="/report"
                className="inline-flex items-center justify-center rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
              >
                Reports
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
            {isEmployee ? (
              <EmployeeReportPopup>
                <EmployeeReportTable
                  rows={employeeReport.rows}
                  totalPoints={employeeReport.totalPoints}
                />
              </EmployeeReportPopup>
            ) : null}
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
                {(session.role === APP_ROLES.ADMIN || canAssign) && (
                  <Link
                    href="/report"
                    className="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                  >
                    Reports
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
                {isEmployee ? (
                  <EmployeeReportPopup buttonClassName="inline-flex w-full items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50">
                    <EmployeeReportTable
                      rows={employeeReport.rows}
                      totalPoints={employeeReport.totalPoints}
                    />
                  </EmployeeReportPopup>
                ) : null}
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

        <div className="rounded-2xl border border-blue-200 bg-white p-2 shadow-[0_20px_80px_rgba(29,78,216,0.12)] sm:rounded-[2rem] sm:p-6">
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
                <DashboardRequestList
                  key={requests.map((request) => `${request.id}:${request.dashboardOrder ?? ""}:${request.status ?? ""}:${request.assignedToId ?? ""}:${request.statusSubmittedAt ?? ""}:${request.lastAttemptByName ?? ""}:${request.lastAttemptAt ?? ""}:${request.mediaItems?.length ?? 0}:${request.assignments?.map((assignment) => assignment.employeeId).join(",") ?? ""}`).join("|")}
                  requests={requests}
                  products={products}
                  employees={employees}
                  canEditDocket={canEditDocket}
                  canAssign={canAssign}
                  isEmployee={isEmployee}
                />
              )}
            </div>
          </div>
      </section>
    </main>
  );
}

type EmployeeReportRequest = {
  id: string;
  docketNumber: string;
  name: string;
  company: string;
  area: string;
  status: string | null;
  statusReason: string | null;
  statusPointsDelta: number | null;
  createdAt: Date;
  assignedAt?: Date | string | null;
  statusSubmittedAt?: Date | string | null;
  lastAttemptAt?: Date | string | null;
  closedAt?: Date | string | null;
};

type EmployeeReportPointAdjustment = {
  id: string;
  attendanceOption: string;
  attendancePoints: number;
  reviewOption: string;
  reviewPoints: number;
  documentSubmissionOption: string;
  documentSubmissionPoints: number;
  materialHandoverOption: string;
  materialHandoverPoints: number;
  createdAt: Date;
};

type EmployeeReportPointCell = {
  label: string;
  points: number | null;
};

type EmployeeReportCompanyDocket = {
  companyName: string;
  docketNumber: string;
};

type EmployeeReportRow = {
  id: string;
  companyDockets: EmployeeReportCompanyDocket[];
  date: Date;
  workSubmission: EmployeeReportPointCell;
  attendanceIn: EmployeeReportPointCell;
  attendanceOut: EmployeeReportPointCell;
  review: EmployeeReportPointCell;
  documentSubmission: EmployeeReportPointCell;
  materialHandover: EmployeeReportPointCell;
};

function EmployeeReportTable({ rows, totalPoints }: { rows: EmployeeReportRow[]; totalPoints: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-blue-950">Report</h2>
          <p className="mt-0.5 text-xs text-blue-600">Work submission and performance points summary</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-900">
          Total Points: {totalPoints}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-blue-700">
          No report entries available yet.
        </div>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {rows.map((row) => (
              <article key={row.id} className="rounded-xl border border-blue-100 bg-white p-3 text-xs text-blue-900 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Company Name / Docket Number</p>
                    <EmployeeReportCompanyDockets companyDockets={row.companyDockets} />
                  </div>
                  <EmployeeReportPointBadge label="Work Submission" value={row.workSubmission} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <EmployeeReportMobileField label="Date" value={formatEmployeeReportDate(row.date)} />
                  <EmployeeReportAttendancePointField attendanceIn={row.attendanceIn} attendanceOut={row.attendanceOut} />
                  <EmployeeReportPointField label="Review" value={row.review} />
                  <EmployeeReportPointField label="Documents Submission" value={row.documentSubmission} />
                  <EmployeeReportPointField label="Material Handover" value={row.materialHandover} />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[980px] w-full table-auto divide-y divide-blue-100 text-left text-xs">
              <thead className="bg-white text-blue-700">
                <tr>
                  <EmployeeReportTh>Company Name / Docket Number</EmployeeReportTh>
                  <EmployeeReportTh>Date</EmployeeReportTh>
                  <EmployeeReportTh>Work Submission</EmployeeReportTh>
                  <EmployeeReportTh>Attendance</EmployeeReportTh>
                  <EmployeeReportTh>Review</EmployeeReportTh>
                  <EmployeeReportTh>Documents Submission</EmployeeReportTh>
                  <EmployeeReportTh>Material Handover</EmployeeReportTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-3 text-blue-950">
                      <EmployeeReportCompanyDockets companyDockets={row.companyDockets} />
                    </td>
                    <td className="px-3 py-3 font-medium text-blue-900">{formatEmployeeReportDate(row.date)}</td>
                    <EmployeeReportPointTd value={row.workSubmission} />
                    <EmployeeReportAttendancePointTd attendanceIn={row.attendanceIn} attendanceOut={row.attendanceOut} />
                    <EmployeeReportPointTd value={row.review} />
                    <EmployeeReportPointTd value={row.documentSubmission} />
                    <EmployeeReportPointTd value={row.materialHandover} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function EmployeeReportTh({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-blue-800">
      {children}
    </th>
  );
}

function EmployeeReportCompanyDockets({ companyDockets }: { companyDockets: EmployeeReportCompanyDocket[] }) {
  if (companyDockets.length === 0) {
    return <p className="font-semibold text-blue-950">-</p>;
  }

  return (
    <div className="space-y-2">
      {companyDockets.map((entry) => (
        <div key={`${entry.companyName}-${entry.docketNumber}`}>
          <p className="break-words font-semibold text-blue-950">{entry.companyName}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">{entry.docketNumber}</p>
        </div>
      ))}
    </div>
  );
}

function EmployeeReportMobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-blue-950">{value}</p>
    </div>
  );
}

function EmployeeReportPointField({ label, value }: { label: string; value: EmployeeReportPointCell }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-blue-950">{formatEmployeeReportPoint(value)}</p>
    </div>
  );
}

function EmployeeReportAttendancePointField({
  attendanceIn,
  attendanceOut,
}: {
  attendanceIn: EmployeeReportPointCell;
  attendanceOut: EmployeeReportPointCell;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Attendance</p>
      <EmployeeReportAttendanceLines attendanceIn={attendanceIn} attendanceOut={attendanceOut} />
    </div>
  );
}

function EmployeeReportPointBadge({ label, value }: { label: string; value: EmployeeReportPointCell }) {
  return (
    <div className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-right">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">{label}</p>
      <p className="font-semibold text-blue-950">{formatEmployeeReportPoint(value)}</p>
    </div>
  );
}

function EmployeeReportPointTd({ value }: { value: EmployeeReportPointCell }) {
  return (
    <td className="px-3 py-3 text-blue-900">
      <p className="font-semibold text-blue-950">{formatEmployeeReportPoint(value)}</p>
    </td>
  );
}

function EmployeeReportAttendancePointTd({
  attendanceIn,
  attendanceOut,
}: {
  attendanceIn: EmployeeReportPointCell;
  attendanceOut: EmployeeReportPointCell;
}) {
  return (
    <td className="px-3 py-3 text-blue-900">
      <EmployeeReportAttendanceLines attendanceIn={attendanceIn} attendanceOut={attendanceOut} />
    </td>
  );
}

function EmployeeReportAttendanceLines({
  attendanceIn,
  attendanceOut,
}: {
  attendanceIn: EmployeeReportPointCell;
  attendanceOut: EmployeeReportPointCell;
}) {
  return (
    <div className="grid w-fit min-w-24 grid-cols-2 gap-x-4 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">IN</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">OUT</p>
      <p className="mt-1 font-semibold text-blue-950">{formatEmployeeReportPoint(attendanceIn)}</p>
      <p className="mt-1 font-semibold text-blue-950">{formatEmployeeReportPoint(attendanceOut)}</p>
    </div>
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
  return <th className="break-words px-2.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">{children}</th>;
}

function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td className={`px-2.5 py-2.5 align-top whitespace-normal break-words text-xs ${strong ? "font-semibold text-blue-950" : ""}`}>
      {children}
    </td>
  );
}

function buildEmployeeReportRows({
  activeRequests,
  reportRequests,
  pointAdjustments,
}: {
  activeRequests: EmployeeReportRequest[];
  reportRequests: EmployeeReportRequest[];
  pointAdjustments: EmployeeReportPointAdjustment[];
}) {
  const rows = new Map<string, EmployeeReportRow>();
  const countedRequestIds = new Set<string>();

  for (const request of [...activeRequests, ...reportRequests]) {
    if (countedRequestIds.has(request.id)) {
      continue;
    }

    const reportDate = getEmployeeReportDate(request);

    if (!reportDate) {
      continue;
    }

    const row = getOrCreateEmployeeReportRow(rows, reportDate);
    addCompanyDocketToEmployeeReportRow(row, request);

    if (typeof request.statusPointsDelta === "number") {
      addEmployeeReportPoints(row.workSubmission, request.statusPointsDelta);
    }

    countedRequestIds.add(request.id);
  }

  for (const adjustment of pointAdjustments) {
    const row = getOrCreateEmployeeReportRow(rows, adjustment.createdAt);
    const attendancePoints = getEmployeeReportAttendancePoints(adjustment);
    addEmployeeReportPoints(row.attendanceIn, attendancePoints.inPoints);
    addEmployeeReportPoints(row.attendanceOut, attendancePoints.outPoints);
    addEmployeeReportPoints(row.review, adjustment.reviewPoints);
    addEmployeeReportPoints(row.documentSubmission, adjustment.documentSubmissionPoints);
    addEmployeeReportPoints(row.materialHandover, adjustment.materialHandoverPoints);
  }

  const sortedRows = Array.from(rows.values())
    .sort((a, b) => getNullableDateTime(b.date) - getNullableDateTime(a.date))
    .slice(0, 20);

  return {
    rows: sortedRows,
    totalPoints: calculateEmployeeReportTotal(sortedRows),
  };
}

function getOrCreateEmployeeReportRow(rows: Map<string, EmployeeReportRow>, date: Date) {
  const dateKey = getEmployeeReportDateKey(date);
  const existingRow = rows.get(dateKey);

  if (existingRow) {
    return existingRow;
  }

  const row: EmployeeReportRow = {
    id: dateKey,
    companyDockets: [],
    date,
    workSubmission: emptyEmployeeReportPointCell(),
    attendanceIn: emptyEmployeeReportPointCell(),
    attendanceOut: emptyEmployeeReportPointCell(),
    review: emptyEmployeeReportPointCell(),
    documentSubmission: emptyEmployeeReportPointCell(),
    materialHandover: emptyEmployeeReportPointCell(),
  };

  rows.set(dateKey, row);
  return row;
}

function addCompanyDocketToEmployeeReportRow(row: EmployeeReportRow, request: EmployeeReportRequest) {
  const exists = row.companyDockets.some((entry) => entry.docketNumber === request.docketNumber);

  if (!exists) {
    row.companyDockets.push({
      companyName: request.company,
      docketNumber: request.docketNumber,
    });
  }
}

function addEmployeeReportPoints(cell: EmployeeReportPointCell, points: number) {
  cell.points = (cell.points ?? 0) + points;
}

function getEmployeeReportAttendancePoints(adjustment: EmployeeReportPointAdjustment) {
  try {
    const parsed = JSON.parse(adjustment.attendanceOption) as { inOption?: unknown; outOption?: unknown };
    const inOption = typeof parsed.inOption === "string" ? parsed.inOption : "";
    const outOption = typeof parsed.outOption === "string" ? parsed.outOption : "";

    return {
      inPoints: getAttendanceInPoints(inOption),
      outPoints: getAttendanceOutPoints(outOption),
    };
  } catch {
    return {
      inPoints: adjustment.attendancePoints,
      outPoints: 0,
    };
  }
}

function getAttendanceInPoints(value: string) {
  if (value in ATTENDANCE_IN_POINTS) {
    return ATTENDANCE_IN_POINTS[value as keyof typeof ATTENDANCE_IN_POINTS].points;
  }

  return 0;
}

function getAttendanceOutPoints(value: string) {
  if (value in ATTENDANCE_OUT_POINTS) {
    return ATTENDANCE_OUT_POINTS[value as keyof typeof ATTENDANCE_OUT_POINTS].points;
  }

  return 0;
}

function calculateEmployeeReportTotal(rows: EmployeeReportRow[]) {
  return rows.reduce(
    (total, row) =>
      total +
      (row.workSubmission.points ?? 0) +
      (row.attendanceIn.points ?? 0) +
      (row.attendanceOut.points ?? 0) +
      (row.review.points ?? 0) +
      (row.documentSubmission.points ?? 0) +
      (row.materialHandover.points ?? 0),
    0,
  );
}

function emptyEmployeeReportPointCell(): EmployeeReportPointCell {
  return { label: "-", points: null };
}

function getEmployeeReportDate(request: EmployeeReportRequest) {
  return (
    getDateValue(request.lastAttemptAt) ??
    getDateValue(request.statusSubmittedAt) ??
    getDateValue(request.closedAt) ??
    getDateValue(request.assignedAt) ??
    getDateValue(request.createdAt)
  );
}

function getDateValue(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getNullableDateTime(value: Date | null) {
  return value ? value.getTime() : 0;
}

function getEmployeeReportDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatEmployeeReportDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatPointDelta(value: number | null) {
  if (typeof value !== "number") {
    return "-";
  }

  return value > 0 ? `+${value}` : String(value);
}

function formatEmployeeReportPoint(value: EmployeeReportPointCell) {
  return formatPointDelta(value.points);
}

function getComplaintAgeLabel(request: { createdAt: Date; status: string | null } & Record<string, unknown>) {
  const createdAt = request.createdAt;
  const closedAt = getClosedAt(request);
  const endDate = request.status === "Completed" && closedAt ? closedAt : new Date();

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
  return normalizeStatus(status) === "Completed";
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
  const allowedStatuses: DashboardStatus[] = ["New Call", "In Process", "Completed", "Cancel"];

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
    const requestStatus = normalizeStatus(request.status);
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

function sortByDashboardOrder<T extends { docketNumber: string; dashboardOrder: number | null }>(requests: T[]) {
  return [...requests].sort((a, b) => {
    const aHasOrder = typeof a.dashboardOrder === "number";
    const bHasOrder = typeof b.dashboardOrder === "number";

    if (aHasOrder || bHasOrder) {
      if (!aHasOrder) {
        return 1;
      }

      if (!bHasOrder) {
        return -1;
      }

      const aOrder = a.dashboardOrder ?? 0;
      const bOrder = b.dashboardOrder ?? 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
    }

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

function sortByEmployeeQueueOrder<T extends { assignedAt: Date | null; createdAt: Date }>(requests: T[]) {
  return [...requests].sort((a, b) => {
    const aTime = (a.assignedAt ?? a.createdAt).getTime();
    const bTime = (b.assignedAt ?? b.createdAt).getTime();

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
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


