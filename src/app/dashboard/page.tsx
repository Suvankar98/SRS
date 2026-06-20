import Link from "next/link";
import { redirect } from "next/navigation";

import { assignServiceCall, logout } from "../actions";
import { BrandLogo } from "../brand-logo";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const isAdmin = session.role === APP_ROLES.ADMIN;
  const canAssign = roleCanAssign(session.role);

  const [requests, employees] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: session.role === APP_ROLES.EMPLOYEE ? { assignedToId: session.userId } : undefined,
      include: {
        assignedTo: {
          select: { id: true, name: true, username: true },
        },
      },
      orderBy: { id: "asc" },
    }),
    canAssign
      ? prisma.user.findMany({
          where: { role: APP_ROLES.EMPLOYEE },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const totalRequests = requests.length;
  const assignedRequests = requests.filter((request) => request.assignedToId !== null).length;
  const unassignedRequests = totalRequests - assignedRequests;
  const todaysRequests = requests.filter((request) => isToday(request.createdAt)).length;
  const allocationRate = totalRequests === 0 ? 0 : Math.round((assignedRequests / totalRequests) * 100);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[92rem] px-4 py-6 sm:px-6 lg:px-8">
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
            {(isAdmin || canAssign) && (
              <Link
                href="/form"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-blue-100 transition hover:bg-white/10"
              >
                <span className="h-2 w-2 rounded-full bg-blue-200" />
                New Call
              </Link>
            )}
            {isAdmin && (
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
          <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-4 py-4 dark:border-slate-700 dark:from-slate-900 dark:to-slate-800 sm:px-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.25em] text-blue-500 dark:text-sky-300">Overview</p>
              <h2 className="text-2xl font-semibold tracking-tight text-blue-950 dark:text-slate-100">Service dashboard</h2>
              <p className="text-sm text-blue-700 dark:text-slate-300">
                {session.role === APP_ROLES.EMPLOYEE
                  ? "Track calls currently assigned to you."
                  : "Allocate calls quickly and monitor workload."}
              </p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-right dark:border-slate-600 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-500 dark:text-sky-300">Allocation rate</p>
              <p className="text-2xl font-semibold text-blue-900 dark:text-slate-100">{allocationRate}%</p>
            </div>
          </header>

          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Total Calls"
              value={totalRequests}
              tone="from-blue-700 to-blue-500"
              subtitle="All visible service calls"
            />
            <MetricCard
              title="Assigned"
              value={assignedRequests}
              tone="from-blue-800 to-blue-600"
              subtitle="Allocated to employees"
            />
            <MetricCard
              title="Unassigned"
              value={unassignedRequests}
              tone="from-blue-500 to-blue-400"
              subtitle="Need allocation"
            />
            <MetricCard
              title="Today"
              value={todaysRequests}
              tone="from-blue-900 to-blue-700"
              subtitle="Calls created today"
            />
          </section>

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
                        <p className="text-xs uppercase tracking-[0.12em] text-blue-600 dark:text-sky-300">{request.docketNumber}</p>
                        <p className="font-semibold">{request.name}</p>
                        <p className="text-xs text-blue-600 dark:text-slate-300">{request.area}</p>
                      </div>
                      {request.assignedTo ? (
                        <StatusPill label="Allocated" className="bg-blue-100 text-blue-800 ring-blue-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-700" />
                      ) : (
                        <StatusPill label="Pending" className="bg-blue-50 text-blue-700 ring-blue-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-700" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <Detail label="Company" value={request.company} />
                      <Detail label="Product" value={request.product} />
                      <Detail label="Call Type" value={request.callType} />
                      <Detail
                        label="Assigned To"
                        value={request.assignedTo ? `${request.assignedTo.name} (${request.assignedTo.username})` : "Unassigned"}
                      />
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

              <div className="hidden md:block md:overflow-x-auto">
                <table className="w-full table-fixed divide-y divide-blue-100 text-left text-xs dark:divide-slate-700 sm:text-sm">
                  <colgroup>
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "19%" }} />
                  </colgroup>
                  <thead className="bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-slate-200">
                    <tr>
                      <Th>Docket</Th>
                      <Th>Name</Th>
                      <Th>Company</Th>
                      <Th>Product</Th>
                      <Th>Call Type</Th>
                      <Th>Status</Th>
                      <Th>Assigned To</Th>
                      {canAssign ? <Th>Allocate</Th> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100 bg-white dark:divide-slate-700 dark:bg-slate-900">
                    {requests.map((request) => (
                      <tr key={request.id} className="align-top text-blue-900 dark:text-slate-100">
                        <Td strong>{request.docketNumber}</Td>
                        <Td>
                          <div>
                            <p className="font-medium text-blue-900 dark:text-slate-100">{request.name}</p>
                            <p className="text-xs text-blue-600 dark:text-slate-300">{request.area}</p>
                          </div>
                        </Td>
                        <Td>{request.company}</Td>
                        <Td>{request.product}</Td>
                        <Td>{request.callType}</Td>
                        <Td>
                          {request.assignedTo ? (
                            <StatusPill label="Allocated" className="bg-blue-100 text-blue-800 ring-blue-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-700" />
                          ) : (
                            <StatusPill label="Pending" className="bg-blue-50 text-blue-700 ring-blue-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-700" />
                          )}
                        </Td>
                        <Td>
                          {request.assignedTo ? (
                            <div>
                              <p className="font-medium text-blue-900 dark:text-slate-100">{request.assignedTo.name}</p>
                              <p className="text-xs text-blue-600 dark:text-slate-300">{request.assignedTo.username}</p>
                            </div>
                          ) : (
                            <span className="text-blue-500 dark:text-slate-400">Unassigned</span>
                          )}
                        </Td>
                        {canAssign ? (
                          <Td>
                            <form action={assignServiceCall} className="flex flex-col gap-2">
                              <input type="hidden" name="requestId" value={request.id} />
                              <select
                                name="assignedToId"
                                defaultValue={request.assignedToId ? String(request.assignedToId) : ""}
                                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-2 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
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
                                className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500"
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

function MetricCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: number;
  subtitle: string;
  tone: string;
}) {
  return (
    <article className="rounded-2xl border border-blue-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-blue-500 dark:text-sky-300">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-blue-950 dark:text-slate-100">{value}</p>
          <p className="mt-1 text-xs text-blue-600 dark:text-slate-300">{subtitle}</p>
        </div>
        <span className={`h-3 w-14 rounded-full bg-gradient-to-r ${tone}`} />
      </div>
    </article>
  );
}

function StatusPill({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${className}`}>{label}</span>;
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
  return <th className="break-words px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.12em]">{children}</th>;
}

function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`px-3 py-3 align-top whitespace-normal break-words ${strong ? "font-semibold text-blue-950 dark:text-slate-100" : ""}`}>{children}</td>;
}

function isToday(date: Date) {
  const now = new Date();

  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

