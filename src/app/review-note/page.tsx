import { redirect } from "next/navigation";

import { normalizeStatus } from "../status-utils";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession } from "@/lib/auth";
import { formatDocketNumber } from "@/lib/docket";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type EmployeeService = {
  id: string;
  docketNumber: string;
  company: string;
  customerName: string;
  status: ReturnType<typeof normalizeStatus>;
  dateKeys: Set<string>;
};

type ReviewNoteRow = {
  id: string;
  docketNumber: string;
  company: string;
  customerName: string;
  status: ReturnType<typeof normalizeStatus>;
  note: string;
  submittedAt: Date | string | null;
};

export default async function ReviewNotePage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== APP_ROLES.EMPLOYEE) {
    redirect("/dashboard");
  }

  const [reviewAdjustments, assignmentServices, legacyServices] = await Promise.all([
    prisma.employeePointAdjustment.findMany({
      where: {
        employeeId: session.userId,
        NOT: [{ teamworkOption: "N/A" }, { teamworkOption: "" }],
      },
      select: {
        id: true,
        teamworkOption: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceAssignment.findMany({
      where: {
        employeeId: session.userId,
        request: { deletedAt: null },
      },
      select: {
        id: true,
        assignedAt: true,
        statusSubmittedAt: true,
        closedAt: true,
        status: true,
        request: {
          select: {
            id: true,
            docketNumber: true,
            company: true,
            name: true,
            status: true,
            createdAt: true,
            assignedAt: true,
            statusSubmittedAt: true,
            lastAttemptAt: true,
            closedAt: true,
          },
        },
      },
    }),
    prisma.serviceRequest.findMany({
      where: {
        assignedToId: session.userId,
        deletedAt: null,
        assignments: { none: { employeeId: session.userId } },
      },
      select: {
        id: true,
        docketNumber: true,
        company: true,
        name: true,
        status: true,
        createdAt: true,
        assignedAt: true,
        statusSubmittedAt: true,
        lastAttemptAt: true,
        closedAt: true,
      },
    }),
  ]);

  const services: EmployeeService[] = [
    ...assignmentServices.map((assignment) => ({
      id: assignment.request.id,
      docketNumber: assignment.request.docketNumber,
      company: assignment.request.company,
      customerName: assignment.request.name,
      status: normalizeStatus(assignment.status ?? assignment.request.status),
      dateKeys: getDateKeys([
        assignment.statusSubmittedAt,
        assignment.closedAt,
        assignment.assignedAt,
        assignment.request.statusSubmittedAt,
        assignment.request.lastAttemptAt,
        assignment.request.closedAt,
        assignment.request.assignedAt,
      ]),
    })),
    ...legacyServices.map((request) => ({
      id: request.id,
      docketNumber: request.docketNumber,
      company: request.company,
      customerName: request.name,
      status: normalizeStatus(request.status),
      dateKeys: getDateKeys([request.statusSubmittedAt, request.lastAttemptAt, request.closedAt, request.assignedAt, request.createdAt]),
    })),
  ];

  const rows = reviewAdjustments.flatMap((adjustment): ReviewNoteRow[] => {
    const note = adjustment.teamworkOption.trim();
    const noteDateKey = getKolkataDateKey(adjustment.createdAt);

    if (!note || note === "N/A" || !noteDateKey) {
      return [];
    }

    const matchingServices = services.filter((service) => service.dateKeys.has(noteDateKey));

    if (matchingServices.length === 0) {
      return [
        {
          id: adjustment.id,
          docketNumber: "-",
          company: "No matching service",
          customerName: "-",
          status: "New Call",
          note,
          submittedAt: adjustment.createdAt,
        },
      ];
    }

    return matchingServices.map((service) => ({
      id: `${adjustment.id}-${service.id}`,
      docketNumber: service.docketNumber,
      company: service.company,
      customerName: service.customerName,
      status: service.status,
      note,
      submittedAt: adjustment.createdAt,
    }));
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-blue-200 bg-white p-5 shadow-[0_20px_70px_rgba(29,78,216,0.12)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-blue-100 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-500">Service Notes</p>
            <h1 className="mt-2 text-3xl font-semibold text-blue-950">Review Note</h1>
            <p className="mt-2 text-sm font-medium text-blue-700">
              Showing saved review notes with docket number and company name.
            </p>
          </div>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
            {rows.length} note{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        {rows.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-blue-100">
            <div className="hidden grid-cols-[8rem_minmax(0,1.1fr)_minmax(0,1fr)_8rem_10rem] gap-3 bg-blue-50 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700 md:grid">
              <span>Docket</span>
              <span>Company</span>
              <span>Customer</span>
              <span>Status</span>
              <span>Date</span>
            </div>
            <div className="divide-y divide-blue-100">
              {rows.map((row) => (
                <article key={row.id} className="grid gap-3 bg-white px-4 py-4 text-sm text-blue-950 md:grid-cols-[8rem_minmax(0,1.1fr)_minmax(0,1fr)_8rem_10rem] md:items-start">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500 md:hidden">Docket</p>
                    <p className="font-bold text-blue-700">{row.docketNumber === "-" ? "-" : formatDocketNumber(row.docketNumber)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500 md:hidden">Company</p>
                    <p className="break-words font-semibold">{row.company}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500 md:hidden">Customer</p>
                    <p className="break-words font-medium text-slate-700">{row.customerName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500 md:hidden">Status</p>
                    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase ${getStatusClass(row.status)}`}>
                      {row.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500 md:hidden">Date</p>
                    <p className="text-xs font-semibold text-blue-600">{row.submittedAt ? formatDate(row.submittedAt) : "-"}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 md:col-span-5">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-blue-900">{row.note}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-blue-200 bg-blue-50/70 px-4 py-12 text-center">
            <p className="text-sm font-semibold text-blue-950">No review notes found.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function getDateKeys(values: Array<Date | string | null | undefined>) {
  return new Set(values.map(getKolkataDateKey).filter(Boolean));
}

function getStatusClass(status: ReturnType<typeof normalizeStatus>) {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-800";
    case "Cancel":
      return "bg-red-100 text-red-800";
    case "In Process":
      return "bg-amber-100 text-amber-800";
    case "New Call":
    default:
      return "bg-blue-100 text-blue-800";
  }
}

function getKolkataDateKey(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
