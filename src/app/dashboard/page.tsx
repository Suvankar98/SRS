import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { assignServiceCall, logout } from "../actions";
import { AutoLogout } from "../auto-logout";
import { BrandLogo } from "../brand-logo";
import { DocketDetailsModal } from "../docket-details-modal";
import { StatusUpdateModal } from "../status-update-modal";
import { getStatusPillClass } from "../status-utils";
import { RemarkPopup } from "../remark-popup";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const isEmployee = session.role === APP_ROLES.EMPLOYEE;
  const canEditDocket = session.role === APP_ROLES.ADMIN || session.role === APP_ROLES.MANAGER;
  const showSummaryCards = session.role === APP_ROLES.ADMIN || session.role === APP_ROLES.MANAGER;
  const canAssign = roleCanAssign(session.role);

  const visibleWhere = isEmployee ? { assignedToId: session.userId } : undefined;

  const [requests, employees, products, callTypes, totalRequests, assignedRequests, currentUser] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: visibleWhere,
      orderBy: { id: "asc" },
      take: 10,
    }),
    canAssign
      ? prisma.user.findMany({
          where: { role: APP_ROLES.EMPLOYEE },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    prisma.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.callType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.serviceRequest.count({ where: visibleWhere }),
    prisma.serviceRequest.count({ where: { ...(visibleWhere ?? {}), assignedToId: { not: null } } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);

  const unassignedRequests = totalRequests - assignedRequests;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[95rem] px-4 py-6 sm:px-6 lg:px-8">
      <AutoLogout action={logout} timeoutMs={120000} />
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
          {!isEmployee ? (
            <header className="mb-5 grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-blue-500">Overview</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-blue-950">Service dashboard</h2>
                <p className="mt-1 text-sm text-blue-700">
                  Open any docket to edit call details and keep data clean.
                </p>
              </div>

              {showSummaryCards && (
              <div className="grid gap-3 sm:grid-cols-3">
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
                  <article key={request.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 text-sm text-blue-900">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.12em] text-blue-600">
                          <DocketDetailsModal
                            request={request}
                            canEdit={canEditDocket}
                            products={products}
                            callTypes={callTypes}
                          />
                        </div>
                        <p className="font-semibold text-blue-950">{request.name}</p>
                        <p className="text-xs font-normal text-blue-700">{request.company}</p>
                        <p className="text-[11px] text-blue-600">{getComplaintAgeLabel(request.createdAt)}</p>
                      </div>
                      {!isEmployee && (
                        <StatusPill
                          label={request.status || "Pending"}
                          className={getStatusPillClass(request.status)}
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <Detail label="Location" value={request.area} />
                      <Detail label="Product" value={request.product} />
                      <Detail label="Call Type" value={request.callType} />
                      <Detail label="Phone" value={request.phoneNumber1} />
                      {request.phoneNumber2 && <Detail label="Alt Phone" value={request.phoneNumber2} />}
                      {isEmployee ? (
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600">Status</p>
                          <div className="mt-1">
                            <StatusUpdateModal request={request} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <StatusPill label={request.status || "Pending"} className={getStatusPillClass(request.status)} />
                            {request.statusReason && (
                              <RemarkPopup remark={request.statusReason} />
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {canAssign ? (
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
                      <Th>Status</Th>
                      {canAssign ? <Th>Allocate</Th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 bg-white">
                    {requests.map((request) => (
                      <tr key={request.id} className="align-top text-blue-900">
                        <Td strong>
                          <DocketDetailsModal
                            request={request}
                            canEdit={canEditDocket}
                            products={products}
                            callTypes={callTypes}
                          />
                        </Td>
                        <Td>{getComplaintAgeLabel(request.createdAt)}</Td>
                        <Td>
                          <p className="font-semibold text-blue-950">{request.name}</p>
                          <p className="mt-0.5 text-xs font-normal text-blue-700">{request.company}</p>
                        </Td>
                        <Td>{request.area}</Td>
                        <Td>{request.product}</Td>
                        <Td>{request.callType}</Td>
                        <Td>
                          {isEmployee ? (
                            <StatusUpdateModal request={request} />
                          ) : (
                            <div className="space-y-1">
                              <StatusPill
                                label={request.status || "Pending"}
                                className={getStatusPillClass(request.status)}
                              />
                              {request.statusReason && (
                                <RemarkPopup remark={request.statusReason} />
                              )}
                            </div>
                          )}
                        </Td>
                        {canAssign ? (
                          <Td>
                            <form action={assignServiceCall} className="flex items-center gap-2">
                              <input type="hidden" name="requestId" value={request.id} />
                              <select
                                name="assignedToId"
                                defaultValue={request.assignedToId ? String(request.assignedToId) : ""}
                                className="min-w-[9.5rem] flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400"
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
                                className="shrink-0 rounded-full bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800"
                              >
                                Save
                              </button>
                            </form>
                          </Td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: number; subtitle: string }) {
  return (
    <article className="rounded-xl border border-blue-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-blue-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-blue-950">{value}</p>
      <p className="mt-1 text-xs text-blue-600">{subtitle}</p>
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

function getComplaintAgeLabel(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
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

