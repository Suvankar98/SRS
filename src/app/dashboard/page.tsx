import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { assignServiceCall, logout } from "../actions";
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
      <section className="grid min-h-[calc(100vh-3rem)] gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-blue-200/70 bg-gradient-to-b from-blue-900 to-blue-700 p-4 text-blue-50 shadow-[0_24px_70px_rgba(30,64,175,0.35)]">
          <div className="rounded-2xl bg-white/10 px-3 py-4 backdrop-blur">
            <div className="rounded-xl border border-white/20 bg-[#003d73] p-2">
              <BrandLogo width={150} className="h-auto w-auto" />
            </div>
            <h1 className="mt-1 text-lg font-semibold">Operations</h1>
            <p className="mt-1 text-xs text-blue-100/80">{session.role.toLowerCase()} view</p>
          </div>

          <nav className="mt-5 space-y-2 text-sm font-medium">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2 text-white"
            >
              <span className="h-2 w-2 rounded-full bg-white" />
              Dashboard
            </Link>
            {(session.role === APP_ROLES.ADMIN || canAssign) && (
              <Link
                href="/form"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-blue-100 transition hover:bg-white/10"
              >
                <span className="h-2 w-2 rounded-full bg-blue-200" />
                New Call
              </Link>
            )}
            {session.role === APP_ROLES.ADMIN && (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-blue-100 transition hover:bg-white/10"
              >
                <span className="h-2 w-2 rounded-full bg-blue-200" />
                Admin Panel
              </Link>
            )}
          </nav>

          <form action={logout} className="mt-6">
            <button
              type="submit"
              className="danger-btn inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-medium"
            >
              Logout
            </button>
          </form>
        </aside>

        <div className="rounded-[2rem] border border-blue-200 bg-white p-4 shadow-[0_20px_80px_rgba(29,78,216,0.12)] dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <header className={`mb-5 grid gap-3 ${isEmployee ? "" : "xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"}`}>
            {isEmployee ? (
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
                <div className="flex items-center gap-4">
                  <Image
                    src={getEmployeeAvatarDataUri(currentUser?.name || "Employee")}
                    alt={`${currentUser?.name || "Employee"} profile photo`}
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-full border border-blue-200 object-cover shadow-sm dark:border-slate-600"
                  />
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-blue-500 dark:text-sky-300">Employee</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-blue-950 dark:text-slate-100">
                      {currentUser?.name || "Employee"}
                    </h2>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-4 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800">
                <p className="text-xs uppercase tracking-[0.25em] text-blue-500 dark:text-sky-300">Overview</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-blue-950 dark:text-slate-100">Service dashboard</h2>
                <p className="mt-1 text-sm text-blue-700 dark:text-slate-300">
                  Open any docket to edit call details and keep data clean.
                </p>
              </div>
            )}

            {showSummaryCards && (
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard title="Total Calls" value={totalRequests} subtitle="All visible complaints" />
                <MetricCard title="Assigned" value={assignedRequests} subtitle="Allocated to employee" />
                <MetricCard title="Unassigned" value={unassignedRequests} subtitle="Need allocation" />
              </div>
            )}
          </header>

          {requests.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 px-6 py-16 text-center text-blue-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <p className="text-lg font-semibold text-blue-900 dark:text-slate-100">No service requests available</p>
              <p className="mt-2 text-sm dark:text-slate-300">New calls will appear here once created.</p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <div className="space-y-3 p-3 md:hidden">
                {requests.map((request) => (
                  <article key={request.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 text-sm text-blue-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.12em] text-blue-600 dark:text-sky-300">
                          <DocketDetailsModal
                            request={request}
                            canEdit={canEditDocket}
                            products={products}
                            callTypes={callTypes}
                          />
                        </div>
                        <p className="font-semibold text-blue-950 dark:text-slate-100">{request.name}</p>
                        <p className="text-xs font-normal text-blue-700 dark:text-slate-300">{request.company}</p>
                        <p className="text-[11px] text-blue-600 dark:text-slate-300">{getComplaintAgeLabel(request.createdAt)}</p>
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
                          <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600 dark:text-slate-300">Status</p>
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
                        <label className="block text-xs font-medium text-blue-700 dark:text-slate-200">Allocate employee</label>
                        <select
                          name="assignedToId"
                          defaultValue={request.assignedToId ? String(request.assignedToId) : ""}
                          className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
                          className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                        >
                          Save
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="hidden md:block">
                <table className="w-full table-auto divide-y divide-blue-100 text-left text-xs dark:divide-slate-700">
                  <thead className="bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-slate-200">
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
                  <tbody className="divide-y divide-blue-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
                    {requests.map((request) => (
                      <tr key={request.id} className="align-top text-blue-900 dark:text-slate-100">
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
                          <p className="font-semibold text-blue-950 dark:text-slate-100">{request.name}</p>
                          <p className="mt-0.5 text-xs font-normal text-blue-700 dark:text-slate-300">{request.company}</p>
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
                                className="min-w-[9.5rem] flex-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                                className="shrink-0 rounded-full bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500"
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
    <article className="rounded-xl border border-blue-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs uppercase tracking-[0.2em] text-blue-500 dark:text-sky-300">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-blue-950 dark:text-slate-100">{value}</p>
      <p className="mt-1 text-xs text-blue-600 dark:text-slate-300">{subtitle}</p>
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
      <p className="text-[11px] uppercase tracking-[0.08em] text-blue-600 dark:text-slate-300">{label}</p>
      <p className="mt-0.5 break-words text-blue-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="break-words px-2.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em]">{children}</th>;
}

function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <td className={`px-2.5 py-2.5 align-top whitespace-normal break-words text-xs ${strong ? "font-semibold text-blue-950 dark:text-slate-100" : ""}`}>
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
